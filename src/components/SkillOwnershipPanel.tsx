import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "../lib/i18n";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { buildSkillHref } from "./skillDetailUtils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type OwnedSkillOption = {
  _id: Id<"skills">;
  slug: string;
  displayName: string;
};

type SkillOwnershipPanelProps = {
  skillId: Id<"skills">;
  slug: string;
  ownerHandle: string | null;
  ownerId: Id<"users"> | Id<"publishers"> | null;
  ownedSkills: OwnedSkillOption[];
};

function formatMutationError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message
      .replace(/\[CONVEX[^\]]*\]\s*/g, "")
      .replace(/\[Request ID:[^\]]*\]\s*/g, "")
      .replace(/^Server Error Called by client\s*/i, "")
      .replace(/^ConvexError:\s*/i, "")
      .trim();
  }
  return fallback;
}

export function SkillOwnershipPanel({
  skillId,
  slug,
  ownerHandle,
  ownerId,
  ownedSkills,
}: SkillOwnershipPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const renameOwnedSkill = useMutation(api.skills.renameOwnedSkill);
  const mergeOwnedSkillIntoCanonical = useMutation(api.skills.mergeOwnedSkillIntoCanonical);

  const [renameSlug, setRenameSlug] = useState(slug);
  const [mergeTargetSlug, setMergeTargetSlug] = useState(ownedSkills[0]?.slug ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRename, setConfirmRename] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);

  const ownerHref = (nextSlug: string) => buildSkillHref(ownerHandle, ownerId, nextSlug);

  const handleRename = async () => {
    const nextSlug = renameSlug.trim().toLowerCase();
    if (!nextSlug || nextSlug === slug) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await renameOwnedSkill({ slug, newSlug: nextSlug });
      toast.success(t("skillDetail.ownership.renamedToast", { slug: nextSlug }));
      await navigate({
        to: "/$owner/$slug",
        params: {
          owner: ownerHandle ?? String(ownerId ?? ""),
          slug: nextSlug,
        },
        replace: true,
      });
    } catch (renameError) {
      setError(formatMutationError(renameError, t("common.error")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerge = async () => {
    const targetSlug = mergeTargetSlug.trim().toLowerCase();
    if (!targetSlug || targetSlug === slug) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await mergeOwnedSkillIntoCanonical({
        sourceSlug: slug,
        targetSlug,
      });
      toast.success(t("skillDetail.ownership.mergedToast", { slug: targetSlug }));
      await navigate({
        to: "/$owner/$slug",
        params: {
          owner: ownerHandle ?? String(ownerId ?? ""),
          slug: targetSlug,
        },
        replace: true,
      });
    } catch (mergeError) {
      setError(formatMutationError(mergeError, t("common.error")));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card
        className="border-[color:var(--border-ui)]/30 bg-[color:var(--surface-muted)]/50"
        data-skill-id={skillId}
      >
        <CardHeader>
          <CardTitle className="text-base">{t("skillDetail.ownership.title")}</CardTitle>
          <CardDescription>
            {t("skillDetail.ownership.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Rename */}
            <div className="flex flex-col gap-2">
              <Label>{t("skillDetail.ownership.renameSlug")}</Label>
              <Input
                value={renameSlug}
                onChange={(event) => setRenameSlug(event.target.value)}
                placeholder="new-slug"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="text-xs text-[color:var(--ink-soft)]">
                {t("skillDetail.ownership.currentPage", { url: ownerHref(slug) })}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("skillDetail.ownership.renameAction")}</Label>
              <Button
                variant="outline"
                onClick={() => setConfirmRename(true)}
                disabled={isSubmitting || renameSlug.trim().toLowerCase() === slug}
              >
                {t("skillDetail.ownership.renameAndRedirect")}
              </Button>
            </div>

            {/* Merge */}
            <div className="flex flex-col gap-2">
              <Label>{t("skillDetail.ownership.mergeInto")}</Label>
              <select
                className="w-full min-h-[44px] rounded-[var(--radius-sm)] border border-[rgba(29,59,78,0.22)] bg-[rgba(255,255,255,0.94)] px-3.5 py-[13px] text-[color:var(--ink)] dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(14,28,37,0.84)]"
                value={mergeTargetSlug}
                onChange={(event) => setMergeTargetSlug(event.target.value)}
                disabled={ownedSkills.length === 0 || isSubmitting}
              >
                {ownedSkills.length === 0 ? <option value="">{t("skillDetail.ownership.noOtherOwnedSkills")}</option> : null}
                {ownedSkills.map((entry) => (
                  <option key={entry._id} value={entry.slug}>
                    {entry.displayName} ({entry.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("skillDetail.ownership.mergeAction")}</Label>
              <Button
                variant="outline"
                onClick={() => setConfirmMerge(true)}
                disabled={isSubmitting || !mergeTargetSlug}
              >
                {t("skillDetail.ownership.mergeIntoTarget")}
              </Button>
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <p className="mt-3 text-xs text-[color:var(--ink-soft)]">
            {t("skillDetail.ownership.mergeDesc")}
          </p>
        </CardContent>
      </Card>

      {/* Rename confirmation dialog */}
      <Dialog open={confirmRename} onOpenChange={setConfirmRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skillDetail.ownership.renameConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("skillDetail.ownership.renameConfirmDesc", { oldSlug: slug, newSlug: renameSlug.trim().toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRename(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              loading={isSubmitting}
              onClick={() => {
                void handleRename().finally(() => setConfirmRename(false));
              }}
            >
              {t("skillDetail.ownership.renameAction").split(" ")[0]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge confirmation dialog */}
      <Dialog open={confirmMerge} onOpenChange={setConfirmMerge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skillDetail.ownership.mergeConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("skillDetail.ownership.mergeConfirmDesc", { oldSlug: slug, newSlug: mergeTargetSlug.trim().toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMerge(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              loading={isSubmitting}
              onClick={() => {
                void handleMerge().finally(() => setConfirmMerge(false));
              }}
            >
              {t("skillDetail.ownership.mergeIntoTarget")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
