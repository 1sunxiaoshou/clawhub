import { useState } from "react";
import { useI18n } from "../lib/i18n";

type LlmAnalysisDimension = {
  name: string;
  label: string;
  rating: string;
  detail: string;
};

function getCapabilityLabels(locale: "zh-CN" | "en"): Record<string, string> {
  return locale === "zh-CN"
    ? {
        crypto: "加密货币",
        "requires-wallet": "需要钱包",
        "can-make-purchases": "可发起购买",
        "can-sign-transactions": "可签署交易",
        "requires-oauth-token": "需要 OAuth token",
        "posts-externally": "会向外部发布",
      }
    : {
        crypto: "Crypto",
        "requires-wallet": "Requires wallet",
        "can-make-purchases": "Can make purchases",
        "can-sign-transactions": "Can sign transactions",
        "requires-oauth-token": "Requires OAuth token",
        "posts-externally": "Posts externally",
      };
}

export type VtAnalysis = {
  status: string;
  verdict?: string;
  analysis?: string;
  source?: string;
  checkedAt: number;
};

export type LlmAnalysis = {
  status: string;
  verdict?: string;
  confidence?: string;
  summary?: string;
  dimensions?: LlmAnalysisDimension[];
  guidance?: string;
  findings?: string;
  model?: string;
  checkedAt: number;
};

export type StaticFinding = {
  code: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  evidence: string;
};

type SecurityScanResultsProps = {
  sha256hash?: string;
  vtAnalysis?: VtAnalysis | null;
  llmAnalysis?: LlmAnalysis | null;
  staticFindings?: StaticFinding[];
  capabilityTags?: string[] | null;
  variant?: "panel" | "badge";
};

function VirusTotalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 89"
      aria-label="VirusTotal"
    >
      <title>VirusTotal</title>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M45.292 44.5 0 89h100V0H0l45.292 44.5zM90 80H22l35.987-35.2L22 9h68v71z"
      />
    </svg>
  );
}

function OpenClawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="OpenClaw"
    >
      <title>OpenClaw</title>
      <path
        d="M12 2C8.5 2 5.5 4 4 7c-2 4-1 8 2 11 1.5 1.5 3.5 2.5 6 2.5s4.5-1 6-2.5c3-3 4-7 2-11-1.5-3-4.5-5-8-5z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M9 8c1-2 3-3 5-2s3 3 2 5l-3 4-2-1 3-4c.5-1 0-2-1-2.5S11 7 10.5 8L8 12l-2-1 3-4z"
        fill="currentColor"
      />
      <path
        d="M15 8c-1-2-3-3-5-2s-3 3-2 5l3 4 2-1-3-4c-.5-1 0-2 1-2.5S14 7 14.5 8L17 12l2-1-4-3z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

function getScanStatusInfo(status: string) {
  switch (status.toLowerCase()) {
    case "benign":
    case "clean":
      return { label: "Benign", className: "scan-status-clean" };
    case "malicious":
      return { label: "Malicious", className: "scan-status-malicious" };
    case "suspicious":
      return { label: "Suspicious", className: "scan-status-suspicious" };
    case "loading":
      return { label: "Loading...", className: "scan-status-pending" };
    case "pending":
    case "not_found":
      return { label: "Pending", className: "scan-status-pending" };
    case "error":
    case "failed":
      return { label: "Error", className: "scan-status-error" };
    default:
      return { label: status, className: "scan-status-unknown" };
  }
}

function getLocalizedScanStatusInfo(status: string, locale: "zh-CN" | "en") {
  const info = getScanStatusInfo(status);
  if (locale !== "zh-CN") return info;
  const labels: Record<string, string> = {
    Benign: "安全",
    Malicious: "恶意",
    Suspicious: "可疑",
    "Loading...": "加载中...",
    Pending: "等待中",
    Error: "错误",
  };
  return {
    ...info,
    label: labels[info.label] ?? info.label,
  };
}

