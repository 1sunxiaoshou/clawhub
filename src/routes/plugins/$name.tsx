import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, Copy, Check, Download } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Container } from "../../components/layout/Container";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { SecurityScanResults } from "../../components/SkillSecurityScanResults";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatRetryDelay } from "../../lib/formatRetryDelay";
import { useI18n } from "../../lib/i18n";
import {
  fetchPackageDetail,
  fetchPackageReadme,
  fetchPackageVersion,
  getPackageDownloadPath,
  isRateLimitedPackageApiError,
  type PackageDetailResponse,
  type PackageVersionDetail,
} from "../../lib/packageApi";
import { familyLabel } from "../../lib/packageLabels";

type PluginDetailRateLimitState =
  | {
      scope: "detail" | "metadata";
      retryAfterSeconds: number | null;
    }
  | null;

type PluginDetailLoaderData = {
  detail: PackageDetailResponse;
  version: PackageVersionDetail | null;
  readme: string | null;
  rateLimited: PluginDetailRateLimitState;
};

export const Route = createFileRoute("/plugins/$name")({
  loader: async ({ params }): Promise<PluginDetailLoaderData> => {
    const requestedName = params.name;
    const candidateNames = requestedName.includes("/")
      ? [requestedName]
      : [requestedName, `@openclaw/${requestedName}`];

    let resolvedName = requestedName;
    let detail: PackageDetailResponse = { package: null, owner: null };
    for (const candidateName of candidateNames) {
      let candidateDetail: PackageDetailResponse;
      try {
        candidateDetail = await fetchPackageDetail(candidateName);
      } catch (error) {
        if (isRateLimitedPackageApiError(error)) {
          return {
            detail: { package: null, owner: null },
            version: null,
            readme: null,
            rateLimited: {
              scope: "detail",
              retryAfterSeconds: error.retryAfterSeconds,
            },
          };
        }
        throw error;
      }
      if (candidateDetail.package) {
        detail = candidateDetail;
        resolvedName = candidateName;
        break;
      }
      detail = candidateDetail;
    }

    if (!detail.package) {
      return {
        detail,
        version: null,
        readme: null,
        rateLimited: null,
      };
    }

    let metadataRateLimited: PluginDetailRateLimitState = null;
    const readmePromise = fetchPackageReadme(resolvedName).catch((error: unknown) => {
      if (!isRateLimitedPackageApiError(error)) throw error;
      metadataRateLimited ??= {
        scope: "metadata",
        retryAfterSeconds: error.retryAfterSeconds,
      };
      return null;
    });
    const versionPromise = detail.package?.latestVersion
      ? fetchPackageVersion(resolvedName, detail.package.latestVersion).catch((error: unknown) => {
          if (!isRateLimitedPackageApiError(error)) throw error;
          metadataRateLimited ??= {
            scope: "metadata",
            retryAfterSeconds: error.retryAfterSeconds,
          };
          return null;
        })
      : Promise.resolve(null);
    const [version, readme] = await Promise.all([versionPromise, readmePromise]);
    return { detail, version, readme, rateLimited: metadataRateLimited };
  },
  head: ({ params, loaderData }) => ({
    meta: [
      {
        title: loaderData?.detail.package?.displayName
          ? `${loaderData.detail.package.displayName} · Plugins`
          : params.name,
      },
      {
        name: "description",
        content: loaderData?.detail.package?.summary ?? `Plugin ${params.name}`,
      },
    ],
  }),
  component: PluginDetailRoute,
});

