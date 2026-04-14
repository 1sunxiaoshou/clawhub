import { createFileRoute, Link } from '@tanstack/react-router';
import { useAction, useQuery } from 'convex/react';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Container } from '../components/layout/Container';
import { SkillCardSkeletonGrid } from '../components/skeletons/SkillCardSkeleton';
import { SoulCard } from '../components/SoulCard';
import { SoulStatsTripletLine } from '../components/SoulStats';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useI18n } from '../lib/i18n';
import type { PublicSoul } from '../lib/publicUser';
import { getSiteMode } from '../lib/site';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const mode = getSiteMode();
  return mode === 'souls' ? <OnlyCrabsHome /> : <SkillsHome />;
}

// ----------------------------------------------------------------------------
// 1. Skills Home (更具设计感、比例均衡的极致极简版)
// ----------------------------------------------------------------------------
function SkillsHome() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen bg-background selection:bg-primary/20">
      {/* 
        Hero Section - 参考 UX Gears 风格 
        使用精致的网格背景与径向渐变遮罩，营造深邃且高级的空间感
      */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden pt-20 pb-12">
        {/* 高级网格背景与光晕渐变 */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 z-0 bg-background[mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_20%,black_100%)]"></div>
        <div className="absolute left-1/2 top-1/3 -z-10 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

        <Container className="relative z-10 flex flex-col items-center text-center">
          {/* 精致的 Badge */}
          <div className="fade-up mb-8 flex justify-center" style={{ animationDelay: '0.1s' }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('home.heroBadge')}
            </span>
          </div>

          {/* 极具张力的超大标题排版 */}
          <h1
            className="fade-up mx-auto max-w-5xl font-display text-5xl font-extrabold tracking-tighter text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
            style={{ animationDelay: '0.2s' }}
          >
            {t('home.heroTitle')}
          </h1>

          {/* 收缩宽度的精炼描述 */}
          <p
            className="fade-up mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl md:leading-relaxed"
            style={{ animationDelay: '0.3s' }}
          >
            {t('home.heroDescription')}
          </p>

          {/* 极简按钮 */}
          <div className="fade-up mt-12 flex items-center justify-center" style={{ animationDelay: '0.4s' }}>
            <Link
              to="/skills"
              search={{
                q: undefined, sort: undefined, dir: undefined, highlighted: undefined, nonSuspicious: true, view: undefined, focus: undefined,
              }}
            >
              <Button
                variant="default"
                size="lg"
                className="group h-14 rounded-full px-8 text-base font-medium shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
              >
                {t('home.browseSkills')}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* 
        Explain Section - 摒弃笨重的卡片，改为错层分栏布局
        利用极致的留白和细腻的线条勾勒出专业感
      */}
      <section className="relative border-t border-border/40 bg-background/50 py-24 lg:py-32">
        <Container>
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-24">

            {/* 左侧：序号与主标题 */}
            <div className="fade-up lg:w-5/12" style={{ animationDelay: '0.1s' }}>
              <div className="mb-6 flex items-center gap-4 text-muted-foreground">
                <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                  {t('home.explainKicker')}
                </span>
                <span className="h-px w-12 bg-border"></span>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.1]">
                {t('home.explainTitle')}
              </h2>
            </div>

            {/* 右侧：描述文案与操作 */}
            <div className="fade-up flex flex-col items-start gap-8 lg:mt-16 lg:w-6/12" style={{ animationDelay: '0.2s' }}>
              <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {t('home.explainBody')}
              </p>
              <Link
                to="/skills"
                search={{
                  q: undefined, sort: undefined, dir: undefined, highlighted: undefined, nonSuspicious: true, view: undefined, focus: undefined,
                }}
                className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-transparent px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted"
              >
                {t('home.explainAction')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

          </div>
        </Container>
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------
// 2. Only Crabs Home (保持风格统一的高级版)
// ----------------------------------------------------------------------------
function OnlyCrabsHome() {
  const navigate = Route.useNavigate();
  const ensureSoulSeeds = useAction(api.seed.ensureSoulSeeds);
  const { t } = useI18n();
  const latest = (useQuery(api.souls.list, { limit: 12 }) as PublicSoul[]) ?? [];
  const [query, setQuery] = useState('');
  const seedEnsuredRef = useRef(false);
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (seedEnsuredRef.current) return;
    seedEnsuredRef.current = true;
    void ensureSoulSeeds({});
  }, [ensureSoulSeeds]);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-32">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 z-0 bg-background[mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_20%,black_100%)]"></div>
        <div className="absolute left-1/4 top-0 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

        <Container size="wide" className="relative z-10">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">

            {/* 左侧：文案 */}
            <div className="flex flex-col gap-8 fade-up" style={{ animationDelay: '0.1s' }}>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('home.soulsHeroBadge')}
              </span>
              <h1 className="font-display text-5xl font-extrabold tracking-tighter text-foreground sm:text-6xl lg:text-[4.5rem] lg:leading-[1.05]">
                {t('home.soulsHeroTitle')}
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {t('home.soulsHeroDescription')}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/publish-skill" search={{ updateSlug: undefined }}>
                  <Button variant="default" size="lg" className="h-14 rounded-full px-8 text-base shadow-lg transition-transform hover:scale-105">
                    {t('home.publishSoul')}
                  </Button>
                </Link>
                <Link
                  to="/souls"
                  search={{ q: undefined, sort: undefined, dir: undefined, view: undefined, focus: undefined }}
                >
                  <Button variant="outline" size="lg" className="h-14 rounded-full border-border/60 bg-transparent px-8 text-base hover:bg-muted">
                    {t('home.browseSouls')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* 右侧：高级搜索框布局 */}
            <div className="relative fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="absolute -inset-0.5 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-xl opacity-50" />
              <div className="relative flex flex-col gap-8 rounded-[2rem] border border-border/50 bg-background/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">{t('home.soulsHeroPanelTitle')}</h3>
                  <p className="text-sm text-muted-foreground">Find exactly what you need in our global ecosystem.</p>
                </div>

                <form
                  className="relative flex items-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void navigate({
                      to: '/souls',
                      search: { q: trimmedQuery || undefined, sort: undefined, dir: undefined, view: undefined, focus: undefined },
                    });
                  }}
                >
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    placeholder={t('home.soulsSearchPlaceholder')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-16 w-full rounded-2xl border-border/60 bg-muted/30 pl-14 pr-16 text-base shadow-inner focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="absolute right-2.5 top-2.5 bottom-2.5 h-11 w-11 rounded-xl"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Latest Souls Section */}
      <section className="border-t border-border/40 bg-muted/10 py-24">
        <Container size="wide">
          <div className="mb-14 flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="space-y-3 text-center sm:text-left">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('home.latestSouls')}
              </h2>
              <p className="text-base text-muted-foreground">
                {t('home.latestSoulsDescription')}
              </p>
            </div>
            <Link
              to="/souls"
              search={{ q: undefined, sort: undefined, dir: undefined, view: undefined, focus: undefined }}
              className="group hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
            >
              {t('home.seeAllSouls')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {latest.length === 0 ? (
            <SkillCardSkeletonGrid count={6} />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
              {latest.map((soul) => (
                <div key={soul._id} className="transition-transform duration-300 hover:-translate-y-1">
                  <SoulCard
                    soul={soul}
                    summaryFallback={t('home.soulsFallbackSummary')}
                    meta={
                      <span className="mt-2 flex items-center text-xs font-medium text-muted-foreground">
                        <SoulStatsTripletLine stats={soul.stats} />
                      </span>
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 flex justify-center sm:hidden">
            <Link
              to="/souls"
              search={{ q: undefined, sort: undefined, dir: undefined, view: undefined, focus: undefined }}
              className="w-full"
            >
              <Button variant="outline" className="w-full rounded-full h-12">
                {t('home.seeAllSouls')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
