import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useRef } from "react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "../../lib/i18n";
import { SKILL_CAPABILITY_TAGS } from "../../../convex/lib/skillCapabilityTags";
import { SKILL_CATEGORIES, type SkillCategory } from "../../lib/categories";
import { SkillsResults } from "./-SkillsResults";
import { SkillsToolbar } from "./-SkillsToolbar";
import { parseSort } from "./-params";
import { useSkillsBrowseModel, type SkillsSearchState } from "./-useSkillsBrowseModel";

const SKILL_CAPABILITY_TAG_SET = new Set<string>(SKILL_CAPABILITY_TAGS);

export const Route = createFileRoute("/skills/")({
  validateSearch: (search): SkillsSearchState => {
    return {
      q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
      sort: typeof search.sort === "string" ? parseSort(search.sort) : undefined,
      dir: search.dir === "asc" || search.dir === "desc" ? search.dir : undefined,
      highlighted:
        search.highlighted === "1" || search.highlighted === "true" || search.highlighted === true
          ? true
          : undefined,
      nonSuspicious:
        search.nonSuspicious === "1" ||
        search.nonSuspicious === "true" ||
        search.nonSuspicious === true
          ? true
          : undefined,
      tag:
        typeof search.tag === "string" && SKILL_CAPABILITY_TAG_SET.has(search.tag)
          ? search.tag
          : undefined,
      view: search.view === "cards" || search.view === "list" ? search.view : undefined,
      focus: search.focus === "search" ? "search" : undefined,
    };
  },
  beforeLoad: ({ search }) => {
    const hasQuery = Boolean(search.q?.trim());
    if (hasQuery || search.sort) return;
    throw redirect({
      to: "/skills",
      search: {
        q: search.q || undefined,
        sort: "downloads",
        dir: search.dir || undefined,
        highlighted: search.highlighted || undefined,
        nonSuspicious: search.nonSuspicious || undefined,
        tag: search.tag || undefined,
        view: search.view || undefined,
        focus: search.focus || undefined,
      },
      replace: true,
    });
  },
  component: SkillsIndex,
});

export function SkillsIndex() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const totalSkills = useQuery(api.skills.countPublicSkills);
  const { t, locale } = useI18n();
  const totalSkillsText =
    typeof totalSkills === "number" ? totalSkills.toLocaleString(locale) : null;

  const model = useSkillsBrowseModel({
    navigate,
    search,
    searchInputRef,
  });

  const handleCategoryChange = (cat: SkillCategory | undefined) => {
    if (!cat) {
      model.onQueryChange("");
    } else if (cat.slug === "other") {
      model.onQueryChange("__other__");
    } else if (cat.keywords[0]) {
      model.onQueryChange(cat.keywords[0]);
    } else {
      model.onQueryChange("");
    }
  };

  const activeCategory =
    model.query === "__other__"
      ? "other"
      : !model.query
        ? undefined
        : SKILL_CATEGORIES.find((c) =>
            c.keywords.some((k) => k === model.query.trim().toLowerCase()),
          )?.slug;

  return (
    <main className="flex-1 flex flex-col">
      <div className="min-h-screen pb-[53px]">
        <div className="section-container-wide">
          {/* Hero Section */}
          <div className="mb-[16px]">
            <div className="flex-1 min-w-0">
              <div className="animate-glass-reveal">
                <h1 className="text-[48px] font-semibold tracking-tight text-[color:var(--ink)] mb-[10px] md:text-[56px]">
                  {t("skills.title")}
                </h1>
              </div>

              {/* Category Pills */}
              <div className="animate-glass-reveal delay-1 overflow-x-auto scrollbar-none mt-[8px]">
                <div className="flex flex-col gap-2 pb-1 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      onClick={() => handleCategoryChange(undefined)}
                      className={`pill whitespace-nowrap ${!activeCategory ? "pill-active" : "pill-inactive"}`}
                    >
                      {t("skills.allCategories")}
                    </button>
                    {SKILL_CATEGORIES.map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`pill whitespace-nowrap ${activeCategory === cat.slug ? "pill-active" : "pill-inactive"}`}
                      >
                        {t(`skills.categories.${cat.slug}`) || cat.label}
                      </button>
                    ))}
                  </div>
                  <p className="shrink-0 text-sm font-medium text-[color:var(--ink-soft)] md:text-right">
                    {t("skills.collectedCount", { count: totalSkillsText ?? "..." })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="animate-glass-reveal delay-2">
            {/* Toolbar */}
            <div className="mb-[18px]">
              <SkillsToolbar
                searchInputRef={searchInputRef}
                query={model.query}
                hasQuery={model.hasQuery}
                sort={model.sort}
                view={model.view}
                highlightedOnly={model.highlightedOnly}
                nonSuspiciousOnly={model.nonSuspiciousOnly}
                onQueryChange={model.onQueryChange}
                onToggleHighlighted={model.onToggleHighlighted}
                onToggleNonSuspicious={model.onToggleNonSuspicious}
                onSortChange={model.onSortChange}
                onToggleView={model.onToggleView}
              />
            </div>

            {/* Results count info */}
            {model.sorted.length > 0 && model.hasQuery && (
              <p className="mb-4 text-xs font-medium text-[color:var(--ink-soft)]">
                {model.sorted.length.toLocaleString(locale)}
                {totalSkillsText ? ` ${t("skills.of")} ${totalSkillsText}` : ""}{" "}
                {t("skills.count", { count: model.sorted.length })}
                {` ${t("skills.matching")} "${model.query}"`}
              </p>
            )}

            {/* Results */}
            <SkillsResults
              isLoadingSkills={model.isLoadingSkills}
              sorted={model.sorted}
              view={model.view}
              listDoneLoading={!model.isLoadingSkills && !model.canLoadMore && !model.isLoadingMore}
              hasQuery={model.hasQuery}
              canLoadMore={model.canLoadMore}
              isLoadingMore={model.isLoadingMore}
              canAutoLoad={model.canAutoLoad}
              loadMoreRef={model.loadMoreRef}
              loadMore={model.loadMore}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
