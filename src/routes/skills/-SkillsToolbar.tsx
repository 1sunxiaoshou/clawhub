import {
  Check,
  ChevronDown,
  Grid3X3,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { useI18n } from "../../lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

type SkillsToolbarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  query: string;
  hasQuery: boolean;
  sort: string;
  view: "cards" | "list";
  highlightedOnly: boolean;
  nonSuspiciousOnly: boolean;
  onQueryChange: (next: string) => void;
  onToggleHighlighted: () => void;
  onToggleNonSuspicious: () => void;
  onSortChange: (value: string) => void;
  onToggleView: () => void;
};

export function SkillsToolbar({
  searchInputRef,
  query,
  hasQuery,
  sort,
  view,
  highlightedOnly,
  nonSuspiciousOnly,
  onQueryChange,
  onToggleHighlighted,
  onToggleNonSuspicious,
  onSortChange,
  onToggleView,
}: SkillsToolbarProps) {
  const { t } = useI18n();
  const sortLabel = (() => {
    switch (sort) {
      case "relevance":
        return t("skills.relevance");
      case "newest":
        return t("skills.newest");
      case "updated":
        return t("skills.updated");
      case "downloads":
        return t("skills.downloads");
      case "installs":
        return t("skills.installs");
      case "stars":
        return t("skills.stars");
      case "name":
        return t("skills.name");
      default:
        return t("skills.sortSkills");
    }
  })();

  return (
    <div className="flex flex-row gap-2.5 flex-wrap relative z-20">
      {/* Search area */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[color:var(--ink-soft)] pointer-events-none opacity-60" />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("skills.searchPlaceholder")}
          className="w-full h-10 pl-10 pr-10 rounded-[8px] bg-white dark:bg-[#111b31] border border-[#E6E9EF] dark:border-[rgba(255,255,255,0.1)] text-sm text-[color:var(--ink)] placeholder:opacity-30 outline-none tracking-tight focus:border-[#D6DAE2] transition-all duration-200"
          type="text"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]"
            aria-label={t("skills.clearSearch")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Sort Dropdown */}
      <div className="relative">
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-10 px-4 rounded-[8px] bg-white dark:bg-[#111b31] border border-[#E6E9EF] dark:border-[rgba(255,255,255,0.1)] text-sm text-[color:var(--ink)] outline-none cursor-pointer tracking-tight font-medium flex items-center gap-1.5 whitespace-nowrap hover:bg-[#F9F9F9] dark:hover:bg-[#16233d] transition-colors duration-200">
              <span>{sortLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-40 transition-transform duration-200" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasQuery && (
              <DropdownMenuItem onClick={() => onSortChange("relevance")}>
                {t("skills.relevance")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onSortChange("newest")}>
              {t("skills.newest")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("updated")}>
              {t("skills.updated")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("downloads")}>
              {t("skills.downloads")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("installs")}>
              {t("skills.installs")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("stars")}>
              {t("skills.stars")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("name")}>
              {t("skills.name")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Advanced Filter Button */}
      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t("skills.sortSkills")}
              className="w-10 h-10 rounded-[8px] bg-white dark:bg-[#111b31] border border-[#E6E9EF] dark:border-[rgba(255,255,255,0.1)] flex items-center justify-center cursor-pointer hover:bg-[#F9F9F9] dark:hover:bg-[#16233d] transition-colors duration-200"
            >
              <SlidersHorizontal className="w-4 h-4 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t("skills.displayOptions")}
            </div>
            <DropdownMenuItem onClick={onToggleView}>
              <div className="flex items-center gap-2">
                {view === "cards" ? <List className="h-3.5 w-3.5" /> : <Grid3X3 className="h-3.5 w-3.5" />}
                {view === "cards" ? t("skills.listView") : t("skills.gridView")}
              </div>
            </DropdownMenuItem>

            <div className="h-px bg-border my-1" />

            <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t("common.filters")}
            </div>
            <DropdownMenuItem onClick={onToggleHighlighted}>
              <div className="flex items-center gap-2">
                <Check className={`h-3.5 w-3.5 ${highlightedOnly ? "opacity-100" : "opacity-0"}`} />
                {t("skills.staffPicks")}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleNonSuspicious}>
              <div className="flex items-center gap-2">
                <Check className={`h-3.5 w-3.5 ${nonSuspiciousOnly ? "opacity-100" : "opacity-0"}`} />
                {t("skills.cleanOnly")}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
