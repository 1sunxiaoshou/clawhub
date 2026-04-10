import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "zh-CN" | "en";

const LOCALE_KEY = "clawhub-locale";
const DEFAULT_LOCALE: Locale = "en";

const messages = {
  "zh-CN": {
    header: {
      skills: "技能",
      plugins: "插件",
      search: "搜索",
      about: "关于",
      stars: "收藏",
      management: "管理",
      publish: "发布",
      openMenu: "打开菜单",
      theme: "主题",
      language: "语言",
      systemTheme: "跟随系统",
      lightTheme: "浅色",
      darkTheme: "深色",
      dashboard: "控制台",
      settings: "设置",
      signOut: "退出登录",
      signIn: "登录",
      signInWithGitHub: "使用 GitHub 登录",
      publishSkill: "发布技能",
    },
    home: {
      heroBadge: "面向 AI Agent 的版本化技能仓库",
      heroTitle: "ClawHub，锐利 Agent 的技能码头。",
      heroDescription: "浏览、安装并发布技能包。像 npm 一样版本化，支持向量搜索，没有繁琐门槛。",
      skillsAvailable: "{count} 个技能可用",
      browseSkills: "浏览技能",
      publishSkill: "发布技能",
      heroPanelTitle: "搜索技能，版本化管理，随时可回滚。",
      staffPicks: "精选推荐",
      staffPicksDescription: "人工精选，更快建立信任。",
      viewAll: "查看全部",
      noHighlightedSkills: "还没有精选技能。",
      popularSkills: "热门技能",
      popularSkillsDescription: "下载量最高、经过验证的推荐。",
      noSkills: "还没有技能，来发布第一个吧。",
      seeAllSkills: "查看全部技能",
      soulsHeroBadge: "SOUL.md，共享于此。",
      soulsHeroTitle: "SoulHub，系统人格与设定的归档地。",
      soulsHeroDescription: "分享 SOUL.md bundle，像文档一样版本化，把个人系统 lore 放到一个公开的地方。",
      publishSoul: "发布 Soul",
      browseSouls: "浏览 Souls",
      soulsSearchPlaceholder: "搜索 souls、提示词或 lore",
      soulsHeroPanelTitle: "搜索 souls。版本可追踪，内容可阅读，也便于 remix。",
      latestSouls: "最新 Souls",
      latestSoulsDescription: "Hub 中最新发布的 SOUL.md bundle。",
      seeAllSouls: "查看全部 Souls",
    },
    settings: {
      signInPrompt: "登录后可访问设置。",
      signInWithGitHub: "使用 GitHub 登录",
      title: "设置",
      displayName: "显示名称",
      bio: "简介",
      bioPlaceholder: "介绍一下你正在构建的内容。",
      save: "保存",
      saved: "已保存",
      organizations: "组织",
      organizationsDescription: "创建组织发布者，并管理谁可以在其名下发布。",
      orgHandle: "组织 Handle",
      orgDisplayName: "显示名称",
      createOrg: "创建组织",
      manageOrg: "管理组织",
      addMember: "添加成员",
      role: "角色",
      addMemberAction: "添加成员",
      remove: "移除",
      apiTokens: "API Token",
      apiTokensDescription: "这些 token 可用于 `clawhub` CLI。创建后只会显示一次。",
      label: "标签",
      createToken: "创建 Token",
      copyTokenNow: "请立即复制这个 Token：",
      revoked: "已撤销",
      revoke: "撤销",
      noTokens: "还没有 Token。",
      created: "创建于 {date}",
      used: "使用于 {date}",
      revokedAt: "撤销于 {date}",
      dangerZone: "危险区域",
      dangerZoneDescription: "永久删除你的账号。此操作无法撤销。已发布的技能会继续公开。",
      deleteAccount: "删除账号",
      deleteAccountTitle: "删除账号",
      deleteAccountDescription: "要永久删除你的账号吗？此操作无法撤销。已发布的技能会继续公开。",
      cancel: "取消",
      profile: "个人资料",
      userFallback: "资料",
    },
  },
  en: {
    header: {
      skills: "Skills",
      plugins: "Plugins",
      search: "Search",
      about: "About",
      stars: "Stars",
      management: "Management",
      publish: "Publish",
      openMenu: "Open menu",
      theme: "Theme",
      language: "Language",
      systemTheme: "System theme",
      lightTheme: "Light theme",
      darkTheme: "Dark theme",
      dashboard: "Dashboard",
      settings: "Settings",
      signOut: "Sign out",
      signIn: "Sign in",
      signInWithGitHub: "Sign in with GitHub",
      publishSkill: "Publish Skill",
    },
    home: {
      heroBadge: "A versioned registry for AI agent skills",
      heroTitle: "ClawHub, the skill dock for sharp agents.",
      heroDescription: "Browse, install, and publish skill packs. Versioned like npm, searchable with vectors, no gatekeeping.",
      skillsAvailable: "{count} skills available",
      browseSkills: "Browse skills",
      publishSkill: "Publish Skill",
      heroPanelTitle: "Search skills. Versioned, rollback-ready.",
      staffPicks: "Staff Picks",
      staffPicksDescription: "Curated signal — highlighted for quick trust.",
      viewAll: "View all",
      noHighlightedSkills: "No highlighted skills yet.",
      popularSkills: "Popular skills",
      popularSkillsDescription: "Most-downloaded, verified picks.",
      noSkills: "No skills yet. Be the first.",
      seeAllSkills: "See all skills",
      soulsHeroBadge: "SOUL.md, shared.",
      soulsHeroTitle: "SoulHub, where system lore lives.",
      soulsHeroDescription: "Share SOUL.md bundles, version them like docs, and keep personal system lore in one public place.",
      publishSoul: "Publish Soul",
      browseSouls: "Browse souls",
      soulsSearchPlaceholder: "Search souls, prompts, or lore",
      soulsHeroPanelTitle: "Search souls. Versioned, readable, easy to remix.",
      latestSouls: "Latest souls",
      latestSoulsDescription: "Newest SOUL.md bundles across the hub.",
      seeAllSouls: "See all souls",
    },
    settings: {
      signInPrompt: "Sign in to access settings.",
      signInWithGitHub: "Sign in with GitHub",
      title: "Settings",
      displayName: "Display name",
      bio: "Bio",
      bioPlaceholder: "Tell people what you're building.",
      save: "Save",
      saved: "Saved",
      organizations: "Organizations",
      organizationsDescription: "Create org publishers and manage who can publish under them.",
      orgHandle: "Org handle",
      orgDisplayName: "Display name",
      createOrg: "Create org",
      manageOrg: "Manage org",
      addMember: "Add member",
      role: "Role",
      addMemberAction: "Add member",
      remove: "Remove",
      apiTokens: "API tokens",
      apiTokensDescription: "Use these tokens for the `clawhub` CLI. Tokens are shown once on creation.",
      label: "Label",
      createToken: "Create token",
      copyTokenNow: "Copy this token now:",
      revoked: "Revoked",
      revoke: "Revoke",
      noTokens: "No tokens yet.",
      created: "Created {date}",
      used: "Used {date}",
      revokedAt: "Revoked {date}",
      dangerZone: "Danger zone",
      dangerZoneDescription: "Delete your account permanently. This cannot be undone. Published skills remain public.",
      deleteAccount: "Delete account",
      deleteAccountTitle: "Delete account",
      deleteAccountDescription: "Delete your account permanently? This cannot be undone. Published skills will remain public.",
      cancel: "Cancel",
      profile: "Profile",
      userFallback: "Profile",
    },
  },
} as const;

type MessageTree = (typeof messages)["zh-CN"];
type MessageKey = string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  formatDateTime: (value: number | string | Date) => string;
};

const defaultContextValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, params) => interpolate(getMessage(DEFAULT_LOCALE, key), params),
  formatDateTime: (input) => {
    try {
      return new Date(input).toLocaleString(DEFAULT_LOCALE);
    } catch {
      return String(input);
    }
  },
};

const I18nContext = createContext<I18nContextValue>(defaultContextValue);

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_KEY);
  return stored === "zh-CN" ? "zh-CN" : DEFAULT_LOCALE;
}

function applyLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

function getMessage(locale: Locale, key: MessageKey) {
  const tree = messages[locale] as MessageTree;
  const parts = key.split(".");
  let current: unknown = tree;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replaceAll(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const nextLocale = getStoredLocale();
    setLocaleState(nextLocale);
    applyLocale(nextLocale);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    applyLocale(locale);
    window.localStorage.setItem(LOCALE_KEY, locale);
  }, [isHydrated, locale]);

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key, params) => interpolate(getMessage(locale, key), params),
      formatDateTime: (input) => {
        try {
          return new Date(input).toLocaleString(locale);
        } catch {
          return String(input);
        }
      },
    }),
    [locale],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
