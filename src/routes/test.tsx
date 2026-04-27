import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Activity,
  Archive,
  BadgeCheck,
  Ban,
  Building2,
  Copy,
  EyeOff,
  ExternalLink,
  GitMerge,
  History,
  KeyRound,
  Lock,
  Package,
  RotateCcw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  UserCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ObjectManagementForm,
  type PrototypeOperationKind,
} from "../components/test-management/OperationPanel";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useAuthStatus } from "../lib/useAuthStatus";

export const Route = createFileRoute("/test")({
  component: TestManagementPrototype,
});

type ModuleKey = "overview" | "orgs" | "apikeys" | "skills" | "users" | "packages" | "audit";
type Tone = "critical" | "warning" | "pending" | "success" | "neutral";

type PublicUser = {
  _id: Id<"users">;
  handle?: string | null;
  name?: string | null;
  displayName?: string | null;
  image?: string | null;
};

type PublicPublisher = {
  _id: Id<"publishers">;
  kind: "user" | "org";
  handle: string;
  displayName: string;
  linkedUserId?: Id<"users"> | null;
};

type SkillSummary = {
  _id: Id<"skills">;
  slug: string;
  displayName: string;
  summary: string | null;
  owner: PublicPublisher | null;
  ownerUserId: Id<"users">;
  visibility: "public" | "restricted" | "private";
  moderationStatus: "active" | "hidden" | "removed";
  moderationReason: string | null;
  moderationVerdict: "clean" | "suspicious" | "malicious" | null;
  moderationFlags: string[];
  moderationSummary: string | null;
  isSuspicious: boolean;
  reportCount: number;
  lastReportedAt: number | null;
  canonicalSkillId: Id<"skills"> | null;
  manualOverride: {
    verdict: "clean";
    note: string;
    reviewerUserId: Id<"users">;
    updatedAt: number;
  } | null;
  capabilityTags: string[];
  badges: Partial<
    Record<
      "highlighted" | "official" | "deprecated" | "redactionApproved",
      { byUserId: Id<"users">; at: number }
    >
  > | null;
  batch: string | null;
  softDeletedAt: number | null;
  stats: {
    downloads: number;
    installsCurrent?: number;
    installsAllTime?: number;
    stars: number;
    versions: number;
    comments: number;
  };
  createdAt: number;
  updatedAt: number;
  latestVersion: {
    version: string;
    createdAt: number;
    fingerprint: string | null;
    fileCount: number;
    totalBytes: number;
    staticScanStatus: string | null;
    staticScanSummary: string | null;
    vtStatus: string | null;
    llmStatus: string | null;
  } | null;
};

type ReportedSkill = SkillSummary & {
  reports: Array<{
    reason: string;
    createdAt: number;
    reporter: PublicUser | null;
  }>;
};

type ManagementConsoleData = {
  viewer: {
    _id: Id<"users"> | null;
    handle: string | null;
    displayName: string | null;
    role: "admin" | "moderator" | "user" | "preview";
  };
  capabilities: {
    canManageUsers: boolean;
    canViewAllApiTokens: boolean;
    readOnlyPrototype: boolean;
  };
  reportedSkills: ReportedSkill[];
  suspiciousSkills: SkillSummary[];
  recentVersions: Array<{
    version: NonNullable<SkillSummary["latestVersion"]> & { _id: Id<"skillVersions"> };
    skill: SkillSummary | null;
  }>;
  duplicateCandidates: Array<{
    skill: SkillSummary;
    fingerprint: string;
    matches: Array<{
      _id: Id<"skills">;
      slug: string;
      displayName: string;
      ownerHandle: string | null;
    }>;
  }>;
  organizations: Array<{
    publisher: {
      _id: Id<"publishers">;
      handle: string;
      displayName: string;
      trustedPublisher: boolean;
      createdAt: number;
      updatedAt: number;
    };
    memberCount: number;
    ownerCount: number;
    adminCount: number;
    skillCount: number;
    packageCount: number;
  }>;
  apiTokens: Array<{
    _id: Id<"apiTokens">;
    label: string;
    prefix: string;
    createdAt: number;
    lastUsedAt: number | null;
    revokedAt: number | null;
    owner: PublicUser | null;
    ownToken: boolean;
  }>;
  users: Array<{
    _id: Id<"users">;
    handle: string | null;
    name: string | null;
    displayName: string | null;
    email: string | null;
    role: "admin" | "moderator" | "user";
    primaryLoginMethod: "password" | "wecom" | "github" | null;
    lastLoginAt: number | null;
    trustedPublisher: boolean;
    requiresModerationAt: number | null;
    requiresModerationReason: string | null;
    deactivatedAt: number | null;
    deletedAt: number | null;
    banReason: string | null;
    createdAt: number;
    updatedAt: number | null;
  }>;
  packages: Array<{
    packageId: Id<"packages">;
    name: string;
    displayName: string;
    family: "skill" | "code-plugin" | "bundle-plugin";
    channel: "official" | "community" | "private";
    isOfficial: boolean;
    ownerHandle?: string | null;
    ownerKind?: "user" | "org";
    summary?: string | null;
    latestVersion?: string | null;
    runtimeId?: string | null;
    executesCode?: boolean;
    verificationTier?: string;
    scanStatus?: "clean" | "suspicious" | "malicious" | "pending" | "not-run";
    createdAt: number;
    updatedAt: number;
  }>;
  auditLogs: Array<{
    _id: Id<"auditLogs">;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: unknown;
    createdAt: number;
    actor: PublicUser | null;
  }>;
};

type ConsoleAction = {
  label: string;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  icon?: typeof Activity;
  emphasis?: "primary" | "secondary";
  group?: "入口" | "治理" | "访问" | "标记" | "危险" | "其他";
  operation?: PrototypeOperationKind;
};

type ConsoleRow = {
  id: string;
  module: ModuleKey;
  sourceModule?: ModuleKey;
  title: string;
  subtitle: string;
  owner: string;
  status: string;
  tone: Tone;
  metric: string;
  updatedAt: number | null;
  summary: string;
  tags: string[];
  facts: Array<{ label: string; value: string; tone?: Tone }>;
  evidence: string[];
  timeline: Array<{ title: string; meta: string; time: number | null }>;
  actions: ConsoleAction[];
  searchText: string;
};

type ModuleConfig = {
  label: string;
  title: string;
  description: string;
  icon: typeof Activity;
  filters: string[];
};

function arrayOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

