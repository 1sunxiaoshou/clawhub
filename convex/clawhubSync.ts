import { ConvexError, v } from "convex/values";
import { unzipSync } from "fflate";
import semver from "semver";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction, internalMutation, internalQuery, query } from "./functions";
import { assertAdmin, requireUser, requireUserFromAction } from "./lib/access";
import {
  computeDefaultSelectedPaths,
  detectGitHubImportCandidates,
  listTextFilesUnderCandidate,
  normalizeRepoPath,
  stripGitHubZipRoot,
  suggestVersion,
} from "./lib/githubImport";
import {
  resolveClawhubImportPage,
} from "./lib/clawhubImport";
import { publishVersionForUser } from "./lib/skillPublish";
import { sanitizePath } from "./lib/skills";
import {
  buildClawhubSourceRepo,
  MAX_SELECTED_BYTES,
  sha256Hex,
  toErrorMessage,
  unzipToEntries as unzipToEntriesShared,
} from "./lib/zipUtils";

const CLAWHUB_CONVEX_QUERY_URL =
  "https://wry-manatee-359.convex.cloud/api/query";
const CLAWHUB_PAGE_SIZE = 100;
const MAX_IMPORT_BATCH_ITEMS = 1;
const FETCH_TIMEOUT_MS = 60000;

type ClawhubCatalogEntry = {
  latestVersion: { version?: string | null; createdAt?: number | null } | null;
  ownerHandle?: string | null;
  skill: {
    slug?: string | null;
    displayName?: string | null;
    summary?: string | null;
    updatedAt?: number | null;
    stats?: {
      downloads?: number | null;
      stars?: number | null;
      installsCurrent?: number | null;
      installsAllTime?: number | null;
    } | null;
  } | null;
};

type ClawhubCatalogPageResponse = {
  status?: string;
  value?: {
    hasMore?: boolean;
    nextCursor?: string | null;
    page?: ClawhubCatalogEntry[];
  };
};

type SyncBatchResult = {
  ok: true;
  jobId: string;
  pageCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  imported: number;
  skipped: number;
  failed: Array<{ slug: string; reason: string }>;
};

type ClawhubSyncJobDoc = {
  _id: Id<"clawhubSyncJobs">;
  source: "clawhub";
  sourceUrl: string;
  startedByUserId: Id<"users">;
  localUserId: Id<"users">;
  status: "running" | "failed" | "paused" | "done";
  pageSize: number;
  cursor?: string;
  hasMore: boolean;
  totalCount?: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  pageCount: number;
  attempts: number;
  lastError?: string;
  recentFailures: Array<{ slug: string; reason: string; at: number }>;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
};

function isStaleRunningSyncJob(job: ClawhubSyncJobDoc | null) {
  if (!job) return false;
  return job.status === "running" && job.hasMore === false;
}

export const getLatestClawhubSyncJob = query({
  args: {},
  handler: async (ctx): Promise<ClawhubSyncJobDoc | null> => {
    const { user } = await requireUser(ctx);
    assertAdmin(user);
    return (await ctx.db
      .query("clawhubSyncJobs")
      .withIndex("by_updated", (q) => q.gte("updatedAt", 0))
      .order("desc")
      .first()) as ClawhubSyncJobDoc | null;
  },
});

export const getLatestClawhubSyncJobInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<ClawhubSyncJobDoc | null> => {
    return (await ctx.db
      .query("clawhubSyncJobs")
      .withIndex("by_updated", (q) => q.gte("updatedAt", 0))
      .order("desc")
      .first()) as ClawhubSyncJobDoc | null;
  },
});

export const getClawhubSyncJobByIdInternal = internalQuery({
  args: {
    jobId: v.id("clawhubSyncJobs"),
  },
  handler: async (ctx, args): Promise<ClawhubSyncJobDoc | null> => {
    return (await ctx.db.get(args.jobId)) as ClawhubSyncJobDoc | null;
  },
});

