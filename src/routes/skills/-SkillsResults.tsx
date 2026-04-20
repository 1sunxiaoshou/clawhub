import { Loader2 } from "lucide-react";
import type { RefObject } from "react";
import { EmptyState } from "../../components/EmptyState";
import { SkillListItem } from "../../components/SkillListItem";
import { useI18n } from "../../lib/i18n";
import { SkillCardSkeletonGrid } from "../../components/skeletons/SkillCardSkeleton";
import { SkillCard } from "../../components/SkillCard";
import { getPlatformLabels } from "../../components/skillDetailUtils";
import { SkillStatsTripletLine } from "../../components/SkillStats";
import { Button } from "../../components/ui/button";
import { UserBadge } from "../../components/UserBadge";
import { getSkillBadges } from "../../lib/badges";
import { buildSkillHref, type SkillListEntry } from "./-types";

type SkillsResultsProps = {
  isLoadingSkills: boolean;
  sorted: SkillListEntry[];
  view: "cards" | "list";
  listDoneLoading: boolean;
  hasQuery: boolean;
  canLoadMore: boolean;
  isLoadingMore: boolean;
  canAutoLoad: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  loadMore: () => void;
};

export function SkillsResults({
  isLoadingSkills,
  sorted,
  view,
  listDoneLoading,
  hasQuery,
  canLoadMore,
  isLoadingMore,
  canAutoLoad,
  loadMoreRef,
  loadMore,
}: SkillsResultsProps) {
  const { t } = useI18n();

  return (
    <>
      {isLoadingSkills ? (
        <SkillCardSkeletonGrid count={6} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={listDoneLoading || hasQuery ? t("skills.noMatch") : t("skills.loading")}
          description={hasQuery ? t("skills.tryAdjusting") : undefined}
        />
      ) : view === "cards" ? (
        <div className="skills-card-grid">
          {sorted.map((entry) => {
            const skill = entry.skill;
            const clawdis = entry.latestVersion?.parsed?.clawdis;
            const isPlugin = Boolean(clawdis?.nix?.plugin);
            const platforms = getPlatformLabels(clawdis?.os, clawdis?.nix?.systems);
            const ownerHandle = entry.owner?.handle ?? entry.ownerHandle ?? null;
            const skillHref = buildSkillHref(skill, ownerHandle);
            return (
              <SkillCard
                key={skill._id}
                skill={skill}
                href={skillHref}
                badge={getSkillBadges(skill)}
                chip={isPlugin ? t("skills.pluginChip") : undefined}
                platformLabels={platforms.length ? platforms : undefined}
                summaryFallback={t("skills.fallbackSummary")}
                meta={
                  <div className="skill-card-footer-rows">
                    <UserBadge
                      user={entry.owner}
                      fallbackHandle={ownerHandle}
                      prefix={t("common.by")}
                      link={false}
                    />
                    <div className="stat">
                      <SkillStatsTripletLine stats={skill.stats} />
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--surface)]">
          {sorted.map((entry) => {
            const skill = entry.skill;
            const ownerHandle = entry.owner?.handle ?? entry.ownerHandle ?? null;
            return (
              <SkillListItem
                key={skill._id}
                skill={skill}
                ownerHandle={ownerHandle}
                owner={entry.owner}
              />
            );
          })}
        </div>
      )}

      {/* Load more */}
      {(canLoadMore || isLoadingMore) && (
        <div ref={canAutoLoad ? loadMoreRef : null} className="flex justify-center pt-4">
          {canAutoLoad ? (
            isLoadingMore ? (
              <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink-soft)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("skills.loadingMore")}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--ink-soft)]">{t("skills.scrollToLoad")}</div>
            )
          ) : (
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoadingMore}
              loading={isLoadingMore}
            >
              {t("skills.loadMore")}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
