import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./functions";
import { getOptionalActiveAuthUserId } from "./lib/access";
import { getOwnerPublisher } from "./lib/publishers";
import { toPublicPublisher, toPublicUser } from "./lib/public";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;
const DUPLICATE_SAMPLE_LIMIT = 12;
const REPORT_REASON_LIMIT = 3;

function clampLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value ?? DEFAULT_LIMIT), 10), MAX_LIMIT);
}

function sumFileSizes(files: Array<{ size?: number }> | null | undefined) {
  return (files ?? []).reduce((total, file) => total + (file.size ?? 0), 0);
}

async function loadPublicUserMap(ctx: QueryCtx, userIds: Id<"users">[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, toPublicUser(await ctx.db.get(userId))] as const),
  );
  return new Map(entries);
}

async function buildSkillSummary(
  ctx: QueryCtx,
  skill: Doc<"skills">,
  latestVersion?: Doc<"skillVersions"> | null,
) {
  const version =
    latestVersion !== undefined
      ? latestVersion
      : skill.latestVersionId
        ? await ctx.db.get(skill.latestVersionId)
        : null;
  const owner = toPublicPublisher(
    await getOwnerPublisher(ctx, {
      ownerPublisherId: skill.ownerPublisherId,
      ownerUserId: skill.ownerUserId,
    }),
  );

  return {
    _id: skill._id,
    slug: skill.slug,
    displayName: skill.displayName,
    summary: skill.summary ?? null,
    owner,
    ownerUserId: skill.ownerUserId,
    ownerPublisherId: skill.ownerPublisherId ?? null,
    visibility: skill.visibility ?? "public",
    moderationStatus: skill.moderationStatus ?? "active",
    moderationReason: skill.moderationReason ?? null,
    moderationVerdict: skill.moderationVerdict ?? null,
    moderationFlags: skill.moderationFlags ?? [],
    moderationSummary: skill.moderationSummary ?? null,
    isSuspicious: Boolean(skill.isSuspicious),
    reportCount: skill.reportCount ?? 0,
    lastReportedAt: skill.lastReportedAt ?? null,
    canonicalSkillId: skill.canonicalSkillId ?? null,
    forkOf: skill.forkOf ?? null,
    manualOverride: skill.manualOverride ?? null,
    capabilityTags: skill.capabilityTags ?? [],
    badges: skill.badges ?? null,
    batch: skill.batch ?? null,
    softDeletedAt: skill.softDeletedAt ?? null,
    stats: skill.stats,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    latestVersion: version
      ? {
          _id: version._id,
          version: version.version,
          createdAt: version.createdAt,
          fingerprint: version.fingerprint ?? null,
          fileCount: (version.files ?? []).length,
          totalBytes: sumFileSizes(version.files),
          staticScanStatus: version.staticScan?.status ?? null,
          staticScanSummary: version.staticScan?.summary ?? null,
          vtStatus: version.vtAnalysis?.status ?? null,
          llmStatus: version.llmAnalysis?.status ?? null,
        }
      : null,
  };
}

function isStaffUser(user: Doc<"users"> | null) {
  return user?.role === "admin" || user?.role === "moderator";
}

async function listReportedSkills(ctx: QueryCtx, limit: number, includePrivateDetails: boolean) {
  const skills = await ctx.db
    .query("skills")
    .withIndex("by_active_updated", (q) => q.eq("softDeletedAt", undefined))
    .order("desc")
    .take(limit * 8);
  const reported = skills
    .filter((skill) => (skill.reportCount ?? 0) > 0)
    .sort((a, b) => (b.lastReportedAt ?? 0) - (a.lastReportedAt ?? 0))
    .slice(0, limit);

  return await Promise.all(
    reported.map(async (skill) => {
      const reports = await ctx.db
        .query("skillReports")
        .withIndex("by_skill_createdAt", (q) => q.eq("skillId", skill._id))
        .order("desc")
        .take(REPORT_REASON_LIMIT);
      const reporterMap = includePrivateDetails
        ? await loadPublicUserMap(
            ctx,
            reports.map((report) => report.userId),
          )
        : new Map<Id<"users">, ReturnType<typeof toPublicUser>>();
      return {
        ...(await buildSkillSummary(ctx, skill)),
        reports: reports.map((report) => ({
          reason: includePrivateDetails
            ? report.reason?.trim() || "未填写原因"
            : report.reason?.trim()
              ? "已记录举报原因"
              : "未填写原因",
          createdAt: report.createdAt,
          reporter: includePrivateDetails ? (reporterMap.get(report.userId) ?? null) : null,
        })),
      };
    }),
  );
}

async function listSuspiciousSkills(ctx: QueryCtx, limit: number) {
  const skills = await ctx.db
    .query("skills")
    .withIndex("by_nonsuspicious_updated", (q) =>
      q.eq("softDeletedAt", undefined).eq("isSuspicious", true),
    )
    .order("desc")
    .take(limit);
  return await Promise.all(skills.map((skill) => buildSkillSummary(ctx, skill)));
}