function VerifiedBadge() {
  const { locale } = useI18n();
  const label = locale === "zh-CN" ? "已验证发布者" : "Verified publisher";
  return (
    <span className="inline-flex items-center gap-1.5 text-[#3b82f6]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={label}
        className="shrink-0"
      >
        <path
          d="M8 0L9.79 1.52L12.12 1.21L12.93 3.41L15.01 4.58L14.42 6.84L15.56 8.82L14.12 10.5L14.12 12.82L11.86 13.41L10.34 15.27L8 14.58L5.66 15.27L4.14 13.41L1.88 12.82L1.88 10.5L0.44 8.82L1.58 6.84L0.99 4.58L3.07 3.41L3.88 1.21L6.21 1.52L8 0Z"
          fill="#3b82f6"
        />
        <path
          d="M5.5 8L7 9.5L10.5 6"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {locale === "zh-CN" ? "已验证" : "Verified"}
    </span>
  );
}

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand("copy");
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function CopyButton({ text }: { text: string }) {
  const { locale } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const label =
    state === "copied"
      ? locale === "zh-CN"
        ? "已复制"
        : "Copied"
      : state === "failed"
        ? locale === "zh-CN"
          ? "复制失败"
          : "Failed"
        : locale === "zh-CN"
          ? "复制"
          : "Copy";
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full shrink-0 sm:w-auto"
      onClick={() => {
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard
            .writeText(text)
            .then(() => {
              setState("copied");
              setTimeout(() => setState("idle"), 2000);
            })
            .catch(() => {
              if (fallbackCopy(text)) {
                setState("copied");
                setTimeout(() => setState("idle"), 2000);
              } else {
                setState("failed");
                setTimeout(() => setState("idle"), 2000);
              }
            });
        } else if (fallbackCopy(text)) {
          setState("copied");
          setTimeout(() => setState("idle"), 2000);
        } else {
          setState("failed");
          setTimeout(() => setState("idle"), 2000);
        }
      }}
      aria-label={locale === "zh-CN" ? "复制到剪贴板" : "Copy to clipboard"}
    >
      {state === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

function getCapabilityLabels(locale: "zh-CN" | "en"): Record<string, string> {
  return locale === "zh-CN"
    ? {
        executesCode: "会执行代码",
        runtimeId: "运行时 ID",
        pluginKind: "插件类型",
        channels: "渠道",
        providers: "Provider",
        hooks: "Hooks",
        bundledSkills: "内置技能",
        setupEntry: "安装入口",
        toolNames: "工具",
        commandNames: "命令",
        serviceNames: "服务",
        capabilityTags: "标签",
        httpRouteCount: "HTTP 路由",
        bundleFormat: "打包格式",
        hostTargets: "宿主目标",
      }
    : {
        executesCode: "Executes code",
        runtimeId: "Runtime ID",
        pluginKind: "Plugin kind",
        channels: "Channels",
        providers: "Providers",
        hooks: "Hooks",
        bundledSkills: "Bundled skills",
        setupEntry: "Setup entry",
        toolNames: "Tools",
        commandNames: "Commands",
        serviceNames: "Services",
        capabilityTags: "Tags",
        httpRouteCount: "HTTP routes",
        bundleFormat: "Bundle format",
        hostTargets: "Host targets",
      };
}

function formatCapabilityValue(
  value: unknown,
  text: { yes: string; no: string; none: string },
): string {
  if (typeof value === "boolean") return value ? text.yes : text.no;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length === 0 ? text.none : value.join(", ");
  return JSON.stringify(value);
}

function isEmptyObject(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return true;
  return Object.keys(obj).length === 0;
}

function PluginDetailRoute() {
  const { locale } = useI18n();
  const { name } = Route.useParams();
  const { detail, version, readme, rateLimited } = Route.useLoaderData() as PluginDetailLoaderData;
  const capabilityLabels = getCapabilityLabels(locale);
  const text =
    locale === "zh-CN"
      ? {
          detailRateLimitedTitle: "插件详情暂时不可用",
          detailRateLimitedDescription: `公共插件 API 当前触发了限流。请${formatRetryDelay(
            rateLimited?.retryAfterSeconds ?? null,
          )}后重试。`,
          tryAgain: "重试",
          notFoundTitle: "未找到插件",
          notFoundDescription: "这个插件不存在，或已被移除。",
          metadataUnavailable: "部分元数据暂时不可用",
          noSummary: "未提供摘要。",
          runtime: "运行时",
          by: "作者",
          communityWarning: "社区代码插件。安装前请先检查兼容性与验证状态。",
          latestRelease: "最新版本",
          downloadZip: "下载 zip",
          capabilities: "能力",
          compatibility: "兼容性",
          verification: "验证",
          source: "源码",
          commit: "提交",
          tag: "标签",
          provenance: "来源证明",
          scanStatus: "扫描状态",
          tier: "等级",
          scope: "范围",
          summary: "摘要",
          tags: "标签",
          yes: "是",
          no: "否",
          none: "无",
        }
      : {
          detailRateLimitedTitle: "Plugin details are temporarily unavailable",
          detailRateLimitedDescription: `The public plugin API is rate-limited right now. Try again ${formatRetryDelay(
            rateLimited?.retryAfterSeconds ?? null,
          )}.`,
          tryAgain: "Try again",
          notFoundTitle: "Plugin not found",
          notFoundDescription: "This plugin does not exist or has been removed.",
          metadataUnavailable: "Some metadata is temporarily unavailable",
          noSummary: "No summary provided.",
          runtime: "runtime",
          by: "by",
          communityWarning: "Community code plugin. Review compatibility and verification before install.",
          latestRelease: "Latest release",
          downloadZip: "Download zip",
          capabilities: "Capabilities",
          compatibility: "Compatibility",
          verification: "Verification",
          source: "Source",
          commit: "Commit",
          tag: "Tag",
          provenance: "Provenance",
          scanStatus: "Scan status",
          tier: "Tier",
          scope: "Scope",
          summary: "Summary",
          tags: "Tags",
          yes: "Yes",
          no: "No",
          none: "None",
        };

  if (rateLimited?.scope === "detail") {
    return (
      <main className="py-10">
        <Container size="narrow">
          <EmptyState
            icon={AlertTriangle}
            title={text.detailRateLimitedTitle}
            description={text.detailRateLimitedDescription}
            action={{
              label: text.tryAgain,
              onClick: () => window.location.reload(),
            }}
          />
        </Container>
      </main>
    );
  }

  if (!detail.package) {
    return (
      <main className="py-10">
        <Container size="narrow">
          <EmptyState
            title={text.notFoundTitle}
            description={text.notFoundDescription}
          />
        </Container>
      </main>
    );
  }

  const pkg = detail.package;
  const owner = detail.owner;
  const latestRelease = version?.version ?? null;
  const installSnippet =
    pkg.family === "code-plugin"
      ? `openclaw plugins install clawhub:${pkg.name}`
      : pkg.family === "bundle-plugin"
        ? `openclaw bundles install clawhub:${pkg.name}`
        : `openclaw skills install ${pkg.name}`;

  const capabilities = latestRelease?.capabilities ?? pkg.capabilities;
  const compatibility = latestRelease?.compatibility ?? pkg.compatibility;
  const verification = latestRelease?.verification ?? pkg.verification;

  const capEntries = capabilities
    ? Object.entries(capabilities).filter(
        ([, v]) =>
          v !== undefined && v !== null && v !== false && !(Array.isArray(v) && v.length === 0),
      )
    : [];

  const compatEntries = compatibility
    ? Object.entries(compatibility).filter(([, v]) => v !== undefined && v !== null)
    : [];

  return (
    <main className="py-10">
      <Container>
        <div className="flex flex-col gap-5">
          {/* Header card */}
          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge>{familyLabel(pkg.family)}</Badge>
                {verification?.tier ? (
                  <Badge variant="compact">{verification.tier.replace(/-/g, " ")}</Badge>
                ) : null}
                {rateLimited?.scope === "metadata" ? (
                  <Badge variant="compact">{text.metadataUnavailable}</Badge>
                ) : null}
                {pkg.isOfficial ? (
                  <Badge className="bg-[rgba(59,130,246,0.15)] text-[#3b82f6]">
                    <VerifiedBadge />
                  </Badge>
                ) : null}
              </div>
              <h1 className="font-display text-2xl font-bold text-[color:var(--ink)] mb-1">
                {pkg.displayName}
                {pkg.latestVersion ? (
                  <span className="ml-2 inline-block rounded-[var(--radius-pill)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-xs font-semibold text-[color:var(--ink-soft)]">
                    v{pkg.latestVersion}
                  </span>
                ) : null}
              </h1>
              <p className="text-sm text-[color:var(--ink-soft)] mb-2">
                {pkg.summary ?? text.noSummary}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--ink-soft)]">
                <span className="font-mono text-xs">{pkg.name}</span>
                {pkg.runtimeId ? (
                  <>
                    <span className="opacity-40">&middot;</span>
                    <span>
                      {text.runtime} <span className="font-mono text-xs">{pkg.runtimeId}</span>
                    </span>
                  </>
                ) : null}
                {owner?.handle ? (
                  <>
                    <span className="opacity-40">&middot;</span>
                    <Link
                      to="/u/$handle"
                      params={{ handle: owner.handle }}
                      className="text-[color:var(--accent)] hover:underline"
                    >
                      {text.by} @{owner.handle}
                    </Link>
                  </>
                ) : null}
              </div>

              {pkg.family === "code-plugin" && !pkg.isOfficial ? (
                <Badge variant="accent" className="mt-3 self-start">
                  {text.communityWarning}
                </Badge>
              ) : null}

              {/* Install */}
              <div className="mt-4">
                <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3 sm:flex-row sm:items-center sm:gap-2">
                  <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-[color:var(--ink)]">
                    <code>{installSnippet}</code>
                  </pre>
                  <CopyButton text={installSnippet} />
                </div>
              </div>

              {/* Latest Release */}
              {pkg.latestVersion ? (
                <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
                  <span className="text-sm">
                    {text.latestRelease}: <strong>v{pkg.latestVersion}</strong>
                  </span>
                  <a
                    href={getPackageDownloadPath(name, pkg.latestVersion)}
                    className="inline-flex min-h-[34px] w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--border-ui)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] transition-all duration-200 no-underline hover:border-[color:var(--border-ui-hover)] hover:bg-[color:var(--surface)] sm:w-auto sm:whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {text.downloadZip}
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Capabilities */}
          {capEntries.length > 0 ? (
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{text.capabilities}</CardTitle>
                <CopyButton text={JSON.stringify(capabilities, null, 2)} />
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-3 text-sm">
                  {capEntries.map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)] sm:pr-2">
                        {capabilityLabels[key] ?? key}
                      </dt>
                      <dd className="text-[color:var(--ink)]">
                        {key === "capabilityTags" && Array.isArray(value) ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(value as string[]).map((tag) => (
                              <Link key={tag} to="/plugins" search={{ q: tag }}>
                                <Badge variant="compact">{tag}</Badge>
                              </Link>
                            ))}
                          </div>
                        ) : key === "hostTargets" && Array.isArray(value) ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(value as string[]).map((target) => (
                              <Badge key={target} variant="compact">
                                {target}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          formatCapabilityValue(value, text)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Compatibility */}
          {compatEntries.length > 0 ? (
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{text.compatibility}</CardTitle>
                <CopyButton text={JSON.stringify(compatibility, null, 2)} />
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-3 text-sm">
                  {compatEntries.map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)] sm:pr-2">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                      </dt>
                      <dd className="font-mono text-xs text-[color:var(--ink)]">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Security Scan */}
          {latestRelease ? (
            <Card>
              <CardContent>
                <SecurityScanResults
                  sha256hash={latestRelease.sha256hash ?? undefined}
                  vtAnalysis={latestRelease.vtAnalysis ?? undefined}
                  llmAnalysis={latestRelease.llmAnalysis ?? undefined}
                  staticFindings={latestRelease.staticScan?.findings ?? []}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Verification */}
          {verification && !isEmptyObject(verification) ? (
            <Card>
              <CardHeader>
                <CardTitle>{text.verification}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-3 text-sm">
                  {verification.tier ? (
                    <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.tier}</dt>
                      <dd className="text-[color:var(--ink)]">
                        {verification.tier.replace(/-/g, " ")}
                      </dd>
                    </div>
                  ) : null}
                  {verification.scope ? (
                    <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.scope}</dt>
                      <dd className="text-[color:var(--ink)]">
                        {verification.scope.replace(/-/g, " ")}
                      </dd>
                    </div>
                  ) : null}
                  {verification.summary ? (
                    <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.summary}</dt>
                      <dd className="text-[color:var(--ink)]">{verification.summary}</dd>
                    </div>
                  ) : null}
                  {verification.sourceRepo
                    ? (() => {
                        const raw = verification.sourceRepo;
                        const href = /^https?:\/\//.test(raw) ? raw : `https://github.com/${raw}`;
                        const display = href.replace(/^https?:\/\//, "");
                        return (
                          <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                            <dt className="font-semibold text-[color:var(--ink-soft)]">{text.source}</dt>
                            <dd className="text-[color:var(--ink)]">
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[color:var(--accent)] hover:underline"
                              >
                                {display}
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            </dd>
                          </div>
                        );
                      })()
                    : null}
                  {verification.sourceCommit ? (
                    <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.commit}</dt>
                      <dd className="font-mono text-xs text-[color:var(--ink)]">
                        {verification.sourceCommit.slice(0, 12)}
                      </dd>
                    </div>
                  ) : null}
                  {verification.sourceTag ? (
                    <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.tag}</dt>
                      <dd className="font-mono text-xs text-[color:var(--ink)]">
                        {verification.sourceTag}
                      </dd>
                    </div>
                  ) : null}
                  {verification.hasProvenance !== undefined ? (
                    <div className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.provenance}</dt>
                      <dd className="text-[color:var(--ink)]">
                        {verification.hasProvenance ? text.yes : text.no}
                      </dd>
                    </div>
                  ) : null}
                  {verification.scanStatus ? (
                    <div className="flex flex-col gap-1.5 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{text.scanStatus}</dt>
                      <dd className="text-[color:var(--ink)]">{verification.scanStatus}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Tags */}
          {pkg.tags && Object.keys(pkg.tags).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{text.tags}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-3 text-sm">
                  {Object.entries(pkg.tags).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1.5 border-b border-[color:var(--line)] pb-3 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-x-4 sm:gap-y-0">
                      <dt className="font-semibold text-[color:var(--ink-soft)]">{key}</dt>
                      <dd className="font-mono text-xs text-[color:var(--ink)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Readme */}
          {readme ? (
            <Card>
              <CardContent>
                <MarkdownPreview>{readme}</MarkdownPreview>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
