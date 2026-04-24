import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getPublisherMembership } from "./publishers";

export type SkillVisibility = "public" | "restricted" | "private";

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

type Actor = Pick<Doc<"users">, "_id" | "role" | "deletedAt" | "deactivatedAt">;

export function getSkillVisibility(
  skill: Pick<Doc<"skills">, "visibility"> | null | undefined,
): SkillVisibility {
  return skill?.visibility ?? "public";
}

export function isStaffUser(user: Actor | null | undefined) {
  return Boolean(
    user &&
      !user.deletedAt &&
      !user.deactivatedAt &&
      (user.role === "admin" || user.role === "moderator"),
  );
}

export function isPublicVisibility(skill: Pick<Doc<"skills">, "visibility">) {
  return getSkillVisibility(skill) === "public";
}

export function isModerationPubliclyReadable(
  skill: Pick<Doc<"skills">, "softDeletedAt" | "moderationStatus" | "moderationFlags">,
) {
  if (skill.softDeletedAt) return false;
  if (skill.moderationStatus && skill.moderationStatus !== "active") return false;
  if (skill.moderationFlags?.includes("blocked.malware")) return false;
  return true;
}

export async function hasPublisherMembership(
  ctx: DbCtx,
  params: {
    publisherId: Id<"publishers"> | null | undefined;
    userId: Id<"users"> | null | undefined;
  },
) {
  if (!params.publisherId || !params.userId) return false;
  return Boolean(await getPublisherMembership(ctx, params.publisherId, params.userId));
}

export async function canManageSkillAccess(
  ctx: DbCtx,
  skill: Pick<Doc<"skills">, "ownerUserId" | "ownerPublisherId">,
  actor: Actor | null | undefined,
) {
  if (!actor || actor.deletedAt || actor.deactivatedAt) return false;
  if (isStaffUser(actor)) return true;
  if (skill.ownerUserId === actor._id) return true;
  if (!skill.ownerPublisherId) return false;
  const membership = await getPublisherMembership(ctx, skill.ownerPublisherId, actor._id);
  return membership?.role === "owner" || membership?.role === "admin";
}

export async function hasSkillAccessGrant(
  ctx: DbCtx,
  params: {
    skillId: Id<"skills">;
    userId: Id<"users"> | null | undefined;
  },
) {
  if (!params.userId) return false;
  const userId = params.userId;

  const directGrant = await ctx.db
    .query("skillAccessGrants")
    .withIndex("by_skill_user", (q) =>
      q.eq("skillId", params.skillId).eq("subjectUserId", userId),
    )
    .unique();
  if (directGrant) return true;

  const memberships = await ctx.db
    .query("publisherMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const membership of memberships) {
    const grant = await ctx.db
      .query("skillAccessGrants")
      .withIndex("by_skill_publisher", (q) =>
        q.eq("skillId", params.skillId).eq("subjectPublisherId", membership.publisherId),
      )
      .unique();
    if (grant) return true;
  }
  return false;
}

export async function canReadSkill(
  ctx: DbCtx,
  skill: Pick<
    Doc<"skills">,
    | "_id"
    | "ownerUserId"
    | "ownerPublisherId"
    | "visibility"
    | "softDeletedAt"
    | "moderationStatus"
    | "moderationFlags"
  >,
  actor: Actor | null | undefined,
) {
  const activeActor = actor && !actor.deletedAt && !actor.deactivatedAt ? actor : null;
  if (isStaffUser(activeActor)) return true;
  if (activeActor && skill.ownerUserId === activeActor._id) return true;
  if (
    activeActor &&
    (await hasPublisherMembership(ctx, {
      publisherId: skill.ownerPublisherId,
      userId: activeActor._id,
    }))
  ) {
    return true;
  }

  if (!isModerationPubliclyReadable(skill)) return false;

  const visibility = getSkillVisibility(skill);
  if (visibility === "public") return true;
  if (visibility === "private") return false;

  return await hasSkillAccessGrant(ctx, {
    skillId: skill._id,
    userId: activeActor?._id,
  });
}