export const createClawhubSyncJobInternal = internalMutation({
  args: {
    startedByUserId: v.id("users"),
    localUserId: v.id("users"),
    pageSize: v.number(),
    sourceUrl: v.string(),
    totalCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ClawhubSyncJobDoc> => {
    const now = Date.now();
    const jobId = await ctx.db.insert("clawhubSyncJobs", {
      source: "clawhub",
      sourceUrl: args.sourceUrl,
      startedByUserId: args.startedByUserId,
      localUserId: args.localUserId,
      status: "running",
      pageSize: args.pageSize,
      totalCount: args.totalCount ?? 0,
      cursor: undefined,
      hasMore: true,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      pageCount: 0,
      attempts: 1,
      recentFailures: [],
      startedAt: now,
      updatedAt: now,
    });
    return (await ctx.db.get(jobId)) as ClawhubSyncJobDoc;
  },
});

export const resumeClawhubSyncJobInternal = internalMutation({
  args: {
    jobId: v.id("clawhubSyncJobs"),
  },
  handler: async (ctx, args): Promise<ClawhubSyncJobDoc | null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "running",
      updatedAt: now,
      lastError: undefined,
      finishedAt: undefined,
      attempts: job.attempts + 1,
    });
    return await ctx.db.get(args.jobId);
  },
});

