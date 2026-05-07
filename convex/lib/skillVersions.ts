import type { Doc, Id } from "../_generated/dataModel";

const PLATFORM_SKILL_LICENSE = "MIT-0" as const;

export type PublicSkillListVersion = Pick<
  Doc<"skillVersions">,
  "_id" | "_creationTime" | "version" | "createdAt" | "changelog" | "changelogSource"
> & {
  parsed?: PublicSkillVersionParsed;
};

type PublicSkillVersionParsed = {
  license?: typeof PLATFORM_SKILL_LICENSE;
  clawdis?: {
    os?: string[];
    nix?: {
      plugin?: boolean;
      systems?: string[];
    };
  };
};

export type PublicSkillVersion = {
  _id: Id<"skillVersions">;
  _creationTime?: number;
  skillId?: Id<"skills">;
  version: string;
  fingerprint?: string;
  changelog?: string;
  changelogSource?: Doc<"skillVersions">["changelogSource"];
  files: Array<{
    path: string;
    size: number;
    sha256: string;
    contentType?: string;
  }>;
  parsed?: PublicSkillVersionParsed;
  createdBy?: Id<"users">;
  createdAt?: number;
  softDeletedAt?: number;
  capabilityTags?: string[];
  sha256hash?: string;
  vtAnalysis?: Doc<"skillVersions">["vtAnalysis"];
  llmAnalysis?: Doc<"skillVersions">["llmAnalysis"];
  staticScan?: {
    status: NonNullable<Doc<"skillVersions">["staticScan"]>["status"];
    reasonCodes: NonNullable<Doc<"skillVersions">["staticScan"]>["reasonCodes"];
    findings: Array<{
      code: string;
      severity: "info" | "warn" | "critical";
      file: string;
      line: number;
      message: string;
      evidence: string;
    }>;
    summary: NonNullable<Doc<"skillVersions">["staticScan"]>["summary"];
    engineVersion: NonNullable<Doc<"skillVersions">["staticScan"]>["engineVersion"];
    checkedAt: NonNullable<Doc<"skillVersions">["staticScan"]>["checkedAt"];
  };
};

export function toPublicSkillListVersion(
  version: Doc<"skillVersions"> | null,
): PublicSkillListVersion | null {
  if (!version) return null;
  return {
    _id: version._id,
    _creationTime: version._creationTime,
    version: version.version,
    createdAt: version.createdAt,
    changelog: version.changelog,
    changelogSource: version.changelogSource,
    parsed:
      version.parsed?.clawdis || version.parsed?.license
        ? {
            ...(version.parsed?.license ? { license: version.parsed.license } : {}),
            ...(version.parsed?.clawdis ? { clawdis: version.parsed.clawdis } : {}),
          }
        : undefined,
  };
}

export function toPublicSkillVersion(
  version: Doc<"skillVersions"> | null | undefined,
): PublicSkillVersion | null {
  if (!version) return null;
  return {
    _id: version._id,
    _creationTime: version._creationTime,
    skillId: version.skillId,
    version: version.version,
    fingerprint: version.fingerprint,
    changelog: version.changelog,
    changelogSource: version.changelogSource,
    files: (version.files ?? []).map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
      contentType: file.contentType,
    })),
    parsed: version.parsed
      ? {
          license: version.parsed.license,
          clawdis: version.parsed.clawdis,
        }
      : undefined,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    softDeletedAt: version.softDeletedAt,
    capabilityTags: version.capabilityTags,
    sha256hash: version.sha256hash,
    vtAnalysis: version.vtAnalysis,
    llmAnalysis: version.llmAnalysis,
    staticScan: version.staticScan
      ? {
          status: version.staticScan.status,
          reasonCodes: version.staticScan.reasonCodes,
          findings: (version.staticScan.findings ?? []).map((finding) => ({
            code: finding.code,
            severity: finding.severity,
            file: finding.file,
            line: finding.line,
            message: finding.message,
            evidence: "",
          })),
          summary: version.staticScan.summary,
          engineVersion: version.staticScan.engineVersion,
          checkedAt: version.staticScan.checkedAt,
        }
      : undefined,
  };
}

export function toPublicSkillListVersionFromSummary(
  summary: NonNullable<Doc<"skills">["latestVersionSummary"]>,
  latestVersionId: Id<"skillVersions"> | undefined,
): PublicSkillListVersion | null {
  if (!latestVersionId) return null;
  return {
    _id: latestVersionId,
    // Approximates _creationTime; both are set to `now` in the same transaction.
    _creationTime: summary.createdAt,
    version: summary.version,
    createdAt: summary.createdAt,
    changelog: summary.changelog,
    changelogSource: summary.changelogSource,
    parsed: summary.clawdis ? { clawdis: summary.clawdis } : undefined,
  };
}