const moduleConfigs: Record<ModuleKey, ModuleConfig> = {
  overview: {
    label: "总览",
    title: "管理总览",
    description: "按风险和时效汇总今天最需要处理的对象。",
    icon: Activity,
    filters: ["全部", "高风险", "待处理", "最近更新"],
  },
  orgs: {
    label: "组织",
    title: "组织管理",
    description: "查看组织身份、成员结构和发布内容规模。",
    icon: Building2,
    filters: ["全部", "可信发布者", "有内容", "成员较少"],
  },
  apikeys: {
    label: "API Key",
    title: "API Key 管理",
    description: "查看 Token 状态、归属和最近使用时间。",
    icon: KeyRound,
    filters: ["全部", "有效", "已吊销", "我的 Key"],
  },
  skills: {
    label: "Skills",
    title: "Skill 管理",
    description: "优先处理举报、扫描可疑、重复候选和最近发布。",
    icon: Shield,
    filters: ["全部", "举报", "扫描可疑", "重复候选", "最近发布"],
  },
  users: {
    label: "用户",
    title: "用户管理",
    description: "查看用户角色、登录状态、信任状态和治理标记。",
    icon: UserCog,
    filters: ["全部", "管理员", "待处理", "已封禁", "可信发布者"],
  },
  packages: {
    label: "Packages",
    title: "Package 管理",
    description: "检查发布通道、代码执行能力、扫描状态和版本新鲜度。",
    icon: Package,
    filters: ["全部", "官方", "私有", "代码执行", "扫描异常"],
  },
  audit: {
    label: "审计",
    title: "审计日志",
    description: "追踪关键管理动作的执行人、对象和时间。",
    icon: History,
    filters: ["全部", "用户", "Skill", "Package", "组织"],
  },
};

const toneClasses: Record<Tone, string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  pending: "border-zinc-200 bg-zinc-100 text-zinc-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neutral: "border-[#d8d8d0] bg-white text-[#555550]",
};

