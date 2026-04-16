import { createFileRoute, Link } from '@tanstack/react-router';
import { useAction, useQuery } from 'convex/react';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

// ============================================================================
// 全局 CSS 动画注入
// ============================================================================
const injectedStyles = `
  @keyframes text-slide-up {
    0% { opacity: 0; transform: translateY(40px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes ambient-drift {
    0% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(2%, -3%, 0) scale(1.06); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes ambient-drift-reverse {
    0% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(-2%, 2%, 0) scale(1.08); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes particle-swallow {
    0% { transform: translate3d(var(--particle-x), var(--particle-y), 0) scale(0.28); opacity: 0; }
    12% { opacity: 0.96; }
    58% { opacity: 0.86; }
    86% { opacity: 0.82; }
    100% { transform: translate3d(var(--particle-end-x), var(--particle-end-y), 0) scale(1.16); opacity: 0; }
  }
  .animate-blob-1 { animation: ambient-drift 18s ease-in-out infinite; }
  .animate-blob-2 { animation: ambient-drift-reverse 22s ease-in-out infinite; }
  .animate-particle-swallow {
    animation: particle-swallow var(--particle-duration) ease-in infinite;
    animation-delay: var(--particle-delay);
  }
  
  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
  .delay-400 { animation-delay: 400ms; }
  .delay-500 { animation-delay: 500ms; }
`;

const whaleParticles = [
  { x: '-244px', y: '-128px', endX: '-12px', endY: '-8px', size: '6px', shape: 'rounded-[2px]' },
  { x: '-228px', y: '-102px', endX: '-8px', endY: '-2px', size: '8px', shape: 'rounded-full' },
  { x: '-214px', y: '-72px', endX: '-10px', endY: '4px', size: '12px', shape: 'rounded-[2px]' },
  { x: '-208px', y: '-34px', endX: '-6px', endY: '-12px', size: '7px', shape: 'rounded-full' },
  { x: '-198px', y: '8px', endX: '-4px', endY: '2px', size: '10px', shape: 'rounded-[2px]' },
  { x: '-190px', y: '42px', endX: '-10px', endY: '12px', size: '6px', shape: 'rounded-full' },
  { x: '-178px', y: '78px', endX: '-6px', endY: '8px', size: '8px', shape: 'rounded-[2px]' },
  { x: '-170px', y: '-136px', endX: '-2px', endY: '-10px', size: '5px', shape: 'rounded-full' },
  { x: '-166px', y: '-92px', endX: '-12px', endY: '6px', size: '9px', shape: 'rounded-[2px]' },
  { x: '-160px', y: '-48px', endX: '-8px', endY: '-4px', size: '14px', shape: 'rounded-full' },
  { x: '-154px', y: '-4px', endX: '-4px', endY: '4px', size: '7px', shape: 'rounded-[2px]' },
  { x: '-148px', y: '28px', endX: '-10px', endY: '-6px', size: '11px', shape: 'rounded-full' },
  { x: '-144px', y: '62px', endX: '-3px', endY: '10px', size: '6px', shape: 'rounded-[2px]' },
  { x: '-136px', y: '-118px', endX: '-8px', endY: '-8px', size: '5px', shape: 'rounded-full' },
  { x: '-132px', y: '-74px', endX: '-6px', endY: '2px', size: '10px', shape: 'rounded-[2px]' },
  { x: '-126px', y: '-34px', endX: '-9px', endY: '8px', size: '8px', shape: 'rounded-full' },
  { x: '-122px', y: '6px', endX: '-2px', endY: '-2px', size: '13px', shape: 'rounded-[2px]' },
  { x: '-118px', y: '46px', endX: '-7px', endY: '6px', size: '8px', shape: 'rounded-full' },
  { x: '-112px', y: '82px', endX: '-3px', endY: '12px', size: '6px', shape: 'rounded-[2px]' },
  { x: '-102px', y: '-100px', endX: '-10px', endY: '-2px', size: '7px', shape: 'rounded-full' },
  { x: '-96px', y: '-58px', endX: '-5px', endY: '5px', size: '11px', shape: 'rounded-[2px]' },
  { x: '-90px', y: '-18px', endX: '-1px', endY: '-8px', size: '7px', shape: 'rounded-full' },
  { x: '-86px', y: '20px', endX: '-7px', endY: '2px', size: '9px', shape: 'rounded-[2px]' },
  { x: '-80px', y: '58px', endX: '-4px', endY: '8px', size: '5px', shape: 'rounded-full' },
  { x: '-74px', y: '-122px', endX: '-8px', endY: '-4px', size: '4px', shape: 'rounded-full' },
  { x: '-68px', y: '-82px', endX: '-3px', endY: '0px', size: '8px', shape: 'rounded-[2px]' },
  { x: '-62px', y: '-42px', endX: '-1px', endY: '6px', size: '12px', shape: 'rounded-full' },
  { x: '-56px', y: '-2px', endX: '-4px', endY: '-6px', size: '6px', shape: 'rounded-[2px]' },
  { x: '-52px', y: '30px', endX: '-2px', endY: '4px', size: '9px', shape: 'rounded-full' },
  { x: '-46px', y: '64px', endX: '-1px', endY: '10px', size: '5px', shape: 'rounded-[2px]' },
  { x: '-42px', y: '-60px', endX: '-3px', endY: '-2px', size: '7px', shape: 'rounded-full' },
  { x: '-34px', y: '-22px', endX: '-1px', endY: '2px', size: '6px', shape: 'rounded-[2px]' },
  { x: '-28px', y: '14px', endX: '0px', endY: '6px', size: '5px', shape: 'rounded-full' },
  { x: '-18px', y: '-10px', endX: '0px', endY: '0px', size: '4px', shape: 'rounded-full' },
];

