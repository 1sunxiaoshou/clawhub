import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Copy, Flag, History, Shield, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { SKILL_CAPABILITY_TAGS } from "../../convex/lib/skillCapabilityTags";
import { EmptyState } from "../components/EmptyState";
import { Container } from "../components/layout/Container";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import {
  getSkillBadges,
  isSkillDeprecated,
  isSkillHighlighted,
  isSkillOfficial,
} from "../lib/badges";
import { getUserFacingConvexError } from "../lib/convexError";
import { isAdmin, isModerator } from "../lib/roles";
import { useAuthStatus } from "../lib/useAuthStatus";
import { useI18n } from "../lib/i18n";

const SKILL_CAPABILITY_LABELS: Record<string, string> = {
  crypto: "Crypto / DeFi",
  "requires-wallet": "Requires wallet",
  "can-make-purchases": "Can make purchases",
  "can-sign-transactions": "Can sign transactions",
  "requires-oauth-token": "Requires OAuth token",
  "posts-externally": "Posts externally",
};

const SKILL_AUDIT_LOG_LIMIT = 10;

type ManagementUserSummary = {
  _id: Id<"users">;
  handle?: string | null;
  name?: string | null;
  displayName?: string | null;
};

type SkillAuditLogEntry = {
  _id: Id<"auditLogs">;
  action: string;
  metadata?: unknown;
  createdAt: number;
  actor: ManagementUserSummary | null;
};

type ManagementSkillEntry = {
  skill: Doc<"skills">;
  latestVersion: Doc<"skillVersions"> | null;
  owner: Doc<"users"> | null;
};

type ReportReasonEntry = {
  reason: string;
  createdAt: number;
  reporterHandle: string | null;
  reporterId: Id<"users">;
};

type ReportedSkillEntry = ManagementSkillEntry & {
  reports: ReportReasonEntry[];
};

type RecentVersionEntry = {
  version: Doc<"skillVersions">;
  skill: Doc<"skills"> | null;
  owner: Doc<"users"> | null;
};

type DuplicateCandidateEntry = {
  skill: Doc<"skills">;
  latestVersion: Doc<"skillVersions"> | null;
  fingerprint: string | null;
  matches: Array<{ skill: Doc<"skills">; owner: Doc<"users"> | null }>;
  owner: Doc<"users"> | null;
};

type SkillBySlugResult = {
  skill: Doc<"skills">;
  latestVersion: Doc<"skillVersions"> | null;
  owner: Doc<"users"> | null;
  overrideReviewer: ManagementUserSummary | null;
  auditLogs: SkillAuditLogEntry[];
  canonical: {
    skill: { slug: string; displayName: string };
    owner: { handle: string | null; userId: Id<"users"> | null };
  } | null;
} | null;

function resolveOwnerParam(
  handle: string | null | undefined,
  ownerId?: Id<"users"> | Id<"publishers">,
) {
  return handle?.trim().toLowerCase() || (ownerId ? String(ownerId) : "unknown");
}

