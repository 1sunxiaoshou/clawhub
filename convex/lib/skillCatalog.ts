import type { Doc } from "../_generated/dataModel";
import { canListSkillPublicly } from "./skillAccess";
import { digestToOwnerInfo } from "./skillSearchDigest";

const SKILL_CATALOG_CURSOR_PREFIX = "skillcat:";

export type PublicSkillCatalogItem = {
  name: string;
  displayName: string;
  family: "skill";
  runtimeId: null;
  channel: "official" | "community";
  isOfficial: boolean;
  summary: string | null;
  ownerHandle: string | null;
  createdAt: number;
  updatedAt: number;
  latestVersion: string | null;
  capabilityTags: string[];
  executesCode: false;
  verificationTier: null;
};

type SkillCatalogCursorState = {
  cursor: string | null;
  offset: number;
  pageSize: number | null;
  done: boolean;
};

export function encodeSkillCatalogCursor(state: SkillCatalogCursorState) {
  if (state.done && state.offset === 0) return "";
  return `${SKILL_CATALOG_CURSOR_PREFIX}${JSON.stringify(state)}`;
}

export function decodeSkillCatalogCursor(raw: string | null | undefined): SkillCatalogCursorState {
  if (!raw) return { cursor: null, offset: 0, pageSize: null, done: false };
  if (!raw.startsWith(SKILL_CATALOG_CURSOR_PREFIX)) {
    return { cursor: raw, offset: 0, pageSize: null, done: false };
  }
  try {
    const parsed = JSON.parse(
      raw.slice(SKILL_CATALOG_CURSOR_PREFIX.length),
    ) as Partial<SkillCatalogCursorState>;
    return {
      cursor: typeof parsed.cursor === "string" ? parsed.cursor : null,
      offset: typeof parsed.offset === "number" && parsed.offset > 0 ? parsed.offset : 0,
      pageSize: typeof parsed.pageSize === "number" && parsed.pageSize > 0 ? parsed.pageSize : null,
      done: parsed.done === true,
    };
  } catch {
    return { cursor: null, offset: 0, pageSize: null, done: false };
  }
}

function isSkillCatalogOfficial(digest: Doc<"skillSearchDigest">) {
  return Boolean(digest.badges?.official);
}

function getSkillCatalogChannel(digest: Doc<"skillSearchDigest">): "official" | "community" {
  return isSkillCatalogOfficial(digest) ? "official" : "community";
}

function isVisibleSkillCatalogDigest(digest: Doc<"skillSearchDigest">) {
  if (!canListSkillPublicly(digest)) return false;
  const ownerInfo = digestToOwnerInfo(digest);
  return Boolean(ownerInfo?.owner);
}

export function skillCatalogMatchesFilters(
  digest: Doc<"skillSearchDigest">,
  args: {
    channel?: "official" | "community" | "private";
    isOfficial?: boolean;
    executesCode?: boolean;
    capabilityTag?: string;
  },
) {
  if (!isVisibleSkillCatalogDigest(digest)) return false;
  if (args.channel === "private") return false;
  if (args.executesCode === true) return false;
  const isOfficial = isSkillCatalogOfficial(digest);
  const channel = getSkillCatalogChannel(digest);
  if (typeof args.isOfficial === "boolean" && isOfficial !== args.isOfficial) return false;
  if (args.channel && channel !== args.channel) return false;
  if (args.capabilityTag && !(digest.capabilityTags ?? []).includes(args.capabilityTag))
    return false;
  return true;
}

export function toPublicSkillCatalogItem(
  digest: Doc<"skillSearchDigest">,
): PublicSkillCatalogItem {
  const ownerInfo = digestToOwnerInfo(digest);
  return {
    name: digest.slug,
    displayName: digest.displayName,
    family: "skill",
    runtimeId: null,
    channel: getSkillCatalogChannel(digest),
    isOfficial: isSkillCatalogOfficial(digest),
    summary: digest.summary ?? null,
    ownerHandle: ownerInfo?.ownerHandle ?? null,
    createdAt: digest.createdAt,
    updatedAt: digest.updatedAt,
    latestVersion: digest.latestVersionSummary?.version ?? null,
    capabilityTags: digest.capabilityTags ?? [],
    executesCode: false,
    verificationTier: null,
  };
}

export function scoreSkillCatalogResult(digest: Doc<"skillSearchDigest">, queryText: string) {
  const needle = queryText.toLowerCase();
  const slug = digest.slug.toLowerCase();
  const display = digest.displayName.toLowerCase();
  const summary = (digest.summary ?? "").toLowerCase();
  let score = 0;
  if (slug === needle) score += 200;
  else if (slug.startsWith(needle)) score += 120;
  else if (slug.includes(needle)) score += 80;

  if (display === needle) score += 150;
  else if (display.startsWith(needle)) score += 70;
  else if (display.includes(needle)) score += 40;

  if (summary.includes(needle)) score += 20;
  if (isSkillCatalogOfficial(digest)) score += 5;
  return score;
}
