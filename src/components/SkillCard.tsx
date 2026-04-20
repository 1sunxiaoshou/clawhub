import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { PublicSkill } from "../lib/publicUser";
import { MarketplaceIcon } from "./MarketplaceIcon";
import { Badge } from "./ui/badge";

type SkillCardProps = {
  skill: PublicSkill;
  badge?: string | string[];
  chip?: string;
  platformLabels?: string[];
  summaryFallback: string;
  meta: ReactNode;
  href?: string;
  verified?: boolean;
};

export function SkillCard({
  skill,
  badge,
  chip,
  platformLabels,
  summaryFallback,
  meta,
  href,
  verified,
}: SkillCardProps) {
  const owner = encodeURIComponent(String(skill.ownerUserId));
  const link = href ?? `/${owner}/${skill.slug}`;
  const badges = Array.isArray(badge) ? badge : badge ? [badge] : [];
  const hasTags = badges.length || chip || platformLabels?.length;

  return (
    <Link to={link} className="card skill-card">
      {hasTags ? (
        <div className="skill-card-tags">
          {badges.map((label) => (
            <Badge key={label}>
              {label}
            </Badge>
          ))}
          {chip ? <Badge variant="accent">{chip}</Badge> : null}
          {platformLabels?.map((label) => (
            <Badge key={label} variant="compact">
              {label}
            </Badge>
          ))}
          {verified && (
            <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ) : null}
      <div className="skill-card-header">
        <MarketplaceIcon kind="skill" label={skill.displayName} size="md" />
        <h3 className="skill-card-title">{skill.displayName}</h3>
      </div>
      <p className="skill-card-summary">{skill.summary ?? summaryFallback}</p>
      <div className="skill-card-footer">
        {meta}
      </div>
    </Link>
  );
}