function getDimensionIcon(rating: string) {
  switch (rating) {
    case "ok":
      return { className: "dimension-icon-ok", symbol: "\u2713" };
    case "note":
      return { className: "dimension-icon-note", symbol: "\u2139" };
    case "concern":
      return { className: "dimension-icon-concern", symbol: "!" };
    default:
      return { className: "dimension-icon-danger", symbol: "\u2717" };
  }
}

function LlmAnalysisDetail({ analysis }: { analysis: LlmAnalysis }) {
  const { locale } = useI18n();
  const verdict = analysis.verdict ?? analysis.status;
  const [isOpen, setIsOpen] = useState(false);

  const guidanceClass =
    verdict === "malicious" ? "malicious" : verdict === "suspicious" ? "suspicious" : "benign";

  return (
    <div className={`analysis-detail${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="analysis-detail-header"
        onClick={() => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) return;
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
      >
        <span className="analysis-summary-text">{analysis.summary}</span>
        <span className="analysis-detail-toggle">
          {locale === "zh-CN" ? "详情" : "Details"} <span className="chevron">{"\u25BE"}</span>
        </span>
      </button>
      <div className="analysis-body">
        {analysis.dimensions && analysis.dimensions.length > 0 ? (
          <div className="analysis-dimensions">
            {analysis.dimensions.map((dim) => {
              const icon = getDimensionIcon(dim.rating);
              return (
                <div key={dim.name} className="dimension-row">
                  <div className={`dimension-icon ${icon.className}`}>{icon.symbol}</div>
                  <div className="dimension-content">
                    <div className="dimension-label">{dim.label}</div>
                    <div className="dimension-detail">{dim.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        {analysis.findings ? (
            <div className="scan-findings-section">
            <div className="scan-findings-title">
              {locale === "zh-CN" ? "扫描发现上下文" : "Scan Findings in Context"}
            </div>
            {(() => {
              const counts = new Map<string, number>();
              return analysis.findings.split("\n").map((line) => {
                const count = (counts.get(line) ?? 0) + 1;
                counts.set(line, count);
                return (
                  <div key={`${line}-${count}`} className="scan-finding-row">
                    {line}
                  </div>
                );
              });
            })()}
          </div>
        ) : null}
        {analysis.guidance ? (
          <div className={`analysis-guidance ${guidanceClass}`}>
            <div className="analysis-guidance-label">
              {locale === "zh-CN"
                ? verdict === "malicious"
                  ? "请勿安装此技能"
                  : verdict === "suspicious"
                    ? "安装前请注意"
                    : "评估结论"
                : verdict === "malicious"
                  ? "Do not install this skill"
                  : verdict === "suspicious"
                    ? "What to consider before installing"
                    : "Assessment"}
            </div>
            {analysis.guidance}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isCleanStatus(status?: string) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "clean" || s === "benign";
}

const EXTERNALLY_CLEARED_STATIC_CODES = new Set(["suspicious.env_credential_access"]);

function areStaticFindingsExternallyCleared(
  findings: StaticFinding[],
  vtStatus?: string,
  llmStatus?: string,
) {
  return (
    findings.length > 0 &&
    isCleanStatus(vtStatus) &&
    isCleanStatus(llmStatus) &&
    findings.every((finding) => EXTERNALLY_CLEARED_STATIC_CODES.has(finding.code))
  );
}

function getStaticGuidance(
  findings: StaticFinding[],
  vtStatus: string | undefined,
  llmStatus: string | undefined,
  locale: "zh-CN" | "en",
) {
  const hasMaliciousCode = findings.some((f) => f.code.startsWith("malicious."));
  const zh = locale === "zh-CN";
  if (hasMaliciousCode) {
    return {
      className: "malicious",
      label: zh ? "严重安全风险" : "Critical security concern",
      text: zh
        ? "这些模式表明代码可能存在危险行为。安装前请保持高度谨慎，并完整审查代码。"
        : "These patterns indicate potentially dangerous behavior. Exercise extreme caution and review the code thoroughly before installing.",
    };
  }
  const externallyCleared = areStaticFindingsExternallyCleared(findings, vtStatus, llmStatus);
  if (externallyCleared) {
    return {
      className: "benign",
      label: zh ? "已被外部扫描确认安全" : "Confirmed safe by external scanners",
      text: zh
        ? "静态分析检测到了 API 凭据访问模式，但 VirusTotal 和 OpenClaw 都确认该技能是安全的。这类模式在合法的 API 集成技能中很常见。"
        : "Static analysis detected API credential-access patterns, but both VirusTotal and OpenClaw confirmed this skill is safe. These patterns are common in legitimate API integration skills.",
    };
  }
  const hasCritical = findings.some((f) => f.severity === "critical");
  if (hasCritical) {
    return {
      className: "suspicious",
      label: zh ? "建议重点审查的模式" : "Patterns worth reviewing",
      text: zh
        ? "这些模式可能意味着存在风险。安装前请结合上方 VirusTotal 和 OpenClaw 的结果做上下文判断。"
        : "These patterns may indicate risky behavior. Check the VirusTotal and OpenClaw results above for context-aware analysis before installing.",
    };
  }
  return {
    className: "benign",
    label: zh ? "关于静态分析" : "About static analysis",
    text: zh
      ? "这些模式来自自动化正则扫描。对于集成外部 API 的技能来说，它们也可能是正常行为。请结合上方 VirusTotal 和 OpenClaw 的结果做上下文判断。"
      : "These patterns were detected by automated regex scanning. They may be normal for skills that integrate with external APIs. Check the VirusTotal and OpenClaw results above for context-aware analysis.",
  };
}

function StaticAnalysisDetail({
  findings,
  vtStatus,
  llmStatus,
}: {
  findings: StaticFinding[];
  vtStatus?: string;
  llmStatus?: string;
}) {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const guidance = getStaticGuidance(findings, vtStatus, llmStatus, locale);

  return (
    <div className={`analysis-detail${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="analysis-detail-header"
        onClick={() => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) return;
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
      >
        <span className="analysis-summary-text">
          {locale === "zh-CN"
            ? `静态分析：发现 ${findings.length} 个模式`
            : `Static analysis: ${findings.length} pattern${findings.length !== 1 ? "s" : ""} detected`}
        </span>
        <span className="analysis-detail-toggle">
          {locale === "zh-CN" ? "详情" : "Details"} <span className="chevron">{"\u25BE"}</span>
        </span>
      </button>
      <div className="analysis-body">
        <div className="analysis-dimensions">
          {findings.map((finding, i) => {
            const icon =
              finding.severity === "critical"
                ? { className: "dimension-icon-danger", symbol: "\u2717" }
                : { className: "dimension-icon-concern", symbol: "!" };
            return (
              <div key={`${finding.code}-${finding.file}-${i}`} className="dimension-row">
                <div className={`dimension-icon ${icon.className}`}>{icon.symbol}</div>
                <div className="dimension-content">
                  <div className="dimension-label">
                    {finding.file}:{finding.line}
                  </div>
                  <div className="dimension-detail">{finding.message}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`analysis-guidance ${guidance.className}`}>
          <div className="analysis-guidance-label">{guidance.label}</div>
          {guidance.text}
        </div>
      </div>
    </div>
  );
}

export function SecurityScanResults({
  sha256hash,
  vtAnalysis,
  llmAnalysis,
  staticFindings,
  capabilityTags,
  variant = "panel",
}: SecurityScanResultsProps) {
  const { locale } = useI18n();
  const capabilityLabels = getCapabilityLabels(locale);
  const visibleCapabilityTags = (capabilityTags ?? []).filter(Boolean);
  const hasStaticFindings = staticFindings && staticFindings.length > 0;
  if (!sha256hash && !llmAnalysis && !hasStaticFindings && visibleCapabilityTags.length === 0) {
    return null;
  }

  const vtStatus = vtAnalysis?.status ?? "pending";
  const vtUrl = sha256hash ? `https://www.virustotal.com/gui/file/${sha256hash}` : null;
  const vtStatusInfo = getLocalizedScanStatusInfo(vtStatus, locale);
  const isCodeInsight = vtAnalysis?.source === "code_insight";
  const aiAnalysis = vtAnalysis?.analysis;

  const llmVerdict = llmAnalysis?.verdict ?? llmAnalysis?.status;
  const llmStatusInfo = llmVerdict ? getLocalizedScanStatusInfo(llmVerdict, locale) : null;

  if (variant === "badge") {
    return (
      <>
        {sha256hash ? (
          <div className="version-scan-badge">
            <VirusTotalIcon className="version-scan-icon version-scan-icon-vt" />
            <span className={vtStatusInfo.className}>{vtStatusInfo.label}</span>
            {vtUrl ? (
              <a
                href={vtUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="version-scan-link"
                onClick={(event) => event.stopPropagation()}
              >
                ↗
              </a>
            ) : null}
          </div>
        ) : null}
        {llmStatusInfo ? (
          <div className="version-scan-badge">
            <OpenClawIcon className="version-scan-icon version-scan-icon-oc" />
            <span className={llmStatusInfo.className}>{llmStatusInfo.label}</span>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="scan-results-panel">
      <div className="scan-results-title">{locale === "zh-CN" ? "安全扫描" : "Security Scan"}</div>
      <div className="scan-results-list">
        {visibleCapabilityTags.length > 0 ? (
          <div className="scan-capabilities-section">
            <div className="scan-findings-title">
              {locale === "zh-CN" ? "能力信号" : "Capability signals"}
            </div>
            <div className="scan-capability-tags">
              {visibleCapabilityTags.map((tag) => (
                <span key={tag} className="tag scan-capability-tag">
                  {capabilityLabels[tag] ?? tag}
                </span>
              ))}
            </div>
            <div className="scan-capability-note">
              {locale === "zh-CN"
                ? "这些标签描述了技能可能具备的权限范围，它们与“可疑”或“恶意”的审核结论是分开的。"
                : "These labels describe what authority the skill may exercise. They are separate from suspicious or malicious moderation verdicts."}
            </div>
          </div>
        ) : null}
        {sha256hash ? (
          <div className="scan-result-row">
            <div className="scan-result-scanner">
              <VirusTotalIcon className="scan-result-icon scan-result-icon-vt" />
              <span className="scan-result-scanner-name">VirusTotal</span>
            </div>
            <div className={`scan-result-status ${vtStatusInfo.className}`}>
              {vtStatusInfo.label}
            </div>
            {vtUrl ? (
              <a
                href={vtUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="scan-result-link"
              >
                {locale === "zh-CN" ? "查看报告 →" : "View report →"}
              </a>
            ) : null}
          </div>
        ) : null}
        {isCodeInsight && aiAnalysis && (vtStatus === "malicious" || vtStatus === "suspicious") ? (
          <div className={`code-insight-analysis ${vtStatus}`}>
            <div className="code-insight-label">
              {locale === "zh-CN" ? "代码洞察" : "Code Insight"}
            </div>
            <p className="code-insight-text">{aiAnalysis}</p>
          </div>
        ) : null}
        {llmStatusInfo && llmAnalysis ? (
          <div className="scan-result-row">
            <div className="scan-result-scanner">
              <OpenClawIcon className="scan-result-icon scan-result-icon-oc" />
              <span className="scan-result-scanner-name">OpenClaw</span>
            </div>
            <div className={`scan-result-status ${llmStatusInfo.className}`}>
              {llmStatusInfo.label}
            </div>
            {llmAnalysis.confidence ? (
              <span className="scan-result-confidence">
                {locale === "zh-CN"
                  ? `置信度 ${llmAnalysis.confidence}`
                  : `${llmAnalysis.confidence} confidence`}
              </span>
            ) : null}
          </div>
        ) : null}
        {llmAnalysis &&
        llmAnalysis.status !== "error" &&
        llmAnalysis.status !== "pending" &&
        llmAnalysis.summary ? (
          <LlmAnalysisDetail analysis={llmAnalysis} />
        ) : null}
        {staticFindings && staticFindings.length > 0 ? (
          <StaticAnalysisDetail
            findings={staticFindings}
            vtStatus={vtStatus}
            llmStatus={llmVerdict}
          />
        ) : null}
      </div>
    </div>
  );
}
