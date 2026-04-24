import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getPublisherMembership } from "./publishers";

export type SkillVisibility = "public" | "restricted" | "private";

export type SkillPolicyActor = Pick<Doc<"users">, "_id" | "role" | "deletedAt" | "deactivatedAt">;

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

type SkillReadFields = Pick<
  Doc<"skills">,
  | "_id"
  | "ownerUserId"
  | "ownerPublisherId"
  | "visibility"
  | "softDeletedAt"
  | "moderationStatus"
  | "moderationFlags"
>;

type SkillVisibilityFields = Pick<
  Doc<"skills">,
  "visibility" | "softDeletedAt" | "moderationStatus" | "moderationFlags"
>;

export type SkillPolicyDecisionReason =
  | "allowed"
  | "anonymous"
  | "deleted"
  | "moderation"
  | "malware"
  | "private"
  | "missing_grant"
  | "version_deleted";

export type SkillPolicyDecision = {
  allowed: boolean;
  reason: SkillPolicyDecisionReason;
  status?: 401 | 403 | 404 | 410 | 423;
  message?: string;
};

export function allowSkillPolicyDecision(): SkillPolicyDecision {
  return { allowed: true, reason: "allowed" };
}

export function getSkillVisibility(
  skill: Pick<Doc<"skills">, "visibility"> | null | undefined,
): SkillVisibility {
  return skill?.visibility ?? "public";
}

export function isStaffUser(user: SkillPolicyActor | null | undefined) {
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

export function canListSkillPublicly(skill: SkillVisibilityFields | null | undefined) {
  if (!skill) return false;
  if (!isPublicVisibility(skill)) return false;
  return isModerationPubliclyReadable(skill);
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
  actor: SkillPolicyActor | null | undefined,
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
    .withIndex("by_skill_user", (q) => q.eq("skillId", params.skillId).eq("subjectUserId", userId))
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

export async function canReadSkillForActor(
  ctx: DbCtx,
  skill: SkillReadFields,
  actor: SkillPolicyActor | null | undefined,
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

export async function canReadSkillVersion(
  ctx: DbCtx,
  skill: SkillReadFields,
  actor: SkillPolicyActor | null | undefined,
) {
  return canReadSkillForActor(ctx, skill, actor);
}

export async function canReadSkillFile(
  ctx: DbCtx,
  skill: SkillReadFields,
  version: Pick<Doc<"skillVersions">, "softDeletedAt">,
  actor: SkillPolicyActor | null | undefined,
) {
  if (version.softDeletedAt) return false;
  if (skill.moderationFlags?.includes("blocked.malware")) return true;
  return canReadSkillForActor(ctx, skill, actor);
}

export function canDownloadSkill(
  skill: Pick<Doc<"skills">, "moderationStatus" | "moderationReason" | "moderationFlags">,
): SkillPolicyDecision {
  if (skill.moderationFlags?.includes("blocked.malware")) {
    return {
      allowed: false,
      reason: "malware",
      status: 403,
      message:
        "Blocked: this skill has been flagged as malicious by VirusTotal and cannot be downloaded.",
    };
  }
  if (skill.moderationStatus === "hidden" && skill.moderationReason === "pending.scan") {
    return {
      allowed: false,
      reason: "moderation",
      status: 423,
      message:
        "This skill is pending a security scan by VirusTotal. Please try again in a few minutes.",
    };
  }
  if (skill.moderationStatus === "removed") {
    return {
      allowed: false,
      reason: "moderation",
      status: 410,
      message: "This skill has been removed by a moderator.",
    };
  }
  if (skill.moderationStatus === "hidden") {
    return {
      allowed: false,
      reason: "moderation",
      status: 403,
      message: "This skill is currently unavailable.",
    };
  }
  return allowSkillPolicyDecision();
}

export function canSeeModerationEvidence(
  skill: Pick<Doc<"skills">, "ownerUserId" | "ownerPublisherId">,
  actor: SkillPolicyActor | null | undefined,
) {
  if (!actor || actor.deletedAt || actor.deactivatedAt) return false;
  return isStaffUser(actor) || skill.ownerUserId === actor._id;
}