async function listRecentVersions(ctx: QueryCtx, limit: number) {
  const versions = await ctx.db
    .query("skillVersions")
    .order("desc")
    .take(limit * 2);
  const activeVersions = versions.filter((version) => !version.softDeletedAt).slice(0, limit);
  return await Promise.all(
    activeVersions.map(async (version) => {
      const skill = await ctx.db.get(version.skillId);
      return {
        version: {
          _id: version._id,
          version: version.version,
          createdAt: version.createdAt,
          fileCount: (version.files ?? []).length,
          totalBytes: sumFileSizes(version.files),
          fingerprint: version.fingerprint ?? null,
          staticScanStatus: version.staticScan?.status ?? null,
          staticScanSummary: version.staticScan?.summary ?? null,
          vtStatus: version.vtAnalysis?.status ?? null,
          llmStatus: version.llmAnalysis?.status ?? null,
        },
        skill: skill ? await buildSkillSummary(ctx, skill, version) : null,
      };
    }),
  );
}

async function listDuplicateCandidates(ctx: QueryCtx, limit: number) {
  const skills = await ctx.db
    .query("skills")
    .withIndex("by_active_updated", (q) => q.eq("softDeletedAt", undefined))
    .order("desc")
    .take(limit * 6);
  const results: Array<{
    skill: Awaited<ReturnType<typeof buildSkillSummary>>;
    fingerprint: string;
    matches: Array<{
      _id: Id<"skills">;
      slug: string;
      displayName: string;
      ownerHandle: string | null;
    }>;
  }> = [];

  for (const skill of skills) {
    if (results.length >= Math.min(limit, DUPLICATE_SAMPLE_LIMIT)) break;
    const version = skill.latestVersionId ? await ctx.db.get(skill.latestVersionId) : null;
    const fingerprint = version?.fingerprint;
    if (!fingerprint) continue;
    const matches = await ctx.db
      .query("skillVersionFingerprints")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .take(8);
    const matchSummaries = [];
    for (const match of matches) {
      if (match.skillId === skill._id) continue;
      const matchSkill = await ctx.db.get(match.skillId);
      if (!matchSkill || matchSkill.softDeletedAt) continue;
      const owner = toPublicPublisher(
        await getOwnerPublisher(ctx, {
          ownerPublisherId: matchSkill.ownerPublisherId,
          ownerUserId: matchSkill.ownerUserId,
        }),
      );
      matchSummaries.push({
        _id: matchSkill._id,
        slug: matchSkill.slug,
        displayName: matchSkill.displayName,
        ownerHandle: owner?.handle ?? null,
      });
    }
    if (matchSummaries.length > 0) {
      results.push({
        skill: await buildSkillSummary(ctx, skill, version),
        fingerprint,
        matches: matchSummaries,
      });
    }
  }
  return results;
}

async function listOrganizations(ctx: QueryCtx, limit: number) {
  const publishers = await ctx.db
    .query("publishers")
    .withIndex("by_kind_handle", (q) => q.eq("kind", "org"))
    .take(limit);
  return await Promise.all(
    publishers.map(async (publisher) => {
      const [members, skills, packages] = await Promise.all([
        ctx.db
          .query("publisherMembers")
          .withIndex("by_publisher", (q) => q.eq("publisherId", publisher._id))
          .take(101),
        ctx.db
          .query("skills")
          .withIndex("by_owner_publisher", (q) => q.eq("ownerPublisherId", publisher._id))
          .take(101),
        ctx.db
          .query("packages")
          .withIndex("by_owner_publisher", (q) => q.eq("ownerPublisherId", publisher._id))
          .take(101),
      ]);
      return {
        publisher: {
          _id: publisher._id,
          handle: publisher.handle,
          displayName: publisher.displayName,
          trustedPublisher: Boolean(publisher.trustedPublisher),
          createdAt: publisher.createdAt,
          updatedAt: publisher.updatedAt,
        },
        memberCount: members.length,
        ownerCount: members.filter((member) => member.role === "owner").length,
        adminCount: members.filter((member) => member.role === "admin").length,
        skillCount: skills.filter((skill) => !skill.softDeletedAt).length,
        packageCount: packages.filter((pkg) => !pkg.softDeletedAt).length,
      };
    }),
  );
}

async function listApiTokens(
  ctx: QueryCtx,
  limit: number,
  actor: Doc<"users"> | null,
  actorId: Id<"users"> | undefined,
) {
  if (!actor || !actorId) return [];
  const tokens =
    actor.role === "admin"
      ? await ctx.db.query("apiTokens").order("desc").take(limit)
      : await ctx.db
          .query("apiTokens")
          .withIndex("by_user", (q) => q.eq("userId", actorId))
          .order("desc")
          .take(limit);
  const userMap = await loadPublicUserMap(
    ctx,
    tokens.map((token) => token.userId),
  );
  return tokens.map((token) => ({
    _id: token._id,
    label: token.label,
    prefix: token.prefix,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt ?? null,
    revokedAt: token.revokedAt ?? null,
    owner: userMap.get(token.userId) ?? null,
    ownToken: token.userId === actorId,
  }));
}

