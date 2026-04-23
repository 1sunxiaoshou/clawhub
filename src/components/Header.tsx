import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useLocation } from "@tanstack/react-router";
import { CircleUserRound, Languages, Menu, Moon, Plus, Sun } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { isAuthPath } from "../auth/isAuthPath";
import { gravatarUrl } from "../lib/gravatar";
import { useI18n } from "../lib/i18n";
import { isModerator } from "../lib/roles";
import { getClawHubSiteUrl, getSiteMode, getSiteName } from "../lib/site";
import { applyTheme, useThemeMode } from "../lib/theme";
import { startThemeTransition } from "../lib/theme-transition";
import { useAuthStatus } from "../lib/useAuthStatus";
import { SignInButton } from "./SignInButton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export default function Header() {
  const { isAuthenticated, isLoading, me } = useAuthStatus();
  const { signOut } = useAuthActions();
  const { mode, setMode } = useThemeMode();
  const { locale, setLocale, t } = useI18n();
  const toggleRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const siteMode = getSiteMode();
  const siteName = useMemo(() => getSiteName(siteMode), [siteMode]);
  const isSoulMode = siteMode === "souls";
  const isHomePage = location.pathname === "/";
  const isAuthPage = isAuthPath(location.pathname);
  const clawHubUrl = getClawHubSiteUrl();

  const avatar = me?.image ?? (me?.email ? gravatarUrl(me.email) : undefined);
  const handle = me?.handle ?? me?.displayName ?? "user";
  const displayName = me?.displayName ?? me?.name ?? handle;
  const initial = displayName.charAt(0).toUpperCase();
  const isStaff = isModerator(me);

  const setTheme = (next: "light" | "dark") => {
    startThemeTransition({
      nextTheme: next,
      currentTheme: mode,
      setTheme: (value) => {
        const nextMode = value as "light" | "dark";
        applyTheme(nextMode);
        setMode(nextMode);
      },
      context: { element: toggleRef.current },
    });
  };

  const cycleTheme = () => {
    const next = mode === "light" ? "dark" : "light";
    setTheme(next);
  };

  const toggleLocale = () => {
    setLocale(locale === "zh-CN" ? "en" : "zh-CN");
  };

  const themeLabel = mode === "light" ? t("header.lightTheme") : t("header.darkTheme");
  const ThemeIcon = mode === "light" ? Sun : Moon;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPathActive = (href: string) =>
    href === "/" ? location.pathname === href : location.pathname === href || location.pathname.startsWith(`${href}/`);

  const navLinkClass = (active: boolean) =>
    `header-nav-link rounded-full px-4 py-2 text-sm font-medium ${
      active ? "is-active text-foreground" : "text-muted-foreground"
    }`;

  const navLinks = (
    <>
      {isSoulMode ? (
        <a href={clawHubUrl} className={navLinkClass(false)}>
          ClawHub
        </a>
      ) : null}
      {isSoulMode ? (
        <Link
          to="/souls"
          search={{
            q: undefined,
            sort: undefined,
            dir: undefined,
            view: undefined,
            focus: undefined,
          }}
          className={navLinkClass(isPathActive("/souls"))}
        >
          {t("header.souls")}
        </Link>
      ) : (
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
          className={navLinkClass(isPathActive("/skills"))}
        >
          {t("header.skills")}
        </Link>
      )}
      {isSoulMode ? null : (
        <Link to="/plugins" className={navLinkClass(isPathActive("/plugins"))}>
          {t("header.plugins")}
        </Link>
      )}
      {me ? (
        <Link to="/stars" className={navLinkClass(isPathActive("/stars"))}>
          {t("header.stars")}
        </Link>
      ) : null}
      {isStaff ? (
        <Link to="/import" className={navLinkClass(isPathActive("/import"))}>
          {t("header.import")}
        </Link>
      ) : null}
      {isStaff ? (
        <Link to="/management" search={{ skill: undefined }} className={navLinkClass(isPathActive("/management"))}>
          {t("header.management")}
        </Link>
      ) : null}
    </>
  );

  return (
    <header
      className={`site-header top-0 z-50 w-full border-b border-border/10 transition-colors ${
        isHomePage ? "home-header absolute left-0 right-0" : isAuthPage ? "absolute left-0 right-0 border-transparent bg-transparent" : "sticky"
      }`}
    >
      <div className="site-header-inner mx-auto grid h-[4.5rem] max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-5">
        
        {/* Logo 结合鲸鱼微光晕交互 */}
        <Link
          to="/"
          search={{ q: undefined, highlighted: undefined, search: undefined }}
          className="header-brand group flex items-center justify-self-start no-underline"
        >
          <img
            src="/deep-skill-hub-wordmark.png"
            alt={siteName}
            className="header-wordmark block h-auto w-auto max-h-[2.35rem] max-w-[min(44vw,18rem)] object-contain"
          />
        </Link>

        <nav className="header-nav hidden items-center justify-center gap-1 md:flex">
          {isAuthPage ? null : navLinks}
        </nav>

        <div className="header-actions flex items-center justify-self-end gap-2">
          {isAuthenticated && me ? (
            <Link to="/publish-skill" search={{ updateSlug: undefined }} className="hidden sm:block">
              <Button
                variant="primary"
                size="icon"
                aria-label={t("header.publish")}
                className="header-icon-button header-publish-button h-10 w-10 rounded-full text-[1.2rem]"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          ) : null}

          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("header.openMenu")}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-background/95 backdrop-blur-xl">
                <SheetHeader>
                  <SheetTitle>{siteName}</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-4">
                  <SheetClose asChild>
                    <Link
                      to="/"
                      search={{ q: undefined, highlighted: undefined, search: undefined }}
                      className={navLinkClass(isPathActive("/"))}
                    >
                      {t("header.home")}
                    </Link>
                  </SheetClose>
                  {isSoulMode ? (
                    <SheetClose asChild>
                      <a href={clawHubUrl} className={navLinkClass(false)}>
                        ClawHub
                      </a>
                    </SheetClose>
                  ) : null}
                  <SheetClose asChild>
                    <Link
                      to={isSoulMode ? "/souls" : "/skills"}
                      search={
                        isSoulMode
                          ? {
                              q: undefined,
                              sort: undefined,
                              dir: undefined,
                              view: undefined,
                              focus: undefined,
                            }
                          : {
                              q: undefined,
                              sort: undefined,
                              dir: undefined,
                              highlighted: undefined,
                              nonSuspicious: undefined,
                              view: undefined,
                              focus: undefined,
                            }
                      }
                      className={navLinkClass(isPathActive(isSoulMode ? "/souls" : "/skills"))}
                    >
                      {isSoulMode ? t("header.souls") : t("header.skills")}
                    </Link>
                  </SheetClose>
                  {!isSoulMode ? (
                    <SheetClose asChild>
                      <Link
                        to="/plugins"
                        className={navLinkClass(isPathActive("/plugins"))}
                      >
                        {t("header.plugins")}
                      </Link>
                    </SheetClose>
                  ) : null}
                  {me ? (
                    <SheetClose asChild>
                      <Link to="/stars" className={navLinkClass(isPathActive("/stars"))}>
                        {t("header.stars")}
                      </Link>
                    </SheetClose>
                  ) : null}
                  {isStaff ? (
                    <SheetClose asChild>
                      <Link to="/import" className={navLinkClass(isPathActive("/import"))}>
                        {t("header.import")}
                      </Link>
                    </SheetClose>
                  ) : null}
                  {isStaff ? (
                    <SheetClose asChild>
                      <Link
                        to="/management"
                        search={{ skill: undefined }}
                        className={navLinkClass(isPathActive("/management"))}
                      >
                        {t("header.management")}
                      </Link>
                    </SheetClose>
                  ) : null}
                </nav>
                <div className="mt-6 flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">
                    {t("header.theme")}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    onClick={cycleTheme}
                    aria-label={`${t("header.theme")}: ${themeLabel}`}
                  >
                    <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">
                    {t("header.language")}
                  </span>
                  <Button variant="outline" size="icon" type="button" onClick={toggleLocale} aria-label={t("header.language")}>
                    <Languages className="h-4 w-4" />
                  </Button>
                </div>
                {isAuthenticated && me ? (
                  <div className="mt-6">
                    <SheetClose asChild>
                      <Link to="/publish-skill" search={{ updateSlug: undefined }}>
                        <Button variant="primary" className="w-full rounded-full">
                          <Plus className="h-4 w-4" />
                          {t("header.publishSkill")}
                        </Button>
                      </Link>
                    </SheetClose>
                  </div>
                ) : null}
                <div className="mt-6 flex flex-col gap-2 border-t border-border/20 pt-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">
                    {displayName}
                  </span>
                  {isAuthenticated && me ? (
                    <>
                      <SheetClose asChild>
                        <Link to="/dashboard">
                          <Button variant="outline" className="w-full justify-start rounded-full">
                            {t("header.dashboard")}
                          </Button>
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link to="/settings">
                          <Button variant="outline" className="w-full justify-start rounded-full">
                            {t("header.settings")}
                          </Button>
                        </Link>
                      </SheetClose>
                      <Button
                        variant="ghost"
                        type="button"
                        className="w-full justify-start rounded-full text-red-500 hover:text-red-600"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          void signOut();
                        }}
                      >
                        {t("header.signOut")}
                      </Button>
                    </>
                  ) : (
                    <SignInButton
                      variant="outline"
                      className="w-full justify-center rounded-full"
                      aria-label={t("header.signIn")}
                    >
                      {t("header.signIn")}
                    </SignInButton>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={toggleLocale}
            aria-label={`${t("header.language")}: ${locale === "zh-CN" ? "中文" : "English"}`}
            className="header-icon-button header-utility-button header-minimal-icon hidden rounded-full md:inline-flex"
          >
            <Languages className="h-5 w-5" />
          </Button>

          <div className="hidden md:block" ref={toggleRef}>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={cycleTheme}
              aria-label={`${t("header.theme")}: ${themeLabel}`}
              className="header-icon-button header-utility-button header-minimal-icon rounded-full"
            >
              <ThemeIcon className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          {isAuthenticated && me ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <DropdownMenu>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={displayName}
                        className="header-avatar-trigger inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full ring-2 ring-transparent transition-all hover:ring-blue-500/50"
                      >
                        <Avatar className="h-9 w-9">
                          {avatar ? <AvatarImage src={avatar} alt={displayName} /> : null}
                          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl bg-background/95 backdrop-blur-xl">
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="cursor-pointer rounded-md">{t("header.dashboard")}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer rounded-md">{t("header.settings")}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void signOut()} className="cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-500/10">
                      {t("header.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="bottom" align="end" sideOffset={10} className="header-avatar-tooltip rounded-xl">
                  <div className="flex min-w-[180px] flex-col gap-0.5 p-1">
                    <span className="font-display text-sm font-bold text-foreground">{displayName}</span>
                    <span className="font-mono text-[0.72rem] text-muted-foreground">@{handle}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <>
              <SignInButton
                variant="ghost"
                size="icon"
                disabled={isLoading}
                aria-label={t("header.signIn")}
                className="header-icon-button header-utility-button header-minimal-icon h-10 w-10 rounded-full"
              >
                <CircleUserRound className="h-5 w-5" aria-hidden="true" />
              </SignInButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
