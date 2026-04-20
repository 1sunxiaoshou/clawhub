export interface FooterNavSection {
  title: string;
  items: FooterNavItem[];
}

export type FooterNavItem =
  | { kind: "link"; label: string; to: string; search?: Record<string, unknown>; featureFlag?: boolean }
  | { kind: "external"; label: string; href: string; featureFlag?: boolean }
  | { kind: "text"; label: string; featureFlag?: boolean };

const SKILLS_SEARCH = {
  q: undefined,
  sort: undefined,
  dir: undefined,
  highlighted: undefined,
  nonSuspicious: undefined,
  view: undefined,
  focus: undefined,
} as const;

export const FOOTER_NAV_SECTIONS: FooterNavSection[] = [
  {
    title: "Browse",
    items: [
      { kind: "link", label: "Skills", to: "/skills", search: SKILLS_SEARCH },
      { kind: "link", label: "Plugins", to: "/plugins" },
      { kind: "link", label: "Stars", to: "/stars" },
    ],
  },
  {
    title: "Publish",
    items: [
      {
        kind: "link",
        label: "Publish Skill",
        to: "/publish-skill",
        search: { updateSlug: undefined },
      },
      {
        kind: "link",
        label: "Publish Plugin",
        to: "/publish-plugin",
        search: {
          ownerHandle: undefined,
          name: undefined,
          displayName: undefined,
          family: undefined,
          nextVersion: undefined,
          sourceRepo: undefined,
        },
      },
    ],
  },
  {
    title: "Community",
    items: [
      { kind: "external", label: "GitHub", href: "https://github.com/openclaw/clawhub" },
      { kind: "external", label: "OpenClaw", href: "https://openclaw.ai" },
    ],
  },
  {
    title: "Platform",
    items: [
      { kind: "external", label: "Deployed on Vercel", href: "https://vercel.com" },
      { kind: "external", label: "Powered by Convex", href: "https://www.convex.dev" },
    ],
  },
];
