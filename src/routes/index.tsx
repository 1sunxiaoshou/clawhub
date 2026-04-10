import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { InstallSwitcher } from "../components/InstallSwitcher";
import { Container } from "../components/layout/Container";
import { SkillCardSkeletonGrid } from "../components/skeletons/SkillCardSkeleton";
import { SkillCard } from "../components/SkillCard";
import { SkillStatsTripletLine } from "../components/SkillStats";
import { SoulCard } from "../components/SoulCard";
import { SoulStatsTripletLine } from "../components/SoulStats";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { UserBadge } from "../components/UserBadge";
import { convexHttp } from "../convex/client";
import { getSkillBadges } from "../lib/badges";
import { useI18n } from "../lib/i18n";
import type { PublicPublisher, PublicSkill, PublicSoul } from "../lib/publicUser";
import { getSiteMode } from "../lib/site";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const mode = getSiteMode();
  return mode === "souls" ? <OnlyCrabsHome /> : <SkillsHome />;
}

function SkillsHome() {
  type SkillPageEntry = {
    skill: PublicSkill;
    ownerHandle?: string | null;
    owner?: PublicPublisher | null;
    latestVersion?: unknown;
  };

  const [highlighted, setHighlighted] = useState<SkillPageEntry[]>([]);
  const [popular, setPopular] = useState<SkillPageEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { t } = useI18n();
  const totalSkills = useQuery(api.skills.countPublicSkills);
  const totalSkillsText =
    typeof totalSkills === "number" ? totalSkills.toLocaleString() : null;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      convexHttp
        .query(api.skills.listHighlightedPublic, { limit: 6 })
        .then((r) => {
          if (!cancelled) setHighlighted(r as SkillPageEntry[]);
        })
        .catch(() => {}),
      convexHttp
        .query(api.skills.listPublicPageV4, {
          numItems: 12,
          sort: "downloads",
          dir: "desc",
          nonSuspiciousOnly: true,
        })
        .then((r) => {
          if (!cancelled) setPopular((r as { page: SkillPageEntry[] }).page);
        })
        .catch(() => {}),
    ]).then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-7">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-5 fade-up" data-delay="1">
              <span className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--accent)]/10 px-4 py-1.5 text-xs font-bold text-[color:var(--accent)]">
                {t("home.heroBadge")}
              </span>
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.6rem)] font-extrabold leading-[1.1] tracking-tight text-[color:var(--ink)]">
                {t("home.heroTitle")}
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-[color:var(--ink-soft)]">
                {t("home.heroDescription")}
              </p>
              {/* Stats bar */}
              {totalSkillsText && (
                <p className="text-sm font-semibold text-[color:var(--ink-soft)]">
                  {t("home.skillsAvailable", { count: totalSkillsText })}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/skills"
                  search={{
                    q: undefined,
                    sort: undefined,
                    dir: undefined,
                    highlighted: undefined,
                    nonSuspicious: true,
                    view: undefined,
                    focus: undefined,
                  }}
                >
                  <Button variant="primary" size="lg">
                    {t("home.browseSkills")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/publish-skill" search={{ updateSlug: undefined }}>
                  <Button variant="outline" size="lg">
                    {t("home.publishSkill")}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hero-card hero-search-card fade-up" data-delay="2">
              <div className="hero-install" style={{ marginTop: 18 }}>
                <div className="text-sm font-semibold text-[color:var(--ink-soft)]">
                  {t("home.heroPanelTitle")}
                </div>
                <InstallSwitcher exampleSlug="sonoscli" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Staff Picks */}
      <section className="py-12">
        <Container>
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-[color:var(--ink)]">
                  {t("home.staffPicks")}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                  {t("home.staffPicksDescription")}
                </p>
              </div>
              <Link
                to="/skills"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  highlighted: true,
                  nonSuspicious: undefined,
                  view: undefined,
                  focus: undefined,
                }}
                className="hidden text-sm font-semibold text-[color:var(--accent)] hover:underline sm:block"
              >
                {t("home.viewAll")}
              </Link>
            </div>
            {!loaded && highlighted.length === 0 ? (
              <SkillCardSkeletonGrid count={6} />
            ) : highlighted.length === 0 ? (
              <p className="text-sm text-[color:var(--ink-soft)]">{t("home.noHighlightedSkills")}</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
                {highlighted.map((entry) => (
                  <SkillCard
                    key={entry.skill._id}
                    skill={entry.skill}
                    badge={getSkillBadges(entry.skill)}
                    summaryFallback="A fresh skill bundle."
                    meta={
                      <>
                        <UserBadge
                          user={entry.owner}
                          fallbackHandle={entry.ownerHandle ?? null}
                          prefix="by"
                          link={false}
                        />
                        <span className="text-[0.8rem] text-[color:var(--ink-soft)]">
                          <SkillStatsTripletLine stats={entry.skill.stats} />
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Popular */}
      <section className="py-12">
        <Container>
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl font-bold text-[color:var(--ink)]">
                {t("home.popularSkills")}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                {t("home.popularSkillsDescription")}
              </p>
            </div>
            {!loaded && popular.length === 0 ? (
              <SkillCardSkeletonGrid count={6} />
            ) : popular.length === 0 ? (
              <p className="text-sm text-[color:var(--ink-soft)]">{t("home.noSkills")}</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
                {popular.map((entry) => (
                  <SkillCard
                    key={entry.skill._id}
                    skill={entry.skill}
                    summaryFallback="Agent-ready skill pack."
                    meta={
                      <>
                        <UserBadge
                          user={entry.owner}
                          fallbackHandle={entry.ownerHandle ?? null}
                          prefix="by"
                          link={false}
                        />
                        <span className="text-[0.8rem] text-[color:var(--ink-soft)]">
                          <SkillStatsTripletLine stats={entry.skill.stats} />
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
            )}
            <div className="flex justify-center pt-4">
              <Link
                to="/skills"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  highlighted: undefined,
                  nonSuspicious: true,
                  view: undefined,
                  focus: undefined,
                }}
              >
                <Button variant="outline">
                  {t("home.seeAllSkills")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}

function OnlyCrabsHome() {
  const navigate = Route.useNavigate();
  const ensureSoulSeeds = useAction(api.seed.ensureSoulSeeds);
  const { t } = useI18n();
  const latest = (useQuery(api.souls.list, { limit: 12 }) as PublicSoul[]) ?? [];
  const [query, setQuery] = useState("");
  const seedEnsuredRef = useRef(false);
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (seedEnsuredRef.current) return;
    seedEnsuredRef.current = true;
    void ensureSoulSeeds({});
  }, [ensureSoulSeeds]);

  return (
    <main>
      <section className="relative overflow-hidden py-20 px-7">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-5 fade-up" data-delay="1">
              <span className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--accent)]/10 px-4 py-1.5 text-xs font-bold text-[color:var(--accent)]">
                {t("home.soulsHeroBadge")}
              </span>
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.6rem)] font-extrabold leading-[1.1] tracking-tight text-[color:var(--ink)]">
                {t("home.soulsHeroTitle")}
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-[color:var(--ink-soft)]">
                {t("home.soulsHeroDescription")}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link to="/publish-skill" search={{ updateSlug: undefined }}>
                  <Button variant="primary" size="lg">
                    {t("home.publishSoul")}
                  </Button>
                </Link>
                <Link
                  to="/souls"
                  search={{
                    q: undefined,
                    sort: undefined,
                    dir: undefined,
                    view: undefined,
                    focus: undefined,
                  }}
                >
                  <Button variant="outline" size="lg">
                    {t("home.browseSouls")}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hero-card hero-search-card fade-up" data-delay="2">
              <form
                className="search-bar"
                onSubmit={(event) => {
                  event.preventDefault();
                  void navigate({
                    to: "/souls",
                    search: {
                      q: trimmedQuery || undefined,
                      sort: undefined,
                      dir: undefined,
                      view: undefined,
                      focus: undefined,
                    },
                  });
                }}
              >
                <Search className="h-4 w-4 text-[color:var(--ink-soft)]" />
                <Input
                  placeholder={t("home.soulsSearchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="border-none bg-transparent shadow-none focus:shadow-none focus:ring-0"
                />
              </form>
              <div className="hero-install" style={{ marginTop: 18 }}>
                <div className="text-sm font-semibold text-[color:var(--ink-soft)]">
                  {t("home.soulsHeroPanelTitle")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <Container>
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl font-bold text-[color:var(--ink)]">
                {t("home.latestSouls")}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                {t("home.latestSoulsDescription")}
              </p>
            </div>
            {latest.length === 0 ? (
              <SkillCardSkeletonGrid count={6} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
                {latest.map((soul) => (
                  <SoulCard
                    key={soul._id}
                    soul={soul}
                    summaryFallback="A SOUL.md bundle."
                    meta={
                      <span className="text-[0.8rem] text-[color:var(--ink-soft)]">
                        <SoulStatsTripletLine stats={soul.stats} />
                      </span>
                    }
                  />
                ))}
              </div>
            )}
            <div className="flex justify-center pt-4">
              <Link
                to="/souls"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  view: undefined,
                  focus: undefined,
                }}
              >
                <Button variant="outline">
                  {t("home.seeAllSouls")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