function promptBanReason(label: string) {
  const result = window.prompt(`Ban reason for ${label} (optional)`);
  if (result === null) return null;
  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function promptUnbanReason(label: string) {
  const result = window.prompt(`Unban reason for ${label} (optional)`);
  if (result === null) return null;
  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const Route = createFileRoute("/management")({
  validateSearch: (search) => ({
    skill: typeof search.skill === "string" && search.skill.trim() ? search.skill : undefined,
  }),
  component: Management,
});

function Management() {
  const { me } = useAuthStatus();
  const { t, formatDateTime, locale } = useI18n();
  const search = Route.useSearch();
  const staff = isModerator(me);
  const admin = isAdmin(me);

  const selectedSlug = search.skill?.trim();
  const selectedSkill = useQuery(
    api.skills.getBySlugForStaff,
    staff && selectedSlug ? { slug: selectedSlug, auditLogLimit: SKILL_AUDIT_LOG_LIMIT } : "skip",
  ) as SkillBySlugResult | undefined;
  const selectedSkillId = selectedSkill?.skill?._id ?? null;
  const recentVersions = useQuery(api.skills.listRecentVersions, staff ? { limit: 20 } : "skip") as
    | RecentVersionEntry[]
    | undefined;
  const reportedSkills = useQuery(api.skills.listReportedSkills, staff ? { limit: 25 } : "skip") as
    | ReportedSkillEntry[]
    | undefined;
  const duplicateCandidates = useQuery(
    api.skills.listDuplicateCandidates,
    staff ? { limit: 20 } : "skip",
  ) as DuplicateCandidateEntry[] | undefined;

  const setRole = useMutation(api.users.setRole);
  const banUser = useMutation(api.users.banUser);
  const unbanUser = useMutation(api.users.unbanUser);
  const setBatch = useMutation(api.skills.setBatch);
  const setSoftDeleted = useMutation(api.skills.setSoftDeleted);
  const hardDelete = useMutation(api.skills.hardDelete);
  const changeOwner = useMutation(api.skills.changeOwner);
  const setDuplicate = useMutation(api.skills.setDuplicate);
  const setOfficialBadge = useMutation(api.skills.setOfficialBadge);
  const setDeprecatedBadge = useMutation(api.skills.setDeprecatedBadge);
  const setSkillManualOverride = useMutation(api.skills.setSkillManualOverride);
  const clearSkillManualOverride = useMutation(api.skills.clearSkillManualOverride);
  const setSkillCapabilityTags = useMutation(api.skills.setSkillCapabilityTags);

  const [selectedDuplicate, setSelectedDuplicate] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportSearchDebounced, setReportSearchDebounced] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userSearchDebounced, setUserSearchDebounced] = useState("");
  const [skillOverrideNote, setSkillOverrideNote] = useState("");

  const userQuery = userSearchDebounced.trim();
  const userResult = useQuery(
    api.users.list,
    admin ? { limit: 200, search: userQuery || undefined } : "skip",
  ) as { items: Doc<"users">[]; total: number } | undefined;

  const selectedOwnerUserId = selectedSkill?.skill?.ownerUserId ?? null;
  const selectedCanonicalSlug = selectedSkill?.canonical?.skill?.slug ?? "";

  useEffect(() => {
    if (!selectedSkillId || !selectedOwnerUserId) return;
    setSelectedDuplicate(selectedCanonicalSlug);
    setSelectedOwner(String(selectedOwnerUserId));
  }, [selectedCanonicalSlug, selectedOwnerUserId, selectedSkillId]);

  useEffect(() => {
    setSkillOverrideNote("");
  }, [selectedSkillId]);

  useEffect(() => {
    const handle = setTimeout(() => setReportSearchDebounced(reportSearch), 250);
    return () => clearTimeout(handle);
  }, [reportSearch]);

  useEffect(() => {
    const handle = setTimeout(() => setUserSearchDebounced(userSearch), 250);
    return () => clearTimeout(handle);
  }, [userSearch]);

  const toggleSkillCapabilityTag = (tag: string, checked: boolean) => {
    if (!selectedSkill?.skill) return;
    const currentTags = new Set(
      selectedSkill.latestVersion?.capabilityTags ?? selectedSkill.skill.capabilityTags ?? [],
    );
    if (checked) currentTags.add(tag);
    else currentTags.delete(tag);
    void setSkillCapabilityTags({
      skillId: selectedSkill.skill._id,
      capabilityTags: SKILL_CAPABILITY_TAGS.filter((entry) => currentTags.has(entry)),
    }).catch((error) => toast.error(formatMutationError(error)));
  };

  if (!staff) {
    return (
      <main className="py-10">
        <Container size="wide">
          <Card>
            <CardContent>{t("management.title")} staff only.</CardContent>
          </Card>
        </Container>
      </main>
    );
  }

  if (!recentVersions || !reportedSkills || !duplicateCandidates) {
    return (
      <main className="py-10">
        <Container size="wide">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </Container>
      </main>
    );
  }

  const reportQuery = reportSearchDebounced.trim().toLowerCase();
  const filteredReportedSkills = reportQuery
    ? reportedSkills.filter((entry) => {
        const reportReasons = (entry.reports ?? []).map((report) => report.reason).join(" ");
        const reporterHandles = (entry.reports ?? [])
          .map((report) => report.reporterHandle)
          .filter(Boolean)
          .join(" ");
        const haystack = [
          entry.skill.displayName,
          entry.skill.slug,
          entry.owner?.handle,
          entry.owner?.name,
          reportReasons,
          reporterHandles,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(reportQuery);
      })
    : reportedSkills;
  const reportCountLabel =
    filteredReportedSkills.length === 0 && reportedSkills.length > 0
      ? t("management.noMatchingReports")
      : t("management.noReportsYet");
  const reportSummary = t("management.showingOf", {
    count: filteredReportedSkills.length.toLocaleString(locale),
    total: reportedSkills.length.toLocaleString(locale),
  });

  const filteredUsers = userResult?.items ?? [];
  const userTotal = userResult?.total ?? 0;
  const userSummary = userResult
    ? t("management.showingOf", {
        count: filteredUsers.length.toLocaleString(locale),
        total: userTotal.toLocaleString(locale),
      })
    : t("common.loading");
  const userEmptyLabel = userResult
    ? filteredUsers.length === 0
      ? userQuery
        ? t("management.noMatchingReports")
        : t("management.noReportsYet")
      : ""
    : t("common.loading");

  const applySkillOverride = () => {
    if (!selectedSkill?.skill) return;
    void setSkillManualOverride({
      skillId: selectedSkill.skill._id,
      note: skillOverrideNote,
    })
      .then(() => {
        setSkillOverrideNote("");
      })
      .catch((error) => toast.error(formatMutationError(error)));
  };

  const clearSkillOverride = () => {
    if (!selectedSkill?.skill?.manualOverride) return;
    void clearSkillManualOverride({
      skillId: selectedSkill.skill._id,
      note: skillOverrideNote,
    })
      .then(() => {
        setSkillOverrideNote("");
      })
      .catch((error) => toast.error(formatMutationError(error)));
  };

  function formatTimestamp(value: number) {
    return formatDateTime(value);
  }

  function formatMutationError(error: unknown) {
    return getUserFacingConvexError(error, t("common.error"));
  }

  function formatManualOverrideState(
    override:
      | {
          verdict: string;
          note: string;
          reviewerUserId: string;
          updatedAt: number;
        }
      | null
      | undefined,
    reviewer?: ManagementUserSummary | null,
  ) {
    if (!override) return t("management.auditSummary.noOverride");
    return `${formatVerdictLabel(override.verdict)} · ${t("management.auditSummary.reviewer")} ${formatManagementUserLabel(reviewer, override.reviewerUserId)} · ${t("management.auditSummary.updated")} ${formatTimestamp(
      override.updatedAt,
    )} · ${override.note}`;
  }

  function formatManagementUserLabel(
    user: ManagementUserSummary | null | undefined,
    fallbackId?: string | null,
  ) {
    if (user?.handle?.trim()) return `@${user.handle.trim()}`;
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (user?.name?.trim()) return user.name.trim();
    if (fallbackId?.trim()) return fallbackId.trim();
    return t("management.auditSummary.unknownUser");
  }

  function formatAuditActionLabel(action: string, metadata?: unknown) {
    const record = asAuditMetadataRecord(metadata);
    if (action === "skill.manual_override.set") {
      const verdict = typeof record?.verdict === "string" ? record.verdict : "unknown";
      return t("management.auditSummary.overrideSetTo", { verdict: formatVerdictLabel(verdict) });
    }
    if (action === "skill.manual_override.clear") {
      return t("management.auditSummary.overrideCleared");
    }
    if (action === "skill.owner.change") {
      return t("management.auditSummary.ownerChanged");
    }
    if (action === "skill.duplicate.set") {
      return t("management.auditSummary.duplicateSet");
    }
    if (action === "skill.duplicate.clear") {
      return t("management.auditSummary.duplicateCleared");
    }
    if (action === "skill.auto_hide") {
      return t("management.auditSummary.autoHidden");
    }
    if (action === "skill.hard_delete") {
      return t("management.auditSummary.hardDeleted");
    }
    if (action.startsWith("skill.transfer.")) {
      return t("management.auditSummary.transfer", {
        action: action.slice("skill.transfer.".length).replaceAll("_", " "),
      });
    }
    if (action.startsWith("skill.")) {
      return action.slice("skill.".length).replaceAll(".", " ").replaceAll("_", " ");
    }
    return action.replaceAll(".", " ").replaceAll("_", " ");
  }

  function formatAuditMetadataSummary(action: string, metadata?: unknown) {
    const record = asAuditMetadataRecord(metadata);
    if (!record) return null;

    if (action === "skill.manual_override.set") {
      const note = typeof record.note === "string" ? record.note.trim() : "";
      if (note) return note;
      const previousVerdict = typeof record.previousVerdict === "string" ? record.previousVerdict : null;
      return previousVerdict
        ? t("management.auditSummary.previousVerdict", { verdict: formatVerdictLabel(previousVerdict) })
        : null;
    }

    if (action === "skill.manual_override.clear") {
      const note = typeof record.note === "string" ? record.note.trim() : "";
      if (note) return note;
      const previousVerdict = typeof record.previousVerdict === "string" ? record.previousVerdict : null;
      return previousVerdict
        ? t("management.auditSummary.previousOverrideVerdict", { verdict: formatVerdictLabel(previousVerdict) })
        : null;
    }

    if (action === "skill.owner.change") {
      const from = typeof record.from === "string" ? record.from : null;
      const to = typeof record.to === "string" ? record.to : null;
      if (from || to) {
        return t("management.auditSummary.fromTo", {
          from: from ?? t("management.auditSummary.unknownUser"),
          to: to ?? t("management.auditSummary.unknownUser"),
        });
      }
    }

    if (action === "skill.duplicate.set") {
      return typeof record.canonicalSlug === "string"
        ? t("management.auditSummary.canonicalSkill", { slug: record.canonicalSlug })
        : null;
    }

    if (action === "skill.duplicate.clear") {
      return t("management.auditSummary.canonicalCleared");
    }

    if (action === "skill.auto_hide") {
      return typeof record.reportCount === "number"
        ? t("management.auditSummary.activeReportsCount", { count: record.reportCount })
        : null;
    }

    if (action === "skill.hard_delete") {
      return typeof record.slug === "string"
        ? t("management.auditSummary.deletedSlug", { slug: record.slug })
        : null;
    }

    if (typeof record.note === "string" && record.note.trim()) {
      return record.note.trim();
    }
    if (typeof record.reason === "string" && record.reason.trim()) {
      return record.reason.trim();
    }
    return null;
  }

  function formatVerdictLabel(verdict: string) {
    return verdict === "clean" ? t("management.auditSummary.okay") : verdict;
  }

  return (
    <main className="py-10">
      <Container size="wide">
        <h1 className="font-display text-2xl font-bold text-[color:var(--ink)]">
          {t("management.title")}
        </h1>
        <p className="text-sm text-[color:var(--ink-soft)]">
          {t("management.description")}
        </p>

        <Separator className="my-6" />

        {/* Reported skills */}
        <Card>
          <CardHeader>
            <CardTitle>{t("management.reportedSkills")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{t("management.filter")}</span>
                <Input
                  type="search"
                  placeholder={t("management.searchReported")}
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                />
              </div>
              <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                {reportSummary}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {filteredReportedSkills.length === 0 ? (
                <EmptyState icon={Flag} title={reportCountLabel} />
              ) : (
                filteredReportedSkills.map((entry) => {
                  const { skill, latestVersion, owner, reports } = entry;
                  const ownerParam = resolveOwnerParam(
                    owner?.handle ?? null,
                    owner?._id ?? skill.ownerUserId,
                  );
                  const reportEntries = reports ?? [];
                  return (
                    <div
                      key={skill._id}
                      className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
                    >
                      <div className="flex flex-1 flex-col gap-2">
                        <Link to="/$owner/$slug" params={{ owner: ownerParam, slug: skill.slug }}>
                          {skill.displayName}
                        </Link>
                        <div className="text-sm text-[color:var(--ink-soft)]">
                          @{owner?.handle ?? owner?.name ?? "user"} · v
                          {latestVersion?.version ?? "—"} ·{" "}
                          {t("skills.count", { count: skill.reportCount ?? 0 })}
                          {skill.lastReportedAt
                            ? ` · ${t("management.auditSummary.updated")} ${formatTimestamp(skill.lastReportedAt)}`
                            : ""}
                        </div>
                        {reportEntries.length > 0 ? (
                          <div className="flex flex-col gap-2 border-l-2 border-[color:var(--line)] pl-4">
                            {reportEntries.map((report) => (
                              <div
                                key={`${report.reporterId}-${report.createdAt}`}
                                className="flex flex-col gap-1"
                              >
                                <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                                  {formatTimestamp(report.createdAt)}
                                  {report.reporterHandle ? ` · @${report.reporterHandle}` : ""}
                                </span>
                                <span>{report.reason}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-[color:var(--ink-soft)]">
                            {t("management.noReportsYet")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                                <Button asChild variant="outline" size="sm">
                          <Link to="/management" search={{ skill: skill.slug }}>
                            {t("management.manage")}
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const action = skill.softDeletedAt
                              ? t("management.restore")
                              : t("management.hide");
                            const reason = window.prompt(
                              `${action} reason for "${skill.displayName}"`,
                            );
                            if (!reason?.trim()) return;
                            void setSoftDeleted({
                              skillId: skill._id,
                              deleted: !skill.softDeletedAt,
                              reason: reason.trim(),
                            }).catch((error) => toast.error(formatMutationError(error)));
                          }}
                        >
                          {skill.softDeletedAt ? t("management.restore") : t("management.hide")}
                        </Button>
                        {admin ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Hard delete ${skill.displayName}?`)) return;
                              void hardDelete({ skillId: skill._id });
                            }}
                          >
                            {t("management.hardDelete")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        {/* Skill tools */}
        <Card>
          <CardHeader>
            <CardTitle>{t("management.skillTools")}</CardTitle>
            {selectedSlug ? (
              <p className="text-sm text-[color:var(--ink-soft)]">
                {t("management.manage")} &ldquo;{selectedSlug}&rdquo; &middot;{" "}
                <Link to="/management" search={{ skill: undefined }}>
                  {t("management.clearSelection")}
                </Link>
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {!selectedSlug ? (
                <EmptyState
                  icon={Shield}
                  title={t("management.noSkillSelected")}
                  description={t("management.noSkillSelectedDesc")}
                />
              ) : selectedSkill === undefined ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : !selectedSkill?.skill ? (
                <EmptyState
                  icon={Shield}
                  title={t("management.noSkillFound", { slug: selectedSlug })}
                />
              ) : (
                (() => {
                  const { skill, latestVersion, owner, canonical, overrideReviewer, auditLogs } =
                    selectedSkill;
                  const ownerParam = resolveOwnerParam(
                    owner?.handle ?? null,
                    owner?._id ?? skill.ownerUserId,
                  );
                  const moderationStatus =
                    skill.moderationStatus ?? (skill.softDeletedAt ? "hidden" : "active");
                  const isHighlighted = isSkillHighlighted(skill);
                  const isOfficial = isSkillOfficial(skill);
                  const isDeprecated = isSkillDeprecated(skill);
                  const badges = getSkillBadges(skill);
                  const capabilityTags =
                    latestVersion?.capabilityTags ?? skill.capabilityTags ?? [];
                  const ownerUserId = skill.ownerUserId ?? selectedOwnerUserId;
                  const ownerHandle = owner?.handle ?? owner?.name ?? "user";
                  const isOwnerAdmin = owner?.role === "admin";
                  const canBanOwner =
                    staff && ownerUserId && ownerUserId !== me?._id && (admin || !isOwnerAdmin);

                  return (
                    <div
                      key={skill._id}
                      className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--surface)] p-6"
                    >
                      <div className="flex flex-1 flex-col gap-2">
                        <Link to="/$owner/$slug" params={{ owner: ownerParam, slug: skill.slug }}>
                          {skill.displayName}
                        </Link>
                        <div className="text-sm text-[color:var(--ink-soft)]">
                          @{owner?.handle ?? owner?.name ?? "user"} · v
                          {latestVersion?.version ?? "—"} · {t("management.auditSummary.updated")}{" "}
                          {formatTimestamp(skill.updatedAt)} · {moderationStatus}
                          {badges.length ? ` · ${badges.join(", ").toLowerCase()}` : ""}
                        </div>
                        {skill.moderationFlags?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {skill.moderationFlags.map((flag: string) => (
                              <Badge key={flag}>{flag}</Badge>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-2 border-l-2 border-[color:var(--line)] pl-4">
                          <div className="text-sm text-[color:var(--ink-soft)]">
                            {t("management.capabilityTags")}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {SKILL_CAPABILITY_TAGS.map((tag) => (
                              <label key={tag} className="flex items-center gap-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  checked={capabilityTags.includes(tag)}
                                  onChange={(event) =>
                                    toggleSkillCapabilityTag(tag, event.target.checked)
                                  }
                                />
                                <span>{t(`skills.capabilities.${tag}`) || SKILL_CAPABILITY_LABELS[tag] || tag}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border-l-2 border-[color:var(--line)] pl-4">
                          <div className="text-sm text-[color:var(--ink-soft)]">
                            {t("management.manualOverrides")}
                          </div>
                          <Card>
                            <CardContent>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                                  {t("management.currentOverride")}
                                </span>
                                <span>
                                  {formatManualOverrideState(
                                    skill.manualOverride,
                                    overrideReviewer,
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                                  {t("management.latestVersion")}
                                </span>
                                <span>
                                  {latestVersion
                                    ? `v${latestVersion.version}`
                                    : t("dashboard.noSkillsTitle")}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                                  {t("management.behavior")}
                                </span>
                                <span>{t("management.behaviorDesc")}</span>
                              </div>
                              <Textarea
                                rows={4}
                                placeholder={
                                  skill.manualOverride
                                    ? t("management.overrideNoteRequiredUpdate")
                                    : t("management.overrideNoteRequiredMark")
                                }
                                value={skillOverrideNote}
                                onChange={(event) => setSkillOverrideNote(event.target.value)}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!skillOverrideNote.trim()}
                                  onClick={applySkillOverride}
                                >
                                  {skill.manualOverride
                                    ? t("management.updateOkayOverride")
                                    : t("management.markSkillOkay")}
                                </Button>
                                {skill.manualOverride ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!skillOverrideNote.trim()}
                                    onClick={clearSkillOverride}
                                  >
                                    {t("management.clearSkillOverride")}
                                  </Button>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        <div className="flex flex-col gap-2 border-l-2 border-[color:var(--line)] pl-4">
                          <div className="text-sm text-[color:var(--ink-soft)]">
                            {t("management.recentAuditActivity")}
                          </div>
                          <Card>
                            <CardContent>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                                  {t("management.recentAuditActivity")}
                                </span>
                                <span>{t("management.windowDesc", { limit: SKILL_AUDIT_LOG_LIMIT })}</span>
                              </div>
                              {auditLogs.length === 0 ? (
                                <div className="text-sm text-[color:var(--ink-soft)]">
                                  {t("management.noAuditActivity")}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  {auditLogs.map((entry) => {
                                    const auditSummary = formatAuditMetadataSummary(
                                      entry.action,
                                      entry.metadata,
                                    );
                                    return (
                                      <div
                                        key={entry._id}
                                        className="flex flex-col gap-1 border-b border-[color:var(--line)] pb-3 last:border-0"
                                      >
                                        <div className="flex flex-col gap-1">
                                          <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                                            {formatTimestamp(entry.createdAt)} &middot;{" "}
                                            {formatManagementUserLabel(entry.actor)}
                                          </span>
                                          <span>
                                            {formatAuditActionLabel(entry.action, entry.metadata)}
                                          </span>
                                        </div>
                                        {auditSummary ? (
                                          <div className="text-xs text-[color:var(--ink-soft)]">
                                            {auditSummary}
                                          </div>
                                        ) : null}
                                        {entry.metadata ? (
                                          <details className="text-xs">
                                            <summary>{t("management.metadata")}</summary>
                                            <pre className="mt-1 overflow-x-auto rounded bg-[color:var(--surface-muted)] p-3 font-mono text-xs">
                                              {JSON.stringify(entry.metadata, null, 2)}
                                            </pre>
                                          </details>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex flex-col gap-2">
                            <span className="font-mono text-xs">{t("management.duplicateOf")}</span>
                            <Input
                              value={selectedDuplicate}
                              onChange={(event) => setSelectedDuplicate(event.target.value)}
                              placeholder={canonical?.skill?.slug ?? t("management.canonicalSlug")}
                            />
                          </label>
                          <div className="flex flex-col gap-2">
                            <span className="font-mono text-xs">{t("management.duplicateOf")} action</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void setDuplicate({
                                  skillId: skill._id,
                                  canonicalSlug: selectedDuplicate.trim() || undefined,
                                })
                              }
                            >
                              {t("management.setDuplicate")}
                            </Button>
                          </div>
                          {admin ? (
                            <>
                              <label className="flex flex-col gap-2">
                                <span className="font-mono text-xs">{t("management.owner")}</span>
                                <select
                                  className="w-full min-h-[44px] rounded-[var(--radius-sm)] border border-[rgba(29,59,78,0.22)] bg-[rgba(255,255,255,0.94)] px-3.5 py-[13px] text-[color:var(--ink)] transition-all duration-[180ms] ease-out dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(14,28,37,0.84)]"
                                  value={selectedOwner}
                                  onChange={(event) => setSelectedOwner(event.target.value)}
                                >
                                  {filteredUsers.map((user) => (
                                    <option key={user._id} value={user._id}>
                                      @{user.handle ?? user.name ?? t("common.user")}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="flex flex-col gap-2">
                                <span className="font-mono text-xs">{t("management.owner")} action</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    void changeOwner({
                                      skillId: skill._id,
                                      ownerUserId: selectedOwner as Doc<"users">["_id"],
                                    })
                                  }
                                >
                                  {t("management.changeOwner")}
                                </Button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to="/$owner/$slug" params={{ owner: ownerParam, slug: skill.slug }}>
                            {t("management.view")}
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const action = skill.softDeletedAt ? t("management.restore") : t("management.hide");
                            const reason = window.prompt(
                              `${action} reason for "${skill.displayName}"`,
                            );
                            if (!reason?.trim()) return;
                            void setSoftDeleted({
                              skillId: skill._id,
                              deleted: !skill.softDeletedAt,
                              reason: reason.trim(),
                            }).catch((error) => toast.error(formatMutationError(error)));
                          }}
                        >
                          {skill.softDeletedAt ? t("management.restore") : t("management.hide")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void setBatch({
                              skillId: skill._id,
                              batch: isHighlighted ? undefined : "highlighted",
                            })
                          }
                        >
                          {isHighlighted ? t("management.unhighlight") : t("management.highlight")}
                        </Button>
                        {admin ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Hard delete ${skill.displayName}?`)) return;
                              void hardDelete({ skillId: skill._id });
                            }}
                          >
                            {t("management.hardDelete")}
                          </Button>
                        ) : null}
                        {staff ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canBanOwner}
                            onClick={() => {
                              if (!ownerUserId || ownerUserId === me?._id) return;
                              if (!window.confirm(`Ban @${ownerHandle} and delete their skills?`)) {
                                return;
                              }
                              const reason = promptBanReason(`@${ownerHandle}`);
                              if (reason === null) return;
                              void banUser({ userId: ownerUserId, reason });
                            }}
                          >
                            {t("management.banUser")}
                          </Button>
                        ) : null}
                        {admin ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void setOfficialBadge({
                                  skillId: skill._id,
                                  official: !isOfficial,
                                })
                              }
                            >
                              {isOfficial ? t("management.removeOfficial") : t("management.markOfficial")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void setDeprecatedBadge({
                                  skillId: skill._id,
                                  deprecated: !isDeprecated,
                                })
                              }
                            >
                              {isDeprecated ? t("management.removeDeprecated") : t("management.markDeprecated")}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        {/* Duplicate candidates */}
        <Card>
          <CardHeader>
            <CardTitle>{t("management.duplicateCandidates")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {duplicateCandidates.length === 0 ? (
                <EmptyState icon={Copy} title={t("management.noDuplicateCandidates")} />
              ) : (
                duplicateCandidates.map((entry) => (
                  <div
                    key={entry.skill._id}
                    className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
                  >
                    <div className="flex flex-1 flex-col gap-2">
                      <Link
                        to="/$owner/$slug"
                        params={{
                          owner: resolveOwnerParam(
                            entry.owner?.handle ?? null,
                            entry.owner?._id ?? entry.skill.ownerUserId,
                          ),
                          slug: entry.skill.slug,
                        }}
                      >
                        {entry.skill.displayName}
                      </Link>
                      <div className="text-sm text-[color:var(--ink-soft)]">
                        @{entry.owner?.handle ?? entry.owner?.name ?? "user"} · v
                        {entry.latestVersion?.version ?? "—"} · fingerprint{" "}
                        {entry.fingerprint?.slice(0, 8)}
                      </div>
                      <div className="flex flex-col gap-2 border-l-2 border-[color:var(--line)] pl-4">
                        {entry.matches.map((match) => (
                          <div
                            key={match.skill._id}
                            className="flex items-start justify-between gap-4 py-2 text-sm text-[color:var(--ink-soft)]"
                          >
                            <div>
                              <strong>{match.skill.displayName}</strong>
                              <div className="text-sm text-[color:var(--ink-soft)]">
                                @{match.owner?.handle ?? match.owner?.name ?? "user"} &middot;{" "}
                                {match.skill.slug}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  to="/$owner/$slug"
                                  params={{
                                    owner: resolveOwnerParam(
                                      match.owner?.handle ?? null,
                                      match.owner?._id ?? match.skill.ownerUserId,
                                    ),
                                    slug: match.skill.slug,
                                  }}
                                >
                                  {t("management.view")}
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void setDuplicate({
                                    skillId: entry.skill._id,
                                    canonicalSlug: match.skill.slug,
                                  })
                                }
                              >
                                {t("management.setDuplicate")}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to="/$owner/$slug"
                          params={{
                            owner: resolveOwnerParam(
                              entry.owner?.handle ?? null,
                              entry.owner?._id ?? entry.skill.ownerUserId,
                            ),
                            slug: entry.skill.slug,
                          }}
                        >
                          {t("management.view")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        {/* Recent pushes */}
        <Card>
          <CardHeader>
            <CardTitle>{t("management.recentPushes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {recentVersions.length === 0 ? (
                <EmptyState icon={History} title={t("management.noRecentVersions")} />
              ) : (
                recentVersions.map((entry) => (
                  <div
                    key={entry.version._id}
                    className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
                  >
                    <div className="flex flex-1 flex-col gap-2">
                      <strong>{entry.skill?.displayName ?? t("management.unknownSkill")}</strong>
                      <div className="text-sm text-[color:var(--ink-soft)]">
                        v{entry.version.version} · @
                        {entry.owner?.handle ?? entry.owner?.name ?? t("settings.userFallback")}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.skill ? (
                        <Button asChild variant="outline" size="sm">
                          <Link to="/management" search={{ skill: entry.skill.slug }}>
                            {t("management.manage")}
                          </Link>
                        </Button>
                      ) : null}
                      {entry.skill ? (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to="/$owner/$slug"
                            params={{
                              owner: resolveOwnerParam(
                                entry.owner?.handle ?? null,
                                entry.owner?._id ?? entry.skill.ownerUserId,
                              ),
                              slug: entry.skill.slug,
                            }}
                          >
                            {t("management.view")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {admin ? (
          <>
            <Separator className="my-6" />

            {/* Users */}
            <Card>
              <CardHeader>
                <CardTitle>{t("management.users")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{t("management.filter")}</span>
                    <Input
                      type="search"
                      placeholder={t("management.searchUsers")}
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                    />
                  </div>
                  <span className="text-xs font-medium text-[color:var(--ink-soft)]">
                    {userSummary}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {filteredUsers.length === 0 ? (
                    <EmptyState icon={Users} title={userEmptyLabel || t("management.noUsers")} />
                  ) : (
                    filteredUsers.map((user) => (
                      <div
                        key={user._id}
                        className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
                      >
                        <div className="flex flex-1 flex-col gap-2">
                          <span className="font-mono text-xs">
                            @{user.handle ?? user.name ?? "user"}
                          </span>
                          {user.deletedAt || user.deactivatedAt ? (
                            <div className="text-sm text-[color:var(--ink-soft)]">
                              {user.banReason && user.deletedAt
                                ? `Banned ${formatTimestamp(user.deletedAt)} · ${user.banReason}`
                                : `Deleted ${formatTimestamp((user.deactivatedAt ?? user.deletedAt) as number)}`}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="min-h-[34px] rounded-[var(--radius-sm)] border border-[rgba(29,59,78,0.22)] bg-[rgba(255,255,255,0.94)] px-2 py-1 text-xs text-[color:var(--ink)] dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(14,28,37,0.84)]"
                            value={user.role ?? "user"}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "admin" || value === "moderator" || value === "user") {
                                void setRole({ userId: user._id, role: value });
                              }
                            }}
                          >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={user._id === me?._id}
                            onClick={() => {
                              if (user._id === me?._id) return;
                              if (
                                !window.confirm(
                                  `Ban @${user.handle ?? user.name ?? "user"} and delete their skills?`,
                                )
                              ) {
                                return;
                              }
                              const label = `@${user.handle ?? user.name ?? "user"}`;
                              const reason = promptBanReason(label);
                              if (reason === null) return;
                              void banUser({ userId: user._id, reason }).catch((error) =>
                                toast.error(formatMutationError(error)),
                              );
                            }}
                          >
                            Ban user
                          </Button>
                          {user.deletedAt && !user.deactivatedAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const label = `@${user.handle ?? user.name ?? "user"}`;
                                if (
                                  !window.confirm(`Unban ${label} and restore eligible skills?`)
                                ) {
                                  return;
                                }
                                const reason = promptUnbanReason(label);
                                if (reason === null) return;
                                void unbanUser({ userId: user._id, reason }).catch((error) =>
                                  toast.error(formatMutationError(error)),
                                );
                              }}
                            >
                              Unban user
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Container>
    </main>
  );
}

function asAuditMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}