async function listUsers(ctx: QueryCtx, limit: number, actor: Doc<"users"> | null) {
  if (actor?.role !== "admin") return await listPreviewUsers(ctx, limit);
  const users = await ctx.db.query("users").order("desc").take(limit);
  return users.map((user) => ({
    _id: user._id,
    handle: user.handle ?? null,
    name: user.name ?? null,
    displayName: user.displayName ?? null,
    image: user.image ?? null,
    email: user.email ?? null,
    role: user.role ?? "user",
    primaryLoginMethod: user.primaryLoginMethod ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    trustedPublisher: Boolean(user.trustedPublisher),
    requiresModerationAt: user.requiresModerationAt ?? null,
    requiresModerationReason: user.requiresModerationReason ?? null,
    deactivatedAt: user.deactivatedAt ?? null,
    deletedAt: user.deletedAt ?? null,
    banReason: user.banReason ?? null,
    createdAt: user.createdAt ?? user._creationTime,
    updatedAt: user.updatedAt ?? null,
  }));
}

async function listPreviewUsers(ctx: QueryCtx, limit: number) {
  const skills = await ctx.db
    .query("skills")
    .withIndex("by_active_updated", (q) => q.eq("softDeletedAt", undefined))
    .order("desc")
    .take(limit * 2);
  const users = await Promise.all(
    [...new Set(skills.map((skill) => skill.ownerUserId))]
      .slice(0, limit)
      .map(async (userId) => ctx.db.get(userId)),
  );
  return users.filter(Boolean).map((user) => ({
    _id: user._id,
    handle: user.handle ?? null,
    name: user.name ?? null,
    displayName: user.displayName ?? null,
    image: user.image ?? null,
    email: null,
    role: "user" as const,
    primaryLoginMethod: null,
    lastLoginAt: null,
    trustedPublisher: Boolean(user.trustedPublisher),
    requiresModerationAt: null,
    requiresModerationReason: null,
    deactivatedAt: null,
    deletedAt: null,
    banReason: null,
    createdAt: user.createdAt ?? user._creationTime,
    updatedAt: user.updatedAt ?? null,
  }));
}

async function listPackages(ctx: QueryCtx, limit: number) {
  return await ctx.db
    .query("packageSearchDigest")
    .withIndex("by_active_updated", (q) => q.eq("softDeletedAt", undefined))
    .order("desc")
    .take(limit);
}

async function listAuditLogs(
  ctx: QueryCtx,
  limit: number,
  actor: Doc<"users"> | null,
  actorId: Id<"users"> | undefined,
) {
  if (!actor || !actorId || !isStaffUser(actor)) return [];
  const logs =
    actor.role === "admin"
      ? await ctx.db.query("auditLogs").order("desc").take(limit)
      : await ctx.db
          .query("auditLogs")
          .withIndex("by_actor", (q) => q.eq("actorUserId", actorId))
          .order("desc")
          .take(limit);
  const actorMap = await loadPublicUserMap(
    ctx,
    logs.map((log) => log.actorUserId),
  );
  return logs.map((log) => ({
    _id: log._id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    metadata: log.metadata,
    createdAt: log.createdAt,
    actor: actorMap.get(log.actorUserId) ?? null,
  }));
}

export const getConsoleData = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getOptionalActiveAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const staff = isStaffUser(user);
    const limit = clampLimit(args.limit);
    const [
      reportedSkills,
      suspiciousSkills,
      recentVersions,
      duplicateCandidates,
      organizations,
      apiTokens,
      users,
      packages,
      auditLogs,
    ] = await Promise.all([
      listReportedSkills(ctx, limit, staff),
      listSuspiciousSkills(ctx, limit),
      listRecentVersions(ctx, limit),
      listDuplicateCandidates(ctx, limit),
      listOrganizations(ctx, limit),
      listApiTokens(ctx, limit, user, userId),
      listUsers(ctx, limit, user),
      listPackages(ctx, limit),
      listAuditLogs(ctx, limit, user, userId),
    ]);

    return {
      viewer: {
        _id: user?._id ?? null,
        handle: user?.handle ?? null,
        displayName: user?.displayName ?? user?.name ?? null,
        role: staff ? (user?.role ?? "user") : ("preview" as const),
      },
      capabilities: {
        canManageUsers: user?.role === "admin",
        canViewAllApiTokens: user?.role === "admin",
        readOnlyPrototype: true,
      },
      reportedSkills,
      suspiciousSkills,
      recentVersions,
      duplicateCandidates,
      organizations,
      apiTokens,
      users,
      packages,
      auditLogs,
    };
  },
});
