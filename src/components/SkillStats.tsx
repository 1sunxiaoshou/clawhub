import { Package } from "lucide-react";
import { formatSkillStatsTriplet, type SkillStatsTriplet } from "../lib/numberFormat";

type SkillMetricsStats = SkillStatsTriplet & {
  versions: number;
};

export function SkillStatsTripletLine({ stats }: { stats: SkillStatsTriplet }) {
  const formatted = formatSkillStatsTriplet(stats);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <span aria-hidden="true">⭐</span>
        <span>{formatted.stars}</span>
      </span>
      <span aria-hidden="true" className="opacity-45">
        ·
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Package size={13} aria-hidden="true" />
        <span>{formatted.downloads}</span>
      </span>
    </span>
  );
}

export function SkillMetricsRow({ stats }: { stats: SkillMetricsStats }) {
  const formatted = formatSkillStatsTriplet(stats);
  return (
    <>
      <span className="inline-flex w-14 items-center justify-end gap-1 tabular-nums">
        <Package size={13} aria-hidden="true" /> {formatted.downloads}
      </span>
      <span className="inline-flex w-14 items-center justify-end gap-1 tabular-nums">
        ★ {formatted.stars}
      </span>
      <span className="inline-flex w-14 items-center justify-end gap-1 tabular-nums">
        {stats.versions} v
      </span>
    </>
  );
}