export const updateClawhubSyncJobInternal = internalMutation({
  args: {
    jobId: v.id("clawhubSyncJobs"),
    importedDelta: v.optional(v.number()),
    skippedDelta: v.optional(v.number()),
    failedDelta: v.optional(v.number()),
    pageCountDelta: v.optional(v.number()),
    totalCount: v.optional(v.number()),
    cursor: v.optional(v.string()),
    hasMore: v.optional(v.boolean()),
    lastError: v.optional(v.string()),
    recentFailure: v.optional(
      v.object({
        slug: v.string(),
        reason: v.string(),
        at: v.number(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<ClawhubSyncJobDoc | null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = Date.now();
    const recentFailures = [...job.recentFailures];
    if (args.recentFailure) {
      recentFailures.unshift(args.recentFailure);
      recentFailures.splice(25);
    }
    await ctx.db.patch(args.jobId, {
      importedCount: job.importedCount + (args.importedDelta ?? 0),
      skippedCount: job.skippedCount + (args.skippedDelta ?? 0),
      failedCount: job.failedCount + (args.failedDelta ?? 0),
      pageCount: job.pageCount + (args.pageCountDelta ?? 0),
      totalCount: args.totalCount ?? job.totalCount,
      cursor: args.cursor,
      hasMore: args.hasMore ?? job.hasMore,
      lastError: args.lastError,
      recentFailures,
      updatedAt: now,
    });
    return (await ctx.db.get(args.jobId)) as ClawhubSyncJobDoc;
  },
});

export const updateClawhubSkillStatsInternal = internalMutation({
  args: {
    skillId: v.id("skills"),
    stats: v.object({
      downloads: v.number(),
      stars: v.number(),
      installsCurrent: v.number(),
      installsAllTime: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) return;
    const now = Date.now();
    await ctx.db.patch(args.skillId, {
      statsDownloads: args.stats.downloads,
      statsStars: args.stats.stars,
      statsInstallsCurrent: args.stats.installsCurrent,
      statsInstallsAllTime: args.stats.installsAllTime,
      stats: {
        ...skill.stats,
        downloads: args.stats.downloads,
        stars: args.stats.stars,
        installsCurrent: args.stats.installsCurrent,
        installsAllTime: args.stats.installsAllTime,
      },
      updatedAt: now,
    });
  },
});

export const finishClawhubSyncJobInternal = internalMutation({
  args: {
    jobId: v.id("clawhubSyncJobs"),
    status: v.union(v.literal("done"), v.literal("failed"), v.literal("paused")),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ClawhubSyncJobDoc | null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: args.status,
      lastError: args.lastError,
      finishedAt: now,
      updatedAt: now,
      hasMore: false,
    });
    return (await ctx.db.get(args.jobId)) as ClawhubSyncJobDoc;
  },
});

export const pauseClawhubSyncJobInternal = internalMutation({
  args: {
    jobId: v.id("clawhubSyncJobs"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ClawhubSyncJobDoc | null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "paused",
      lastError: args.reason ?? "Paused by user",
      finishedAt: now,
      updatedAt: now,
      hasMore: false,
    });
    return (await ctx.db.get(args.jobId)) as ClawhubSyncJobDoc;
  },
});

export const triggerClawhubCatalogSync = action({
  args: {
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncBatchResult & { started: boolean }> => {
    const { user } = await requireUserFromAction(ctx);
    assertAdmin(user);
    const existing = (await ctx.runQuery(internal.clawhubSync.getLatestClawhubSyncJobInternal, {})) as ClawhubSyncJobDoc | null;
    let job = existing;
    let started = false;
    if (job && isStaleRunningSyncJob(job)) {
      const staleJob = job;
      job = (await ctx.runMutation(internal.clawhubSync.finishClawhubSyncJobInternal, {
        jobId: staleJob._id,
        status: "failed",
        lastError:
          staleJob.lastError ??
          "Recovered stale sync job: marked failed because it was left running without remaining work.",
      })) as ClawhubSyncJobDoc | null;
    }

    if (!job || job.status === "done") {
      let totalCount = 0;
      try {
        totalCount = await fetchClawhubTotalCount(fetch);
      } catch (error) {
        console.error("Failed to fetch ClawHub total count for new job:", error);
      }

      job = (await ctx.runMutation(internal.clawhubSync.createClawhubSyncJobInternal, {
        startedByUserId: user._id,
        localUserId: await ctx.runMutation(internal.clawhubSync.ensureLocalTestUserInternal, {}),
        pageSize: clampInt(args.pageSize ?? CLAWHUB_PAGE_SIZE, 1, MAX_IMPORT_BATCH_ITEMS),
        sourceUrl: "https://clawhub.ai/skills?sort=downloads",
        totalCount,
      })) as ClawhubSyncJobDoc;
      started = true;
    } else if (job.status !== "running") {
      if (!job.totalCount) {
        try {
          const totalCount = await fetchClawhubTotalCount(fetch);
          if (totalCount > 0) {
            await ctx.runMutation(internal.clawhubSync.updateClawhubSyncJobInternal, {
              jobId: job._id,
              totalCount,
            });
          }
        } catch (error) {
          console.error("Failed to fetch ClawHub total count for existing job:", error);
        }
      }

      job = (await ctx.runMutation(internal.clawhubSync.resumeClawhubSyncJobInternal, {
        jobId: job._id,
      })) as ClawhubSyncJobDoc | null;
      started = true;
    }

    if (!job) throw new ConvexError("Unable to create sync job");
    if (!started && job.status === "running") {
      return {
        ok: true,
        jobId: job._id,
        pageCursor: job.cursor ?? null,
        nextCursor: job.cursor ?? null,
        hasMore: job.hasMore,
        imported: job.importedCount,
        skipped: job.skippedCount,
        failed: [],
        started: false,
      };
    }

    await ctx.scheduler.runAfter(0, internal.clawhubSync.syncClawhubCatalogBatch, {
      jobId: job._id,
      cursor: job.cursor,
      pageSize: job.pageSize,
    });
    return {
      ok: true,
      jobId: job._id,
      pageCursor: job.cursor ?? null,
      nextCursor: job.cursor ?? null,
      hasMore: job.hasMore,
      imported: job.importedCount,
      skipped: job.skippedCount,
      failed: [],
      started,
    };
  },
});

export const pauseClawhubCatalogSync = action({
  args: {
    jobId: v.id("clawhubSyncJobs"),
  },
  handler: async (ctx, args): Promise<{ ok: true; jobId: string; status: "paused" }> => {
    const { user } = await requireUserFromAction(ctx);
    assertAdmin(user);
    const job = (await ctx.runMutation(internal.clawhubSync.pauseClawhubSyncJobInternal, {
      jobId: args.jobId,
      reason: "Paused from import page",
    })) as ClawhubSyncJobDoc | null;
    if (!job) throw new ConvexError("Unable to pause sync job");
    return { ok: true, jobId: job._id, status: "paused" };
  },
});

export const syncClawhubCatalogBatch = internalAction({
  args: {
    jobId: v.id("clawhubSyncJobs"),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncBatchResult> => {
    const pageSize = clampInt(args.pageSize ?? CLAWHUB_PAGE_SIZE, 1, 100);
    const job = (await ctx.runQuery(internal.clawhubSync.getClawhubSyncJobByIdInternal, {
      jobId: args.jobId,
    })) as ClawhubSyncJobDoc | null;

    if (!job || job.status !== "running") {
      return {
        ok: true,
        jobId: args.jobId,
        pageCursor: args.cursor ?? null,
        nextCursor: args.cursor ?? null,
        hasMore: false,
        imported: 0,
        skipped: 0,
        failed: [],
      };
    }

    if (job.hasMore === false) {
      await ctx.runMutation(internal.clawhubSync.finishClawhubSyncJobInternal, {
        jobId: args.jobId,
        status: "done",
        lastError: job.lastError,
      });
      return {
        ok: true,
        jobId: args.jobId,
        pageCursor: args.cursor ?? null,
        nextCursor: null,
        hasMore: false,
        imported: 0,
        skipped: 0,
        failed: [],
      };
    }

    try {
      const catalogPage = await fetchClawhubCatalogPage(args.cursor ?? null, pageSize);
      const page = catalogPage.value?.page ?? [];
      const nextCursor = catalogPage.value?.nextCursor ?? null;
      const hasMore = catalogPage.value?.hasMore ?? false;

      let imported = 0;
      let skipped = 0;
      let importedInThisBatch = 0;
      let limitReached = false;
      const failed: Array<{ slug: string; reason: string }> = [];

      for (const item of page) {
        if (importedInThisBatch >= MAX_IMPORT_BATCH_ITEMS) {
          limitReached = true;
          break;
        }

        const currentJob = (await ctx.runQuery(internal.clawhubSync.getClawhubSyncJobByIdInternal, {
          jobId: args.jobId,
        })) as ClawhubSyncJobDoc | null;
        if (!currentJob || currentJob.status !== "running") {
          await ctx.runMutation(internal.clawhubSync.finishClawhubSyncJobInternal, {
            jobId: args.jobId,
            status: "paused",
            lastError: currentJob?.lastError ?? "Paused by user",
          });
          return {
            ok: true,
            jobId: args.jobId,
            pageCursor: args.cursor ?? null,
            nextCursor: args.cursor ?? null,
            hasMore: false,
            imported,
            skipped,
            failed,
          };
        }

        const ownerHandle = item.ownerHandle?.trim();
        const skillSlug = item.skill?.slug?.trim().toLowerCase();
        if (!ownerHandle || !skillSlug) {
          skipped += 1;
          continue;
        }

        try {
          // Fast Skip Check: if local version matches upstream, skip without downloading
          const localSkill = (await ctx.runQuery(internal.skills.getSkillBySlugInternal, {
            slug: skillSlug,
          })) as Doc<"skills"> | null;

          const upstreamVersion = item.latestVersion?.version?.trim();
          const localVersion = localSkill?.latestVersionSummary?.version;

          if (upstreamVersion && localVersion && upstreamVersion === localVersion) {
            skipped += 1;
            continue;
          }

          // Actually process the heavy sync
          const result = await syncClawhubSkillPage(ctx, {
            localUserId: job.localUserId,
            pageUrl: `https://clawhub.ai/${ownerHandle}/${skillSlug}`,
            upstreamSlug: skillSlug,
            upstreamDisplayName: item.skill?.displayName?.trim() || undefined,
            upstreamVersion: item.latestVersion?.version ?? undefined,
            ownerHandle,
            upstreamStats: normalizeUpstreamStats(item.skill?.stats),
          });

          if (result === "imported") {
            imported += 1;
            importedInThisBatch += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          console.error(`Failed to sync skill ${ownerHandle}/${skillSlug}:`, error);
          failed.push({
            slug: skillSlug,
            reason: String(error),
          });
        }
      }

      // If we reached the import limit mid-page, we MUST re-schedule the SAME cursor
      // to continue processing the rest of this page in the next action.
      const shouldResumeSamePage = limitReached;
      const effectiveNextCursor = shouldResumeSamePage ? args.cursor : nextCursor;
      const effectiveHasMore = shouldResumeSamePage ? true : hasMore;

      await ctx.runMutation(internal.clawhubSync.updateClawhubSyncJobInternal, {
        jobId: args.jobId,
        importedDelta: imported,
        skippedDelta: skipped,
        pageCountDelta: shouldResumeSamePage ? 0 : 1,
        cursor: effectiveHasMore ? (effectiveNextCursor ?? undefined) : undefined,
        hasMore: effectiveHasMore,
        totalCount: !effectiveHasMore ? job.importedCount + imported + job.skippedCount + skipped + job.failedCount + failed.length : undefined,
        lastError: failed.length ? `Completed with ${failed.length} failed item(s)` : undefined,
      });

      if (effectiveHasMore) {
        const latestJob = (await ctx.runQuery(internal.clawhubSync.getClawhubSyncJobByIdInternal, {
          jobId: args.jobId,
        })) as ClawhubSyncJobDoc | null;
        if (latestJob && latestJob.status === "running") {
          await ctx.scheduler.runAfter(0, internal.clawhubSync.syncClawhubCatalogBatch, {
            jobId: args.jobId,
            cursor: effectiveNextCursor ?? undefined,
            pageSize,
          });
        }
      } else {
        await ctx.runMutation(internal.clawhubSync.finishClawhubSyncJobInternal, {
          jobId: args.jobId,
          status: "done",
          lastError: failed.length ? `Completed with ${failed.length} failed item(s)` : undefined,
        });
      }

      return {
        ok: true,
        jobId: args.jobId,
        pageCursor: args.cursor ?? null,
        nextCursor: effectiveNextCursor ?? null,
        hasMore: effectiveHasMore,
        imported,
        skipped,
        failed,
      };
    } catch (error) {
      const reason = toErrorMessage(error);
      await ctx.runMutation(internal.clawhubSync.finishClawhubSyncJobInternal, {
        jobId: args.jobId,
        status: "failed",
        lastError: reason,
      });
      throw error;
    }
  },
});

export const ensureLocalTestUserInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("handle", (q) => q.eq("handle", "local"))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("users", {
      handle: "local",
      displayName: "Local Dev",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
  },
});

async function syncClawhubSkillPage(
  ctx: ActionCtx,
  params: {
    localUserId: Id<"users">;
    pageUrl: string;
    ownerHandle: string;
    upstreamDisplayName?: string;
    upstreamVersion?: string;
    upstreamSlug: string;
    upstreamStats?: {
      downloads: number;
      stars: number;
      installsCurrent: number;
      installsAllTime: number;
    } | null;
  },
) {
  const resolved = await resolveClawhubImportPage(params.pageUrl, fetch);
  const targetSlug = await resolveMirrorSlug(ctx, {
    localUserId: params.localUserId,
    ownerHandle: params.ownerHandle,
    upstreamSlug: params.upstreamSlug,
  });
  const existingSkill = await ctx.runQuery(internal.skills.getSkillBySlugInternal, {
    slug: targetSlug,
  });
  const existingVersion = existingSkill?.latestVersionId
    ? await ctx.runQuery(internal.skills.getVersionByIdInternal, {
      versionId: existingSkill.latestVersionId,
    })
    : null;

  let zipBytes: Uint8Array | null = resolved.zipBytes;
  const canonicalUrl = resolved.canonicalUrl;

  let entries: Record<string, Uint8Array> | null = stripGitHubZipRoot(unzipToEntries(zipBytes));
  // Free zipBytes as we now have entries
  zipBytes = null;

  const candidates = detectGitHubImportCandidates(entries);
  const candidate = pickClawhubCandidate(candidates, params.upstreamSlug);
  if (!candidate) {
    throw new ConvexError("No SKILL.md found in this bundle");
  }

  const files = listTextFilesUnderCandidate(entries, candidate.path);
  let fileBytes: Map<string, Uint8Array> | null = new Map(files.map((file) => [file.path, file.bytes]));
  const selectedPaths = selectClawhubImportPaths({ candidate, files, fileBytes });
  if (selectedPaths.length === 0) {
    throw new ConvexError("No files selected");
  }

  let storedFiles: Array<{
    path: string;
    size: number;
    storageId: Id<"_storage">;
    sha256: string;
    contentType?: string;
  }> | null = [];

  let selectedBytes = 0;
  for (const path of selectedPaths.sort()) {
    const bytes = fileBytes.get(path);
    if (!bytes) continue;
    selectedBytes += bytes.byteLength;
    if (selectedBytes > MAX_SELECTED_BYTES) {
      throw new ConvexError("Selected files exceed 50MB limit");
    }

    const relPath = candidate.path
      ? path.startsWith(`${candidate.path}/`)
        ? path.slice(candidate.path.length + 1)
        : path
      : path;
    const sanitized = sanitizePath(relPath);
    if (!sanitized) throw new ConvexError("Invalid file paths");

    const sha256 = await sha256Hex(bytes);
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)], {
      type: "text/plain",
    }));
    storedFiles?.push({
      path: sanitized,
      size: bytes.byteLength,
      storageId,
      sha256,
      contentType: "text/plain",
    });
  }

  if (!storedFiles || storedFiles.length === 0) {
    throw new ConvexError("No files selected");
  }

  const slug = targetSlug;
  const displayName = params.upstreamDisplayName ?? candidate.name ?? toDisplayName(slug);
  const versionBase = params.upstreamVersion?.trim() || "1.0.0";
  const version = existingSkill ? suggestVersion(existingVersion?.version) : versionBase;
  if (!semver.valid(version)) {
    throw new ConvexError("Version must be valid semver");
  }

  await publishVersionForUser(ctx, params.localUserId, {
    slug,
    displayName,
    version,
    changelog: "",
    tags: ["latest"],
    files: storedFiles,
    source: {
      kind: "clawhub",
      url: canonicalUrl,
      repo: buildClawhubSourceRepo({ canonicalUrl }),
      ref: "latest",
      path: candidate.path,
      importedAt: Date.now(),
    },
  }, {
    bypassGitHubAccountAge: true,
    bypassNewSkillRateLimit: true,
    bypassQualityGate: true,
    skipBackup: true,
    skipWebhook: true,
  });

  if (params.upstreamStats) {
    const publishedSkill = (await ctx.runQuery(internal.skills.getSkillBySlugInternal, {
      slug,
    })) as { _id: Id<"skills"> } | null;
    if (publishedSkill?._id) {
      await ctx.runMutation(internal.clawhubSync.updateClawhubSkillStatsInternal, {
        skillId: publishedSkill._id,
        stats: params.upstreamStats,
      });
    }
  }

  // Manual memory management: clear large references
  storedFiles = null;
  fileBytes = null;
  entries = null;

  return "imported" as const;
}