function WhaleParticles() {
  return (
    <div className="absolute left-[57%] top-[56%] hidden h-[16rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 md:block lg:left-[56%] lg:top-[56.5%]">
      {whaleParticles.map((particle, index) => (
        <span
          key={`${particle.x}-${particle.y}-${particle.endX}-${particle.endY}`}
          className={`absolute left-1/2 top-1/2 block bg-[#8abaf6]/65 dark:bg-[#9fd6ff]/80 ${particle.shape} animate-particle-swallow`}
          style={{
            width: particle.size,
            height: particle.size,
            '--particle-x': particle.x,
            '--particle-y': particle.y,
            '--particle-end-x': particle.endX,
            '--particle-end-y': particle.endY,
            '--particle-delay': `${index * 0.12}s`,
            '--particle-duration': `${2.5 + (index % 5) * 0.22}s`,
            boxShadow:
              index % 3 === 0
                ? '0 0 18px rgba(138, 186, 246, 0.4)'
                : '0 0 12px rgba(159, 214, 255, 0.28)',
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function AmbientBackdrop({ variant }: { variant: 'skills' | 'souls' }) {
  const isSkills = variant === 'skills';

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {isSkills ? (
        <>
          <div className="absolute inset-0 bg-[#f7fbff] dark:bg-[#050c18]" />
          <img
            src="/home-whale-light.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-100 animate-blob-1 dark:hidden"
          />
          <img
            src="/home-whale-dark.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 hidden h-full w-full object-cover object-center opacity-100 animate-blob-2 dark:block"
          />
          <WhaleParticles />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,251,255,0.2)_0%,rgba(248,251,255,0.08)_28%,rgba(248,251,255,0.24)_100%)] dark:bg-[linear-gradient(180deg,rgba(5,12,24,0.1)_0%,rgba(5,12,24,0.12)_38%,rgba(5,12,24,0.3)_100%)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(125,211,252,0.14),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.12),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#edf8ff_34%,#f8fcff_100%)] dark:bg-[radial-gradient(circle_at_20%_16%,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.12),transparent_28%),linear-gradient(180deg,#03111b_0%,#071a27_34%,#04111a_100%)]" />
          <div className="absolute inset-0 opacity-[0.36] dark:opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute left-[-8rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-300/28 blur-[110px] animate-blob-1 dark:bg-cyan-500/16" />
          <div className="absolute right-[-10rem] top-[10%] h-[34rem] w-[34rem] rounded-full bg-teal-300/22 blur-[130px] animate-blob-2 dark:bg-teal-500/16" />
          <div className="absolute left-1/2 top-[22%] h-[24rem] w-[56rem] -translate-x-1/2 rounded-full bg-white/72 blur-[150px] dark:bg-cyan-400/8" />
          <div className="absolute bottom-[-12rem] left-[8%] h-[24rem] w-[24rem] rounded-full bg-sky-200/30 blur-[120px] animate-blob-1 dark:bg-sky-500/10" />
        </>
      )}
      {isSkills ? (
        <div className="absolute inset-x-0 bottom-0 h-[12rem] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(244,248,255,0.72)_100%)] dark:bg-[linear-gradient(180deg,rgba(5,12,24,0)_0%,rgba(5,12,24,0.66)_100%)]" />
      ) : null}
    </div>
  );
}

// ============================================================================
// 1. Skills Home (大厂质感、巨鲸现身、丰富CSS特效版)
// ============================================================================
function SkillsHome() {
  const { locale, t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fbff] font-sans selection:bg-blue-500/30 dark:bg-[#050c18]">
      <style>{injectedStyles}</style>
      <AmbientBackdrop variant="skills" />

      <section className="relative z-10 flex min-h-[calc(100svh-4rem)] items-center pt-20 pb-20">
        <Container className="w-full">
          <div className="flex min-h-[32rem] items-center">
            <div className="max-w-[36rem] pl-2 pt-6 text-left sm:pl-6 sm:pt-8 lg:pl-12 lg:pt-10">
              <h1 className="opacity-0 [animation:text-slide-up_1s_ease-out_forwards] font-display text-[5.4rem] font-black leading-none tracking-[0.06em] text-slate-900 dark:text-white sm:text-[6.6rem] lg:text-[8.4rem]">
                {t('home.posterGlyph')}
              </h1>
              <p
                className="opacity-0 [animation:text-slide-up_1s_ease-out_forwards] delay-100 mt-5 font-sans text-[1.08rem] font-normal leading-[1.7] tracking-normal text-slate-500 dark:text-slate-300 sm:text-[1.16rem] lg:text-[1.22rem]"
                style={{
                  maxWidth: locale === 'zh-CN' ? '18em' : '34em',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                {t('home.posterDescription')}
              </p>
              <div className="opacity-0 [animation:text-slide-up_1s_ease-out_forwards] delay-200 mt-8">
                <Link
                  to="/skills"
                  search={{
                    q: undefined,
                    sort: undefined,
                    dir: undefined,
                    highlighted: undefined,
                    nonSuspicious: undefined,
                    view: undefined,
                    focus: undefined,
                  }}
                >
                  <Button className="h-12 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
                    {t('home.browseSkills')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}

// ============================================================================
// 2. Only Crabs Home (保留原逻辑，同样增加了动画类名)
// ============================================================================
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
    <main className="relative min-h-screen overflow-hidden bg-background">
      <style>{injectedStyles}</style>
      <AmbientBackdrop variant="souls" />

      {/* Hero 焦点搜索区域 */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center pt-24 pb-10 text-center">
        <Container size="wide" className="flex flex-col items-center">
          
          <div className="opacity-0[animation:text-slide-up_1s_ease-out_forwards] mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-5 py-2 text-sm font-bold text-blue-600 backdrop-blur-md dark:text-blue-400">
            <Sparkles className="h-4 w-4" />
            {t('home.soulsHeroBadgeLarge')}
          </div>
          
          <h1 className="opacity-0[animation:text-slide-up_1s_ease-out_forwards] delay-100 max-w-5xl bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-blue-100 dark:to-blue-400 bg-clip-text font-display text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-[5.4rem]">
            {t('home.soulsHeroTitleLarge')}
          </h1>
          
          <p className="opacity-0[animation:text-slide-up_1s_ease-out_forwards] delay-200 mt-5 max-w-[40rem] text-base font-medium text-slate-600 dark:text-slate-300 sm:text-lg">
            {t('home.soulsHeroDescriptionLarge')}
          </p>

          {/* Spotlight 级超大搜索框 */}
          <div className="opacity-0[animation:text-slide-up_1s_ease-out_forwards] delay-300 group relative mt-10 w-full max-w-3xl">
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-blue-600 to-cyan-400 opacity-20 blur-xl transition duration-500 group-hover:opacity-40" />
            <form
              className="relative flex items-center rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 p-2 shadow-2xl backdrop-blur-2xl transition-all focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-950"
              onSubmit={(event) => {
                event.preventDefault();
                void navigate({
                  to: '/souls',
                  search: { q: trimmedQuery || undefined, sort: undefined, dir: undefined, view: undefined, focus: undefined },
                });
              }}
            >
              <div className="flex items-center justify-center pl-6 pr-3">
                <Search className="h-7 w-7 text-slate-400" />
              </div>
              <Input
                placeholder={t('home.soulsSearchPlaceholderLarge')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-14 flex-1 border-0 bg-transparent px-2 text-lg font-medium placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-900 dark:text-white"
              />
              <Button
                type="submit"
                size="icon"
                className="h-12 w-12 rounded-full bg-blue-600 text-white shadow-md transition-transform hover:scale-105 hover:bg-blue-500"
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
            </form>
          </div>
        </Container>
      </section>

      {/* Latest Souls 网格 */}
      <section className="relative z-10 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 py-24 backdrop-blur-3xl">
        <Container size="wide">
          <div className="mb-16 flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {t('home.latestSoulsLarge')}
              </h2>
              <p className="font-medium text-slate-600 dark:text-slate-400">
                {t('home.latestSoulsLargeDescription')}
              </p>
            </div>
            <Link
              to="/souls"
              search={{ q: undefined, sort: undefined, dir: undefined, view: undefined, focus: undefined }}
              className="group hidden items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white shadow-sm transition-all hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 sm:inline-flex"
            >
              {t('home.seeAllSoulsLarge')}
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
                    summaryFallback={t('home.soulsFallbackSummaryLarge')}
                    meta={
                      <span className="mt-2 flex items-center text-xs font-medium text-slate-500">
                        <SoulStatsTripletLine stats={soul.stats} />
                      </span>
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
