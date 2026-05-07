import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  type HydratableSkill,
  type PublicPublisher,
  toPublicPublisher,
  toPublicSkill,
} from "./public";
import { getOwnerPublisher } from "./publishers";
import { digestToHydratableSkill, digestToOwnerInfo } from "./skillSearchDigest";
import {
  type PublicSkillListVersion,
  toPublicSkillListVersion,
  toPublicSkillListVersionFromSummary,
} from "./skillVersions";

export type PublicSkillEntry = {
  skill: NonNullable<ReturnType<typeof toPublicSkill>>;
  latestVersion: PublicSkillListVersion | null;
  ownerHandle: string | null;
  owner: PublicPublisher | null;
};

export async function buildPublicSkillEntries(
  ctx: QueryCtx,
  skills: HydratableSkill[],
  opts?: {
    includeVersion?: boolean;
    preResolvedOwners?: Map<
      Id<"skills">,
      { ownerHandle: string | null; owner: PublicPublisher | null }
    >;
  },
) {
  const includeVersion = opts?.includeVersion ?? true;
  const ownerInfoCache = new Map<
    string,
    Promise<{
      ownerHandle: string | null;
      owner: PublicPublisher | null;
    }>
  >();

  const getOwnerInfo = (
    skillId: Id<"skills">,
    ownerUserId: Id<"users">,
    ownerPublisherId?: Id<"publishers"> | null,
  ) => {
    // Use pre-resolved owner from digest when available to avoid adding the
    // users table to the reactive read set.
    const preResolved = opts?.preResolvedOwners?.get(skillId);
    if (preResolved?.owner) return Promise.resolve(preResolved);

    const cacheKey = String(ownerPublisherId ?? ownerUserId);
    const cached = ownerInfoCache.get(cacheKey);
    if (cached) return cached;
    const ownerPromise = getOwnerPublisher(ctx, {
      ownerPublisherId,
      ownerUserId,
    }).then((ownerDoc) => {
      const publicOwner = toPublicPublisher(ownerDoc);
      if (!publicOwner) {
        return { ownerHandle: null, owner: null };
      }
      return {
        ownerHandle: publicOwner.handle ?? String(publicOwner._id),
        owner: publicOwner,
      };
    });
    ownerInfoCache.set(cacheKey, ownerPromise);
    return ownerPromise;
  };

  const entries = await Promise.all(
    skills.map(async (skill) => {
      // Use denormalized summary when available to avoid reading the full version doc.
      const summary = skill.latestVersionSummary;
      const hasSummary = includeVersion && summary;
      const [latestVersionDoc, ownerInfo] = await Promise.all([
        includeVersion && !hasSummary && skill.latestVersionId
          ? ctx.db.get(skill.latestVersionId)
          : null,
        getOwnerInfo(skill._id, skill.ownerUserId, skill.ownerPublisherId),
      ]);
      const publicSkill = toPublicSkill(skill);
      if (!publicSkill || !ownerInfo.owner) return null;
      const latestVersion = hasSummary
        ? toPublicSkillListVersionFromSummary(summary!, skill.latestVersionId)
        : toPublicSkillListVersion(latestVersionDoc);
      return {
        skill: publicSkill,
        latestVersion,
        ownerHandle: ownerInfo.ownerHandle,
        owner: ownerInfo.owner,
      };
    }),
  );

  return entries.filter(Boolean) as PublicSkillEntry[];
}

export async function filterSkillsByActiveOwner(
  ctx: Pick<QueryCtx, "db">,
  skills: Doc<"skills">[],
) {
  const ownerCache = new Map<Id<"users">, Promise<Doc<"users"> | null>>();

  const getOwner = (ownerUserId: Id<"users">) => {
    const cached = ownerCache.get(ownerUserId);
    if (cached) return cached;
    const ownerPromise = ctx.db.get(ownerUserId);
    ownerCache.set(ownerUserId, ownerPromise);
    return ownerPromise;
  };

  const filtered = await Promise.all(
    skills.map(async (skill) => {
      const owner = await getOwner(skill.ownerUserId);
      if (!owner || owner.deletedAt || owner.deactivatedAt) return null;
      return skill;
    }),
  );

  return filtered.filter((skill): skill is Doc<"skills"> => skill !== null);
}

export function buildPublicSkillEntryFromDigest(
  digest: Doc<"skillSearchDigest">,
): PublicSkillEntry | null {
  const hydratable = digestToHydratableSkill(digest);
  const publicSkill = toPublicSkill(hydratable);
  if (!publicSkill) return null;
  const ownerInfo = digestToOwnerInfo(digest);
  if (!ownerInfo?.owner) return null;
  const latestVersion = digest.latestVersionSummary
    ? toPublicSkillListVersionFromSummary(digest.latestVersionSummary, digest.latestVersionId)
    : null;
  return {
    skill: publicSkill,
    latestVersion,
    ownerHandle: ownerInfo.ownerHandle,
    owner: ownerInfo.owner,
  };
}