async function resolveMirrorSlug(
  ctx: ActionCtx,
  params: { localUserId: Id<"users">; ownerHandle: string; upstreamSlug: string },
) {
  const primary = normalizeSlug(params.upstreamSlug);
  const current = await ctx.runQuery(internal.skills.getSkillBySlugInternal, { slug: primary });
  if (!current || current.ownerUserId === params.localUserId) {
    return primary;
  }

  const base = normalizeSlug(`${params.ownerHandle}-${params.upstreamSlug}`);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await ctx.runQuery(internal.skills.getSkillBySlugInternal, {
      slug: candidate,
    });
    if (!existing || existing.ownerUserId === params.localUserId) {
      return candidate;
    }
  }

  throw new ConvexError("Could not find an available slug");
}

function pickClawhubCandidate(
  candidates: Array<{ path: string; readmePath: string; name?: string }>,
  upstreamSlug: string,
) {
  const normalizedUpstream = normalizeRepoPath(upstreamSlug);
  return (
    candidates.find((candidate) => normalizeRepoPath(candidate.path) === normalizedUpstream) ??
    candidates.find((candidate) => normalizeRepoPath(candidate.readmePath) === normalizedUpstream) ??
    (candidates.length === 1 ? candidates[0] : candidates[0] ?? null)
  );
}

