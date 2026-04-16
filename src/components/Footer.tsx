import { useI18n } from "../lib/i18n";
import { useLocation } from "@tanstack/react-router";
import { getSiteName } from "../lib/site";
import { Container } from "./layout/Container";

export function Footer() {
  const siteName = getSiteName();
  const { t } = useI18n();
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <footer
      className={
        isHomePage ? "fixed inset-x-0 bottom-0 z-20 pb-5 pt-4 bg-transparent" : "mt-auto pb-8 pt-12"
      }
    >
      <Container>
        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.82rem] text-[color:var(--ink-soft)]"
        >
          <span className="font-semibold text-[color:var(--ink)]">{siteName}</span>
          <FooterLink href="https://clawhub.ai">ClawHub</FooterLink>
          <FooterLink href="https://openclaw.ai">OpenClaw</FooterLink>
          <FooterLink href="https://vercel.com">Vercel</FooterLink>
          <FooterLink href="https://www.convex.dev">Convex</FooterLink>
          <FooterLink href="https://github.com/openclaw/clawhub">
            {t("footer.opensource")} (MIT)
          </FooterLink>
          <FooterLink href="https://steipete.me">Peter Steinberger</FooterLink>
        </div>
      </Container>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[color:var(--ink-soft)] transition-colors duration-150 hover:text-[color:var(--ink)]"
    >
      {children}
    </a>
  );
}