function TestManagementPrototype() {
  const { isLoading } = useAuthStatus();
  const data = useQuery(api.management.getConsoleData, { limit: 30 }) as
    | ManagementConsoleData
    | undefined;

  const [activeModule, setActiveModule] = useState<ModuleKey>("overview");
  const [activeFilter, setActiveFilter] = useState("全部");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const rowsByModule = useMemo(() => (data ? buildRows(data) : emptyRows()), [data]);
  const activeConfig = moduleConfigs[activeModule];
  const moduleRows = rowsByModule[activeModule];
  const filteredRows = useMemo(
    () => filterRows(moduleRows, activeFilter, query),
    [moduleRows, activeFilter, query],
  );
  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const visibleIds = filteredRows.map((row) => row.id).join("|");

  useEffect(() => {
    setActiveFilter("全部");
    setQuery("");
  }, [activeModule]);

  useEffect(() => {
    if (!filteredRows.some((row) => row.id === selectedId)) {
      setSelectedId(filteredRows[0]?.id ?? "");
    }
  }, [filteredRows, selectedId, visibleIds]);

  const metrics = useMemo(() => (data ? buildMetrics(data, rowsByModule) : []), [data, rowsByModule]);

  if (isLoading && !data) {
    return <LoadingScreen />;
  }

  if (!data) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#111]">
      <div className="flex min-h-screen items-center justify-center px-6 xl:hidden">
        <div className="max-w-sm border border-[#d8d8d0] bg-white p-6 text-center">
          <Shield className="mx-auto h-7 w-7 text-[#111]" />
          <h1 className="mt-4 text-lg font-semibold">管理台原型仅支持桌面端预览</h1>
          <p className="mt-2 text-sm text-[#666660]">请使用更宽的桌面窗口查看三栏工作台。</p>
        </div>
      </div>

      <div className="hidden min-h-screen xl:grid xl:grid-cols-[224px_minmax(0,1fr)_360px]">
        <aside className="border-r border-[#d8d8d0] bg-[#fbfbf8]">
          <div className="flex h-16 items-center border-b border-[#d8d8d0] px-5">
            <div>
              <div className="text-sm font-semibold">ClawHub 管理台</div>
              <div className="mt-0.5 text-xs text-[#74746d]">
                {viewerModeLabel(data.viewer.role)}
              </div>
            </div>
          </div>
          <nav className="p-3">
            {(Object.keys(moduleConfigs) as ModuleKey[]).map((key) => {
              const item = moduleConfigs[key];
              const Icon = item.icon;
              const count = rowsByModule[key].length;
              const active = activeModule === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveModule(key)}
                  className={[
                    "mb-1 flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-sm transition",
                    active
                      ? "bg-[#111] text-white"
                      : "text-[#555550] hover:bg-[#ecece7] hover:text-[#111]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <span className={active ? "text-white/70" : "text-[#8a8a83]"}>{count}</span>
                </button>
              );
            })}
          </nav>
          <div className="mx-3 mt-4 border-t border-[#d8d8d0] pt-4">
            <div className="px-3 text-xs font-medium text-[#74746d]">当前数据</div>
            <div className="mt-3 space-y-2 px-3 text-xs text-[#555550]">
              <div className="flex justify-between">
                <span>API Key 范围</span>
                <span>{data.capabilities.canViewAllApiTokens ? "全部" : "公开预览隐藏"}</span>
              </div>
              <div className="flex justify-between">
                <span>用户治理</span>
                <span>{data.capabilities.canManageUsers ? "完整" : "公开资料"}</span>
              </div>
              <div className="flex justify-between">
                <span>操作模式</span>
                <span>只读原型</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 border-r border-[#d8d8d0]">
          <header className="border-b border-[#d8d8d0] bg-[#f7f7f5] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{activeConfig.title}</h1>
                <p className="mt-1 text-sm text-[#666660]">{activeConfig.description}</p>
              </div>
            </div>
            {activeModule === "overview" ? (
              <div className="mt-5 grid grid-cols-5 gap-2">
                {metrics.map((metric) => (
                  <MetricPill key={metric.label} {...metric} />
                ))}
              </div>
            ) : null}
          </header>

          <div className="border-b border-[#d8d8d0] bg-[#fbfbf8] px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[280px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a83]" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索名称、负责人、状态或动作"
                  className="h-9 rounded-[8px] border-[#d8d8d0] bg-white pl-9 text-sm"
                />
              </div>
              <div className="flex rounded-[8px] border border-[#d8d8d0] bg-white p-0.5">
                {activeConfig.filters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={[
                      "h-8 rounded-[6px] px-3 text-xs font-medium transition",
                      activeFilter === filter
                        ? "bg-[#111] text-white"
                        : "text-[#666660] hover:bg-[#eeeeea] hover:text-[#111]",
                    ].join(" ")}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={[
              "overflow-auto bg-[#f7f7f5]",
              activeModule === "overview" ? "h-[calc(100vh-221px)]" : "h-[calc(100vh-151px)]",
            ].join(" ")}
          >
            {filteredRows.length === 0 ? (
              <EmptyRows query={query} />
            ) : (
              <Table className="table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-[#f7f7f5]">
                  <TableRow className="border-[#d8d8d0] hover:bg-transparent">
                    <TableHead className="w-[42%] px-6 text-xs">对象</TableHead>
                    <TableHead className="w-[16%] text-xs">状态</TableHead>
                    <TableHead className="w-[16%] text-xs">负责人</TableHead>
                    <TableHead className="w-[17%] text-xs">关键信息</TableHead>
                    <TableHead className="w-[9%] text-right text-xs">更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={selectedRow?.id === row.id ? "selected" : undefined}
                      onClick={() => setSelectedId(row.id)}
                      className="cursor-pointer border-[#deded7] bg-white/40 hover:bg-white"
                    >
                      <TableCell className="px-6 py-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <SeverityDot tone={row.tone} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#111]">
                              {row.title}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-[#74746d]">
                              {row.subtitle}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="truncate text-xs text-[#555550]">{row.owner}</TableCell>
                      <TableCell className="truncate text-xs text-[#555550]">{row.metric}</TableCell>
                      <TableCell className="text-right text-xs text-[#74746d]">
                        {formatRelativeTime(row.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        <Inspector row={selectedRow} activeModule={activeModule} />
      </div>
    </main>
  );
}

function buildRows(data: ManagementConsoleData): Record<ModuleKey, ConsoleRow[]> {
  const reportedSkills = arrayOf(data.reportedSkills);
  const suspiciousSkills = arrayOf(data.suspiciousSkills);
  const duplicateCandidates = arrayOf(data.duplicateCandidates);
  const recentVersions = arrayOf(data.recentVersions);
  const organizations = arrayOf(data.organizations);
  const apiTokens = arrayOf(data.apiTokens);
  const users = arrayOf(data.users);
  const packages = arrayOf(data.packages);
  const auditLogs = arrayOf(data.auditLogs);
  const skills: ConsoleRow[] = [
    ...reportedSkills.map((skill) => skillReportRow(skill)),
    ...suspiciousSkills.map((skill) => suspiciousSkillRow(skill)),
    ...duplicateCandidates.map((candidate) => duplicateRow(candidate)),
    ...recentVersions
      .filter((entry) => entry.skill)
      .map((entry) => recentVersionRow(entry as { version: NonNullable<SkillSummary["latestVersion"]>; skill: SkillSummary })),
  ];
  const userRows = users.map(userRow);
  const packageRows = packages.map(packageRow);
  const attentionRows = [
    ...skills.filter((row) =>
      row.tags.some((tag) => ["举报", "扫描可疑", "重复候选"].includes(tag)),
    ),
    ...userRows.filter((row) => row.tags.includes("待处理") || row.tags.includes("已封禁")),
    ...packageRows.filter((row) => row.tags.includes("扫描异常")),
  ]
    .sort((a, b) => riskScore(b) - riskScore(a) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 30)
    .map((row) => ({ ...row, id: `overview:${row.id}`, module: "overview" as const, sourceModule: row.module }));

  return {
    overview: attentionRows,
    orgs: organizations.map(organizationRow),
    apikeys: apiTokens.map(apiTokenRow),
    skills,
    users: userRows,
    packages: packageRows,
    audit: auditLogs.map(auditRow),
  };
}

function emptyRows(): Record<ModuleKey, ConsoleRow[]> {
  return {
    overview: [],
    orgs: [],
    apikeys: [],
    skills: [],
    users: [],
    packages: [],
    audit: [],
  };
}

function buildMetrics(data: ManagementConsoleData, rows: Record<ModuleKey, ConsoleRow[]>) {
  const packages = arrayOf(data.packages);
  const apiTokens = arrayOf(data.apiTokens);
  const reportedSkills = arrayOf(data.reportedSkills);
  const organizations = arrayOf(data.organizations);
  const riskyPackages = packages.filter((pkg) =>
    ["suspicious", "malicious"].includes(pkg.scanStatus ?? ""),
  ).length;
  const revokedTokens = apiTokens.filter((token) => token.revokedAt).length;
  return [
    {
      label: "待处理",
      value: rows.overview.length,
      helper: "风险队列",
      tone: rows.overview.length > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      label: "举报 Skill",
      value: reportedSkills.length,
      helper: "真实举报",
      tone: reportedSkills.length > 0 ? ("critical" as const) : ("neutral" as const),
    },
    {
      label: "组织",
      value: organizations.length,
      helper: "当前可见",
      tone: "neutral" as const,
    },
    {
      label: "异常包",
      value: riskyPackages,
      helper: "扫描状态",
      tone: riskyPackages > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      label: "吊销 Key",
      value: revokedTokens,
      helper: data.capabilities.canViewAllApiTokens ? "全部 Key" : "我的 Key",
      tone: revokedTokens > 0 ? ("pending" as const) : ("neutral" as const),
    },
  ];
}

function skillReportRow(skill: ReportedSkill): ConsoleRow {
  const owner = ownerLabel(skill.owner, skill.ownerUserId);
  const statusTone: Tone = skill.reportCount >= 3 ? "critical" : "warning";
  const reportItems = arrayOf(skill.reports);
  const reports = reportItems.map(
    (report) => `${userLabel(report.reporter)}：${report.reason}`,
  );
  return createRow({
    id: `skill-report:${skill._id}`,
    module: "skills",
    title: skill.displayName,
    subtitle: `${owner}/${skill.slug}`,
    owner,
    status: `${skill.reportCount} 条举报`,
    tone: statusTone,
    metric: skill.latestVersion ? `v${skill.latestVersion.version}` : "无版本",
    updatedAt: skill.lastReportedAt ?? skill.updatedAt,
    summary: skill.summary ?? "该 Skill 收到用户举报，需要确认举报原因、扫描结果和最近版本变更。",
    tags: ["举报", statusTone === "critical" ? "高风险" : "待处理"],
    facts: [
      { label: "可见性", value: visibilityLabel(skill.visibility) },
      { label: "扫描", value: scanLabel(skill), tone: scanTone(skill) },
      { label: "人工覆盖", value: manualOverrideLabel(skill) },
      { label: "徽章", value: skillBadgeLabel(skill) },
      { label: "最近举报", value: formatRelativeTime(skill.lastReportedAt) },
    ],
    evidence: [
      ...(reports.length ? reports : ["举报原因为空，需要人工判断。"]),
      `当前可处理能力：隐藏/恢复、硬删除、封禁 owner、进入 Skill 管理。`,
    ],
    timeline: reportsToTimeline(reportItems),
    actions: skillActions(skill, "reports"),
  });
}

function suspiciousSkillRow(skill: SkillSummary): ConsoleRow {
  const owner = ownerLabel(skill.owner, skill.ownerUserId);
  return createRow({
    id: `skill-suspicious:${skill._id}`,
    module: "skills",
    title: skill.displayName,
    subtitle: `${owner}/${skill.slug}`,
    owner,
    status: skill.moderationVerdict === "malicious" ? "恶意" : "扫描可疑",
    tone: skill.moderationVerdict === "malicious" ? "critical" : "warning",
    metric: skill.moderationReason ?? "scanner",
    updatedAt: skill.updatedAt,
    summary: skill.moderationSummary ?? "扫描器或规则引擎标记了该 Skill，需要查看证据后处理。",
    tags: ["扫描可疑", "高风险", "待处理"],
    facts: [
      { label: "状态", value: moderationStatusLabel(skill.moderationStatus) },
      { label: "判定", value: skill.moderationVerdict ?? "未知" },
      { label: "人工覆盖", value: manualOverrideLabel(skill) },
      { label: "能力标签", value: capabilityTagLabel(skill) },
      { label: "可见性", value: visibilityLabel(skill.visibility) },
    ],
    evidence: [
      skill.moderationSummary,
      skill.latestVersion?.staticScanSummary,
      `当前可处理能力：人工标记 Clean、清除人工覆盖、调整可见性、访问授权、能力标签。`,
      ...(skill.moderationFlags ?? []),
    ].filter(Boolean) as string[],
    timeline: [
      {
        title: "扫描状态更新",
        meta: scanLabel(skill),
        time: skill.updatedAt,
      },
    ],
    actions: skillActions(skill, "suspicious"),
  });
}

function duplicateRow(candidate: ManagementConsoleData["duplicateCandidates"][number]): ConsoleRow {
  const skill = candidate.skill;
  const matches = arrayOf(candidate.matches);
  const owner = ownerLabel(skill.owner, skill.ownerUserId);
  return createRow({
    id: `duplicate:${skill._id}`,
    module: "skills",
    title: skill.displayName,
    subtitle: `${owner}/${skill.slug}`,
    owner,
    status: "重复候选",
    tone: "pending",
    metric: `${matches.length} 个匹配`,
    updatedAt: skill.updatedAt,
    summary: "最新版本指纹与其他 Skill 匹配，适合确认是否为 fork、重复发布或误报。",
    tags: ["重复候选", "待处理"],
    facts: [
      { label: "指纹", value: candidate.fingerprint.slice(0, 12) },
      { label: "匹配", value: `${matches.length} 个` },
      { label: "当前归并", value: skill.canonicalSkillId ? "已设置" : "未设置" },
      { label: "可见性", value: visibilityLabel(skill.visibility) },
    ],
    evidence: [
      ...matches.map((match) => `${match.ownerHandle ? `@${match.ownerHandle}/` : ""}${match.slug}`),
      "当前可处理能力：设为重复、清除重复标记、打开候选对象比对。",
    ],
    timeline: [
      {
        title: "发现相同指纹",
        meta: candidate.fingerprint.slice(0, 20),
        time: skill.updatedAt,
      },
    ],
    actions: skillActions(skill, "duplicate"),
  });
}

function recentVersionRow(entry: { version: NonNullable<SkillSummary["latestVersion"]>; skill: SkillSummary }): ConsoleRow {
  const skill = entry.skill;
  const owner = ownerLabel(skill.owner, skill.ownerUserId);
  return createRow({
    id: `recent-version:${skill._id}:${entry.version.version}`,
    module: "skills",
    title: skill.displayName,
    subtitle: `${owner}/${skill.slug}`,
    owner,
    status: "最近发布",
    tone: scanTone(skill),
    metric: `v${entry.version.version} · ${entry.version.fileCount} 文件`,
    updatedAt: entry.version.createdAt,
    summary: skill.summary ?? "最近发布的新版本，适合快速确认扫描状态和版本规模。",
    tags: ["最近发布", scanTone(skill) === "warning" ? "待处理" : "最近更新"],
    facts: [
      { label: "版本", value: entry.version.version },
      { label: "大小", value: formatBytes(entry.version.totalBytes) },
      { label: "扫描", value: scanLabel(skill), tone: scanTone(skill) },
      { label: "能力标签", value: capabilityTagLabel(skill) },
      { label: "徽章", value: skillBadgeLabel(skill) },
    ],
    evidence: [
      entry.version.staticScanSummary,
      entry.version.vtStatus ? `VT：${entry.version.vtStatus}` : null,
      entry.version.llmStatus ? `LLM：${entry.version.llmStatus}` : null,
      "当前可处理能力：能力标签、可见性/授权、高亮、official/deprecated 徽章、owner 变更。",
    ].filter(Boolean) as string[],
    timeline: [
      {
        title: `发布 v${entry.version.version}`,
        meta: `${entry.version.fileCount} 个文件 · ${formatBytes(entry.version.totalBytes)}`,
        time: entry.version.createdAt,
      },
    ],
    actions: skillActions(skill, "recent"),
  });
}

function organizationRow(entry: ManagementConsoleData["organizations"][number]): ConsoleRow {
  const status = entry.publisher.trustedPublisher ? "可信发布者" : "普通组织";
  return createRow({
    id: `org:${entry.publisher._id}`,
    module: "orgs",
    title: entry.publisher.displayName,
    subtitle: `@${entry.publisher.handle}`,
    owner: `${entry.ownerCount} owner / ${entry.adminCount} admin`,
    status,
    tone: entry.publisher.trustedPublisher ? "success" : "neutral",
    metric: `${entry.skillCount} Skills · ${entry.packageCount} Packages`,
    updatedAt: entry.publisher.updatedAt,
    summary: "组织管理重点是成员角色是否合理，以及组织名下是否已有发布内容。",
    tags: [
      entry.publisher.trustedPublisher ? "可信发布者" : "普通组织",
      entry.skillCount + entry.packageCount > 0 ? "有内容" : "无内容",
      entry.memberCount <= 1 ? "成员较少" : "成员正常",
    ],
    facts: [
      { label: "成员", value: `${entry.memberCount} 人` },
      { label: "角色", value: `${entry.ownerCount} owner · ${entry.adminCount} admin` },
      { label: "内容", value: `${entry.skillCount} Skills · ${entry.packageCount} Packages` },
      { label: "创建", value: formatRelativeTime(entry.publisher.createdAt) },
    ],
    evidence: [
      entry.memberCount <= 1 ? "组织只有 1 名成员，建议补充 owner 或 admin。" : "组织成员结构正常。",
      entry.publisher.trustedPublisher ? "该组织已标记为可信发布者。" : "该组织未标记为可信发布者。",
    ],
    timeline: [
      { title: "组织资料更新", meta: `@${entry.publisher.handle}`, time: entry.publisher.updatedAt },
    ],
    actions: [
      {
        label: "打开组织",
        href: `/orgs/${entry.publisher.handle}`,
        icon: ExternalLink,
        group: "入口",
      },
      previewAction("管理成员", { group: "治理", icon: UserCog, operation: "org-members" }),
      previewAction("可信状态", { group: "标记", icon: BadgeCheck, operation: "org-trust" }),
    ],
  });
}

function apiTokenRow(token: ManagementConsoleData["apiTokens"][number]): ConsoleRow {
  const owner = userLabel(token.owner);
  return createRow({
    id: `token:${token._id}`,
    module: "apikeys",
    title: token.label,
    subtitle: token.prefix,
    owner,
    status: token.revokedAt ? "已吊销" : "有效",
    tone: token.revokedAt ? "pending" : "success",
    metric: token.lastUsedAt ? `最近使用 ${formatRelativeTime(token.lastUsedAt)}` : "从未使用",
    updatedAt: token.lastUsedAt ?? token.createdAt,
    summary: "API Key 管理优先判断归属、是否仍有效、是否长期未使用。",
    tags: [token.revokedAt ? "已吊销" : "有效", token.ownToken ? "我的 Key" : "其他用户"],
    facts: [
      { label: "归属", value: owner },
      { label: "前缀", value: token.prefix },
      { label: "创建", value: formatRelativeTime(token.createdAt) },
      { label: "最近使用", value: token.lastUsedAt ? formatRelativeTime(token.lastUsedAt) : "从未使用" },
    ],
    evidence: [
      token.revokedAt ? `已在 ${formatRelativeTime(token.revokedAt)} 吊销。` : "Token 当前有效。",
      token.ownToken ? "这是当前账号的 Key，可在真实设置页继续管理。" : "这是其他用户的 Key；原型仅展示前缀。",
    ],
    timeline: [
      { title: "创建 API Key", meta: owner, time: token.createdAt },
      { title: token.revokedAt ? "吊销 API Key" : "最近使用", meta: token.prefix, time: token.revokedAt ?? token.lastUsedAt },
    ].filter((item) => item.time !== null),
    actions: [
      {
        label: "复制前缀",
        operation: "api-copy-prefix",
        icon: Copy,
        group: "入口",
        onClick: () => {
          void navigator.clipboard.writeText(token.prefix);
          toast.success("已复制 Key 前缀");
        },
      },
      previewAction("重命名", { group: "治理", icon: Settings2, operation: "api-rename" }),
      previewDangerAction("吊销 Key", { icon: Ban, operation: "api-revoke" }),
    ],
  });
}

function userRow(user: ManagementConsoleData["users"][number]): ConsoleRow {
  const name = user.displayName || user.name || user.handle || String(user._id);
  const status = user.deletedAt || user.deactivatedAt ? "已封禁" : user.requiresModerationAt ? "待处理" : roleLabel(user.role);
  const tone: Tone = user.deletedAt || user.deactivatedAt ? "critical" : user.requiresModerationAt ? "warning" : user.role === "admin" ? "success" : "neutral";
  return createRow({
    id: `user:${user._id}`,
    module: "users",
    title: name,
    subtitle: user.handle ? `@${user.handle}` : user.email ? maskEmail(user.email) : String(user._id),
    owner: roleLabel(user.role),
    status,
    tone,
    metric: user.lastLoginAt ? `登录 ${formatRelativeTime(user.lastLoginAt)}` : "未记录登录",
    updatedAt: user.updatedAt ?? user.lastLoginAt ?? user.createdAt,
    summary: "用户管理重点是角色、登录方式、信任状态和是否存在治理限制。",
    tags: [
      user.role === "admin" ? "管理员" : roleLabel(user.role),
      user.requiresModerationAt ? "待处理" : "正常",
      user.deletedAt || user.deactivatedAt ? "已封禁" : "活跃",
      user.trustedPublisher ? "可信发布者" : "普通用户",
    ],
    facts: [
      { label: "角色", value: roleLabel(user.role), tone: user.role === "admin" ? "success" : "neutral" },
      { label: "登录", value: loginMethodLabel(user.primaryLoginMethod) },
      { label: "邮箱", value: user.email ? maskEmail(user.email) : "未设置" },
      { label: "信任", value: user.trustedPublisher ? "可信发布者" : "普通用户" },
    ],
    evidence: [
      user.requiresModerationReason,
      user.banReason ? `封禁原因：${user.banReason}` : null,
      user.lastLoginAt ? `最近登录：${formatDateTime(user.lastLoginAt)}` : "没有最近登录记录。",
    ].filter(Boolean) as string[],
    timeline: [
      { title: "创建用户", meta: name, time: user.createdAt },
      { title: "最近登录", meta: loginMethodLabel(user.primaryLoginMethod), time: user.lastLoginAt },
    ].filter((item) => item.time !== null),
    actions: [
      previewAction("调整角色", { group: "治理", icon: UserCog, operation: "user-role" }),
      previewAction("查看内容", { group: "治理", icon: Search, operation: "user-content-review" }),
      user.deletedAt || user.deactivatedAt
        ? previewAction("解除封禁", { group: "治理", icon: RotateCcw, operation: "user-unban" })
        : previewDangerAction("封禁用户", { icon: Ban, operation: "user-ban" }),
    ],
  });
}

function packageRow(pkg: ManagementConsoleData["packages"][number]): ConsoleRow {
  const status = packageStatusLabel(pkg);
  const tone = packageTone(pkg);
  return createRow({
    id: `package:${pkg.packageId}`,
    module: "packages",
    title: pkg.displayName,
    subtitle: pkg.name,
    owner: pkg.ownerHandle ? `@${pkg.ownerHandle}` : "未知发布者",
    status,
    tone,
    metric: pkg.latestVersion ? `v${pkg.latestVersion}` : "无版本",
    updatedAt: pkg.updatedAt,
    summary: pkg.summary ?? "Package 管理重点是发布通道、是否执行代码和扫描结果。",
    tags: [
      pkg.isOfficial || pkg.channel === "official" ? "官方" : pkg.channel === "private" ? "私有" : "社区",
      pkg.executesCode ? "代码执行" : "非执行",
      ["suspicious", "malicious"].includes(pkg.scanStatus ?? "") ? "扫描异常" : "扫描正常",
    ],
    facts: [
      { label: "通道", value: channelLabel(pkg.channel), tone: pkg.channel === "official" ? "success" : "neutral" },
      { label: "类型", value: familyLabel(pkg.family) },
      { label: "执行代码", value: pkg.executesCode ? "是" : "否", tone: pkg.executesCode ? "warning" : "neutral" },
      { label: "扫描", value: scanStatusLabel(pkg.scanStatus), tone },
    ],
    evidence: [
      pkg.verificationTier ? `验证级别：${pkg.verificationTier}` : "未记录验证级别。",
      pkg.runtimeId ? `Runtime：${pkg.runtimeId}` : null,
      pkg.executesCode ? "该 Package 可执行代码，审核时应优先查看来源与扫描。" : "该 Package 未标记代码执行。",
    ].filter(Boolean) as string[],
    timeline: [
      { title: "Package 更新", meta: pkg.latestVersion ? `v${pkg.latestVersion}` : pkg.name, time: pkg.updatedAt },
      { title: "创建 Package", meta: pkg.name, time: pkg.createdAt },
    ],
    actions: [
      {
        label: "打开包",
        href: `/packages/${encodeURIComponent(pkg.name)}`,
        icon: ExternalLink,
        group: "入口",
      },
      previewAction("查看版本", { group: "治理", icon: History, operation: "package-versions" }),
      previewDangerAction("下架 Package", { icon: EyeOff, operation: "package-takedown" }),
    ],
  });
}

function auditRow(log: ManagementConsoleData["auditLogs"][number]): ConsoleRow {
  const action = auditActionLabel(log.action);
  const target = `${targetTypeLabel(log.targetType)} · ${shortId(log.targetId)}`;
  return createRow({
    id: `audit:${log._id}`,
    module: "audit",
    title: action,
    subtitle: target,
    owner: userLabel(log.actor),
    status: targetTypeLabel(log.targetType),
    tone: auditTone(log.action),
    metric: formatRelativeTime(log.createdAt),
    updatedAt: log.createdAt,
    summary: "审计日志用于追踪谁在什么时候对哪个对象执行了关键动作。",
    tags: [targetTypeLabel(log.targetType), log.action.includes("delete") || log.action.includes("ban") ? "高风险" : "普通操作"],
    facts: [
      { label: "执行人", value: userLabel(log.actor) },
      { label: "动作", value: log.action },
      { label: "对象", value: target },
      { label: "时间", value: formatDateTime(log.createdAt) },
    ],
    evidence: [metadataSummary(log.metadata) ?? "该记录没有附加 metadata。"],
    timeline: [{ title: action, meta: target, time: log.createdAt }],
    actions: [
      previewAction("查看对象", { group: "治理", icon: Search, operation: "audit-target" }),
      previewAction("复制记录", { group: "其他", icon: Copy, operation: "audit-copy" }),
    ],
  });
}

function createRow(row: Omit<ConsoleRow, "searchText">): ConsoleRow {
  const searchText = [
    row.title,
    row.subtitle,
    row.owner,
    row.status,
    row.metric,
    row.summary,
    ...arrayOf(row.tags),
    ...arrayOf(row.facts).map((fact) => `${fact.label} ${fact.value}`),
    ...arrayOf(row.evidence),
  ]
    .join(" ")
    .toLowerCase();
  return { ...row, searchText };
}

function filterRows(rows: ConsoleRow[], activeFilter: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return arrayOf(rows).filter((row) => {
    const matchesFilter =
      activeFilter === "全部" ||
      row.tags.includes(activeFilter) ||
      row.status.includes(activeFilter) ||
      row.sourceModule === moduleKeyFromLabel(activeFilter);
    const matchesQuery = !normalizedQuery || row.searchText.includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}

function moduleKeyFromLabel(label: string): ModuleKey | null {
  const entry = Object.entries(moduleConfigs).find(([, config]) => config.label === label);
  return (entry?.[0] as ModuleKey | undefined) ?? null;
}

function riskScore(row: ConsoleRow) {
  if (row.tone === "critical") return 4;
  if (row.tone === "warning") return 3;
  if (row.tone === "pending") return 2;
  return 1;
}

function Inspector({ row, activeModule }: { row: ConsoleRow | null; activeModule: ModuleKey }) {
  if (!row) {
    return (
      <aside className="bg-[#fbfbf8] px-5 py-5">
        <div className="flex h-full items-center justify-center border border-dashed border-[#d8d8d0] bg-white p-6 text-center text-sm text-[#74746d]">
          当前筛选没有结果。
        </div>
      </aside>
    );
  }

  return <InspectorContent row={row} activeModule={activeModule} />;
}

function InspectorContent({ row, activeModule }: { row: ConsoleRow; activeModule: ModuleKey }) {
  const SourceIcon = moduleConfigs[row.sourceModule ?? activeModule].icon;
  return (
    <aside className="min-w-0 bg-[#fbfbf8]">
      <div className="flex h-16 items-center justify-between border-b border-[#d8d8d0] px-5">
        <div className="flex min-w-0 items-center gap-2">
          <SourceIcon className="h-4 w-4 text-[#666660]" />
          <span className="truncate text-sm font-semibold">详情检查器</span>
        </div>
        <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
      </div>

      <div className="h-[calc(100vh-64px)] overflow-auto px-5 py-5">
        <div>
          <h2 className="truncate text-xl font-semibold">{row.title}</h2>
          <p className="mt-1 text-sm text-[#666660]">{row.subtitle}</p>
        </div>

        <Separator className="my-5 bg-[#d8d8d0]" />

        <section>
          <ActionPanel actions={row.actions} />
          <div className="mt-4">
            <ObjectManagementForm row={row} />
          </div>
        </section>
      </div>
    </aside>
  );
}

function ActionPanel({ actions }: { actions: ConsoleAction[] }) {
  const safeActions = arrayOf(actions);
  const entryActions = safeActions.filter((action) => action.group === "入口");

  return entryActions.length > 0 ? (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">快捷入口</h3>
        <span className="text-xs text-[#8a8a83]">只读预览</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {entryActions.map((action) => (
          <ActionButton key={actionKey(action)} action={action} />
        ))}
      </div>
    </div>
  ) : null;
}

function actionKey(action: ConsoleAction | undefined) {
  if (!action) return "";
  return `${action.operation ?? "link"}:${action.label}:${action.href ?? ""}`;
}

function ActionButton({
  action,
}: {
  action: ConsoleAction;
}) {
  const Icon = action.icon ?? (action.label === "复制前缀" ? Copy : Settings2);
  const style = action.emphasis === "primary" ? { color: "#fff" } : undefined;
  const className = [
    "inline-flex w-full min-w-0 items-center gap-2 border transition disabled:pointer-events-none disabled:opacity-60",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111]/20",
    "hover:not-disabled:-translate-y-px",
    "justify-start rounded-[8px] font-medium",
    "h-9 px-3 text-sm",
    action.emphasis === "primary"
      ? "border-[#111] bg-[#111] text-white hover:not-disabled:bg-[#2b2b28]"
      : action.danger
        ? "border-red-200 bg-red-50 text-red-700 hover:not-disabled:bg-red-100"
        : "border-[#d8d8d0] bg-white text-[#111] hover:not-disabled:bg-[#f1f1ed]",
  ].join(" ");

  if (action.href && !action.disabled) {
    return (
      <a href={action.href} className={className} style={style}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{action.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={action.disabled}
      className={className}
      style={style}
      onClick={() => {
        if (action.onClick) {
          action.onClick();
          return;
        }
        if (!action.operation) {
          toast.info("原型页已接入真实数据，但该操作暂不写入。");
        }
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{action.label}</span>
    </button>
  );
}

function MetricPill({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: Tone;
}) {
  return (
    <div className="border border-[#d8d8d0] bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-[#74746d]">{label}</span>
        <SeverityDot tone={tone} />
      </div>
      <div className="mt-1 text-xl font-semibold">{formatNumber(value)}</div>
      <div className="mt-0.5 truncate text-xs text-[#8a8a83]">{helper}</div>
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={`rounded-[6px] px-2 py-0.5 text-xs ${toneClasses[tone]}`}>
      {children}
    </Badge>
  );
}

function SeverityDot({ tone }: { tone: Tone }) {
  const color =
    tone === "critical"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "success"
          ? "bg-emerald-500"
          : tone === "pending"
            ? "bg-zinc-500"
            : "bg-[#a8a89f]";
  return <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function EmptyRows({ query }: { query: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="border border-dashed border-[#d8d8d0] bg-white p-8 text-center">
        <Search className="mx-auto h-6 w-6 text-[#8a8a83]" />
        <div className="mt-3 text-sm font-semibold">没有匹配对象</div>
        <div className="mt-1 text-xs text-[#74746d]">
          {query ? "调整搜索词或切换筛选条件。" : "当前模块暂无需要展示的数据。"}
        </div>
      </div>
    </div>
  );
}

function skillActions(
  skill: SkillSummary,
  context: "reports" | "suspicious" | "duplicate" | "recent",
): ConsoleAction[] {
  const common = [manageSkillAction(skill), openSkillAction(skill)];
  if (context === "reports") {
    return [
      ...common,
      skill.softDeletedAt
        ? previewAction("恢复 Skill", {
            group: "治理",
            icon: RotateCcw,
            operation: "skill-restore",
          })
        : previewAction("隐藏 Skill", { group: "治理", icon: EyeOff, operation: "skill-hide" }),
      previewDangerAction("硬删除", { icon: Trash2, operation: "skill-hard-delete" }),
      previewDangerAction("封禁 owner", { icon: Ban, operation: "user-ban" }),
    ];
  }
  if (context === "suspicious") {
    return [
      ...common,
      previewAction(skill.manualOverride ? "更新 Clean" : "标记 Clean", {
        group: "治理",
        icon: ShieldCheck,
        operation: "skill-clean-override",
      }),
      previewAction("清除覆盖", {
        group: "治理",
        icon: RotateCcw,
        operation: "skill-clear-override",
      }),
      previewAction("可见性", { group: "访问", icon: EyeOff, operation: "skill-visibility" }),
      previewAction("访问授权", { group: "访问", icon: Lock, operation: "skill-access" }),
      previewAction("能力标签", { group: "标记", icon: Tag, operation: "skill-capability-tags" }),
    ];
  }
  if (context === "duplicate") {
    return [
      ...common,
      previewAction("设为重复", { group: "治理", icon: GitMerge, operation: "skill-duplicate" }),
      previewAction("清除重复", {
        group: "治理",
        icon: RotateCcw,
        operation: "skill-duplicate-clear",
      }),
    ];
  }
  return [
    ...common,
    previewAction("能力标签", { group: "标记", icon: Tag, operation: "skill-capability-tags" }),
    previewAction("访问控制", { group: "访问", icon: Lock, operation: "skill-access" }),
    previewAction(skill.badges?.highlighted || skill.batch === "highlighted" ? "取消高亮" : "高亮", {
      group: "标记",
      icon: Star,
      operation: "skill-badge",
    }),
    previewAction(skill.badges?.official ? "移除 Official" : "标记 Official", {
      group: "标记",
      icon: BadgeCheck,
      operation: "skill-badge",
    }),
    previewAction(skill.badges?.deprecated ? "移除 Deprecated" : "标记 Deprecated", {
      group: "标记",
      icon: Archive,
      operation: "skill-badge",
    }),
    previewAction("变更 owner", { group: "治理", icon: UserCog, operation: "skill-owner-change" }),
  ];
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-[#f7f7f5] px-8 py-8 text-[#111]">
      <div className="grid min-h-[calc(100vh-64px)] grid-cols-[224px_minmax(0,1fr)_360px] gap-0 border border-[#d8d8d0] bg-white">
        <div className="border-r border-[#d8d8d0] bg-[#fbfbf8]" />
        <div className="p-6">
          <div className="h-8 w-56 animate-pulse bg-[#e5e5df]" />
          <div className="mt-4 h-28 animate-pulse bg-[#ecece7]" />
          <div className="mt-6 h-80 animate-pulse bg-[#ecece7]" />
        </div>
        <div className="border-l border-[#d8d8d0] bg-[#fbfbf8]" />
      </div>
    </main>
  );
}

function openSkillAction(skill: SkillSummary): ConsoleAction {
  return {
    label: "前台页面",
    href: `/${encodeURIComponent(skill.owner?.handle ?? String(skill.ownerUserId))}/${encodeURIComponent(skill.slug)}`,
    icon: ExternalLink,
    group: "入口",
    emphasis: "secondary",
  };
}

function manageSkillAction(skill: SkillSummary): ConsoleAction {
  return {
    label: "Skill 管理",
    href: `/management?skill=${encodeURIComponent(skill.slug)}`,
    icon: Settings2,
    group: "入口",
    emphasis: "primary",
  };
}

function previewAction(label: string, options: Partial<ConsoleAction> = {}): ConsoleAction {
  return { label, group: "其他", ...options };
}

function previewDangerAction(label: string, options: Partial<ConsoleAction> = {}): ConsoleAction {
  return { label, group: "危险", danger: true, ...options };
}

function reportsToTimeline(reports: ReportedSkill["reports"]) {
  return arrayOf(reports).map((report) => ({
    title: "收到举报",
    meta: `${userLabel(report.reporter)}：${report.reason}`,
    time: report.createdAt,
  }));
}

function ownerLabel(owner: PublicPublisher | null, fallbackId: Id<"users">) {
  return owner?.handle ? `@${owner.handle}` : String(fallbackId);
}

function userLabel(user: PublicUser | null | undefined) {
  if (user?.handle) return `@${user.handle}`;
  if (user?.displayName) return user.displayName;
  if (user?.name) return user.name;
  return "未知用户";
}

function scanLabel(skill: SkillSummary) {
  const latest = skill.latestVersion;
  if (skill.moderationVerdict) return skill.moderationVerdict;
  if (latest?.staticScanStatus) return `static: ${latest.staticScanStatus}`;
  if (latest?.vtStatus) return `vt: ${latest.vtStatus}`;
  if (latest?.llmStatus) return `llm: ${latest.llmStatus}`;
  return "未记录";
}

function scanTone(skill: SkillSummary): Tone {
  const value = [
    skill.moderationVerdict,
    skill.latestVersion?.staticScanStatus,
    skill.latestVersion?.vtStatus,
    skill.latestVersion?.llmStatus,
  ]
    .filter(Boolean)
    .join(" ");
  if (value.includes("malicious")) return "critical";
  if (value.includes("suspicious") || skill.isSuspicious) return "warning";
  if (value.includes("clean")) return "success";
  return "neutral";
}

function manualOverrideLabel(skill: SkillSummary) {
  return skill.manualOverride ? `Clean · ${formatRelativeTime(skill.manualOverride.updatedAt)}` : "未设置";
}

function capabilityTagLabel(skill: SkillSummary) {
  const tags = arrayOf(skill.capabilityTags);
  if (!tags.length) return "未设置";
  return tags.length > 2
    ? `${tags.slice(0, 2).join(", ")} +${tags.length - 2}`
    : tags.join(", ");
}

function skillBadgeLabel(skill: SkillSummary) {
  const labels = [
    skill.badges?.highlighted || skill.batch === "highlighted" ? "Highlighted" : null,
    skill.badges?.official ? "Official" : null,
    skill.badges?.deprecated ? "Deprecated" : null,
  ].filter(Boolean);
  return labels.length ? labels.join(", ") : "无";
}

function packageTone(pkg: ManagementConsoleData["packages"][number]): Tone {
  if (pkg.scanStatus === "malicious") return "critical";
  if (pkg.scanStatus === "suspicious" || pkg.scanStatus === "pending") return "warning";
  if (pkg.scanStatus === "clean") return "success";
  return pkg.channel === "private" ? "pending" : "neutral";
}

function packageStatusLabel(pkg: ManagementConsoleData["packages"][number]) {
  if (pkg.scanStatus === "malicious") return "恶意";
  if (pkg.scanStatus === "suspicious") return "可疑";
  if (pkg.scanStatus === "pending") return "扫描中";
  if (pkg.channel === "official") return "官方";
  if (pkg.channel === "private") return "私有";
  return "社区";
}

function auditTone(action: string): Tone {
  if (action.includes("hard_delete") || action.includes("delete") || action.includes("ban")) {
    return "critical";
  }
  if (action.includes("role") || action.includes("visibility") || action.includes("override")) {
    return "warning";
  }
  return "neutral";
}

function metadataSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const entries = Object.entries(metadata as Record<string, unknown>)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length ? entries.join(" · ") : null;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "role.change": "角色变更",
    "skill.manual_override.set": "设置人工复核",
    "skill.manual_override.clear": "清除人工复核",
    "skill.visibility.set": "调整可见性",
    "skill.access.grant": "授权访问",
    "skill.access.revoke": "撤销访问",
    "skill.duplicate.set": "标记重复",
    "skill.hard_delete": "硬删除 Skill",
    "publisher.create": "创建组织",
    "publisher.delete": "删除组织",
    "package.trusted_publisher.set": "设置可信发布",
    "package.trusted_publisher.delete": "删除可信发布",
  };
  return labels[action] ?? action.replaceAll(".", " ");
}

function targetTypeLabel(type: string) {
  const labels: Record<string, string> = {
    user: "用户",
    skill: "Skill",
    package: "Package",
    publisher: "组织",
    token: "API Key",
    handle: "Handle",
  };
  return labels[type] ?? type;
}

function visibilityLabel(value: string) {
  if (value === "private") return "私有";
  if (value === "restricted") return "受限";
  return "公开";
}

function moderationStatusLabel(value: string) {
  if (value === "hidden") return "已隐藏";
  if (value === "removed") return "已移除";
  return "正常";
}

function roleLabel(value: string) {
  if (value === "admin") return "管理员";
  if (value === "moderator") return "审核员";
  return "用户";
}

function loginMethodLabel(value: string | null) {
  if (value === "github") return "GitHub";
  if (value === "wecom") return "企业微信";
  if (value === "password") return "密码";
  return "未记录";
}

function viewerModeLabel(role: ManagementConsoleData["viewer"]["role"]) {
  if (role === "admin") return "管理员视图";
  if (role === "moderator") return "审核员视图";
  return "公开预览";
}

function channelLabel(value: string) {
  if (value === "official") return "官方";
  if (value === "private") return "私有";
  return "社区";
}

function familyLabel(value: string) {
  if (value === "code-plugin") return "代码插件";
  if (value === "bundle-plugin") return "Bundle 插件";
  return "Skill 包";
}

function scanStatusLabel(value: string | undefined) {
  if (value === "clean") return "干净";
  if (value === "suspicious") return "可疑";
  if (value === "malicious") return "恶意";
  if (value === "pending") return "扫描中";
  return "未扫描";
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

function shortId(id: string) {
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelativeTime(value: number | null | undefined) {
  if (!value) return "未记录";
  const diff = Date.now() - value;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return formatDateTime(value);
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
