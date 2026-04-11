import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Shield, ShieldAlert } from "lucide-react";
import { Container } from "../components/layout/Container";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { getSiteMode, getSiteName, getSiteUrlForMode } from "../lib/site";
import { useI18n } from "../lib/i18n";

// Data moved to i18n.tsx

export const Route = createFileRoute("/about")({
  head: () => {
    const mode = getSiteMode();
    const siteName = getSiteName(mode);
    const siteUrl = getSiteUrlForMode(mode);
    // Note: head metadata might not be fully reactive to language toggle without SSR support or similar,
    // but we'll stick to English/System for now as a fallback or just use the canonical ones.
    const title = `About · ${siteName}`;
    const description =
      "What ClawHub allows, what we do not host, and the abuse patterns that lead to removal or account bans.";

    return {
      links: [
        {
          rel: "canonical",
          href: `${siteUrl}/about`,
        },
      ],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteUrl}/about` },
      ],
    };
  },
  component: AboutPage,
});

function AboutPage() {
  const { t } = useI18n();

  // Map prohibitedCategories from i18n
  const prohibitedKeys = ["bypass", "abuse", "fraud", "privacy", "impersonation", "explicit", "obfuscation"];
  const prohibitedCategories = prohibitedKeys.map(key => ({
    title: t(`about.prohibited.${key}.title` as any),
    examples: t(`about.prohibited.${key}.examples` as any),
  }));

  // Note: recentPatterns and enforcementItems are arrays in i18n
  // We need a way to get them. I'll add a helper or just cast.
  // Actually, I can use a trick or just handle them as fixed keys if I knew the count.
  // Or I can add them as separate keys about.recentPattern.0, etc.
  // Let's assume t can handle arrays if we return them, but my i18n implementation returns key if not string.
  
  // I'll adjust i18n.tsx to support getting raw objects/arrays if needed, 
  // but for now I'll just hardcode the counts or use a loop.
  const recentPatternsCount = 8;
  const recentPatterns = Array.from({ length: recentPatternsCount }).map((_, i) => t(`about.recentPatterns.${i}` as any));
  const enforcementCount = 3;
  const enforcementItems = Array.from({ length: enforcementCount }).map((_, i) => t(`about.enforcementItems.${i}` as any));

  return (
    <main className="py-10">
      <Container size="wide">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge>{t("about.badgeAbout")}</Badge>
                <Badge variant="accent">{t("about.badgePolicy")}</Badge>
              </div>
              <h1 className="font-display text-2xl font-bold text-[color:var(--ink)]">
                {t("about.heroTitle")}
              </h1>
              <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
                {t("about.heroDescription")}
              </p>
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm font-medium text-[color:var(--ink-soft)]">
                <Shield className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                {t("about.heroNote")}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {prohibitedCategories.map((category) => (
              <Card key={category.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
                    {category.examples}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                {t("about.recentPatternsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {recentPatterns.map((pattern) => (
                  <li
                    key={pattern}
                    className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--ink-soft)]"
                  >
                    <span className="mt-0.5 shrink-0 text-[color:var(--gold)]" aria-hidden="true">
                      -
                    </span>
                    {pattern}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("about.enforcementTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2">
                {enforcementItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--ink-soft)]">
                    <span className="mt-0.5 shrink-0 text-[color:var(--accent)]" aria-hidden="true">
                      {i + 1}.
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Separator />
              <div className="flex flex-wrap gap-3">
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
                  <Button variant="primary">{t("skills.browseDescription")}</Button>
                </Link>
                <a
                  href="https://github.com/openclaw/clawhub/blob/main/docs/acceptable-usage.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline">{t("about.reviewerDoc")}</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