function selectClawhubImportPaths(params: {
  candidate: { path: string; readmePath: string; name?: string };
  files: Array<{ path: string; bytes: Uint8Array }>;
  fileBytes: Map<string, Uint8Array>;
}) {
  const allPaths = params.files.map((file) => file.path);
  const allBytes = params.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (allBytes <= MAX_SELECTED_BYTES) return allPaths;
  const defaultSelectedPaths = computeDefaultSelectedPaths({
    candidate: params.candidate,
    files: params.files,
  });
  return defaultSelectedPaths.filter((path) => params.fileBytes.has(path));
}

function unzipToEntries(zipBytes: Uint8Array) {
  return unzipToEntriesShared(zipBytes, unzipSync);
}

async function fetchClawhubCatalogPage(cursor: string | null, numItems: number) {
  const args: Record<string, unknown> = {
    dir: "desc",
    highlightedOnly: false,
    nonSuspiciousOnly: false,
    numItems,
    sort: "downloads",
  };
  if (cursor) args.cursor = cursor;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(CLAWHUB_CONVEX_QUERY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "convex-client": "npm-1.34.1",
        origin: "https://clawhub.ai",
        referer: "https://clawhub.ai/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0",
      },
      body: JSON.stringify({
        path: "skills:listPublicPageV4",
        format: "convex_encoded_json",
        args: [args],
      }),
    });
    if (!response.ok) {
      throw new ConvexError(`ClawHub catalog query failed: ${response.status}`);
    }
    return (await response.json()) as ClawhubCatalogPageResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toDisplayName(slug: string) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/--+/g, "-");
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

async function fetchClawhubTotalCount(fetcher: typeof fetch) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetcher(CLAWHUB_CONVEX_QUERY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "convex-client": "npm-1.34.1",
        origin: "https://clawhub.ai",
        referer: "https://clawhub.ai/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0",
      },
      body: JSON.stringify({
        path: "skills:countPublicSkills",
        format: "convex_encoded_json",
        args: [{}],
      }),
    });
    if (!response.ok) return 0;
    const result = (await response.json()) as { value?: number };
    return typeof result.value === "number" ? result.value : 0;
  } catch (error) {
    console.error("Failed to fetch ClawHub total count:", error);
    return 0;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeUpstreamStats(
  stats:
    | {
      downloads?: number | null;
      stars?: number | null;
      installsCurrent?: number | null;
      installsAllTime?: number | null;
    }
    | null
    | undefined,
) {
  if (!stats) return null;
  return {
    downloads: Math.max(0, Math.floor(stats.downloads ?? 0)),
    stars: Math.max(0, Math.floor(stats.stars ?? 0)),
    installsCurrent: Math.max(0, Math.floor(stats.installsCurrent ?? 0)),
    installsAllTime: Math.max(0, Math.floor(stats.installsAllTime ?? 0)),
  };
}
