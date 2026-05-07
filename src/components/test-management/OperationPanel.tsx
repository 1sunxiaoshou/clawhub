import { Textarea } from "../ui/textarea";

export type PrototypeOperationKind =
  | "skill-clean-override"
  | "skill-clear-override"
  | "skill-visibility"
  | "skill-access"
  | "skill-capability-tags"
  | "skill-hide"
  | "skill-restore"
  | "skill-hard-delete"
  | "skill-duplicate"
  | "skill-duplicate-clear"
  | "skill-badge"
  | "skill-owner-change"
  | "user-role"
  | "user-content-review"
  | "user-ban"
  | "user-unban"
  | "org-members"
  | "org-trust"
  | "api-copy-prefix"
  | "api-rename"
  | "api-revoke"
  | "package-versions"
  | "package-takedown"
  | "audit-target"
  | "audit-copy";

export type PrototypeAction = {
  label: string;
  operation?: PrototypeOperationKind;
  danger?: boolean;
};

export type PrototypeRow = {
  id: string;
  module: string;
  title: string;
  subtitle: string;
  owner: string;
  status: string;
  metric: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  evidence: string[];
};

type OperationSpec = {
  title: string;
  description: string;
  intent: string;
  danger?: boolean;
  fields: OperationField[];
  checks: string[];
  preview: string[];
  submitLabel: string;
};

type OperationField =
  | {
      type: "text" | "textarea";
      label: string;
      value?: string;
      placeholder?: string;
      helper?: string;
    }
  | {
      type: "select";
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      helper?: string;
    }
  | {
      type: "checkboxes";
      label: string;
      options: Array<{ label: string; checked?: boolean; danger?: boolean }>;
      helper?: string;
    }
  | {
      type: "readonly";
      label: string;
      value: string;
      helper?: string;
    };

export function OperationDetails({
  row,
  action,
}: {
  row: PrototypeRow;
  action: PrototypeAction | null;
}) {
  if (!action?.operation) {
    return (
      <div className="border border-dashed border-[#d8d8d0] bg-white p-4">
        <div className="text-sm font-semibold">选择一个操作</div>
        <p className="mt-1 text-xs leading-5 text-[#74746d]">
          点击上方操作后，这里显示对应的表单字段。
        </p>
      </div>
    );
  }

  const spec = buildOperationSpec(row, action);
  return (
    <div className="border border-[#d8d8d0] bg-white">
      <div className="border-b border-[#d8d8d0] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{spec.title}</div>
            <p className="mt-1 text-xs leading-5 text-[#74746d]">{spec.description}</p>
          </div>
          <span
            className={[
              "shrink-0 border px-2 py-0.5 text-[11px] font-medium",
              spec.danger
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#d8d8d0] bg-[#f7f7f5] text-[#555550]",
            ].join(" ")}
          >
            {spec.danger ? "高风险" : "只读"}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyBox label="状态" value={row.status} />
          <ReadOnlyBox label="负责人" value={row.owner} />
        </div>

        <div className="space-y-3">{spec.fields.map((field) => renderField(field))}</div>

        <div className="flex items-center justify-between border-t border-[#d8d8d0] pt-4">
          <span className="text-xs text-[#74746d]">预览页不提交变更</span>
          <button
            type="button"
            disabled
            className={[
              "h-9 rounded-[8px] border px-3 text-xs font-semibold",
              spec.danger
                ? "border-red-200 bg-red-50 text-red-700 opacity-60"
                : "border-[#111] bg-[#111] text-white opacity-60",
            ].join(" ")}
          >
            {spec.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ObjectManagementForm({ row }: { row: PrototypeRow }) {
  const spec = buildObjectManagementSpec(row);

  return (
    <div className="border border-[#d8d8d0] bg-white">
      <div className="border-b border-[#d8d8d0] px-4 py-3">
        <div className="text-sm font-semibold">{spec.title}</div>
        <p className="mt-1 text-xs leading-5 text-[#74746d]">{spec.description}</p>
      </div>

      <div className="space-y-3 px-4 py-4">{spec.fields.map((field) => renderField(field))}</div>

      <div className="flex items-center justify-between border-t border-[#d8d8d0] px-4 py-3">
        <span className="text-xs text-[#74746d]">预览页不提交变更</span>
        <button
          type="button"
          disabled
          className="h-9 rounded-[8px] border border-[#111] bg-[#111] px-3 text-xs font-semibold text-white opacity-60"
        >
          {spec.submitLabel}
        </button>
      </div>
    </div>
  );
}

function buildObjectManagementSpec(row: PrototypeRow): {
  title: string;
  description: string;
  fields: OperationField[];
  submitLabel: string;
} {
  const fact = (label: string) => row.facts.find((item) => item.label === label)?.value;

  if (row.module === "users") {
    return {
      title: "用户管理",
      description: "把角色、信任状态和账号状态集中在同一个表单里处理。",
      fields: [
        {
          type: "select",
          label: "角色",
          value: roleValue(fact("角色") ?? row.owner),
          options: [
            { value: "user", label: "用户" },
            { value: "moderator", label: "审核员" },
            { value: "admin", label: "管理员" },
          ],
        },
        {
          type: "select",
          label: "账号状态",
          value: row.status === "已封禁" ? "banned" : row.status === "待处理" ? "review" : "active",
          options: [
            { value: "active", label: "正常" },
            { value: "review", label: "需要人工复核" },
            { value: "banned", label: "封禁" },
          ],
        },
        {
          type: "select",
          label: "发布者信任",
          value: (fact("信任") ?? "").includes("可信") ? "trusted" : "normal",
          options: [
            { value: "normal", label: "普通用户" },
            { value: "trusted", label: "可信发布者" },
          ],
        },
        { type: "readonly", label: "登录方式", value: fact("登录") ?? "未记录" },
        { type: "textarea", label: "处理备注", placeholder: "记录角色、复核或封禁原因。" },
      ],
      submitLabel: "保存用户",
    };
  }

  if (row.module === "orgs") {
    return {
      title: "组织管理",
      description: "集中维护组织可信状态和成员角色，不再拆成多个操作入口。",
      fields: [
        {
          type: "select",
          label: "可信状态",
          value: row.status.includes("可信") ? "trusted" : "normal",
          options: [
            { value: "normal", label: "普通组织" },
            { value: "trusted", label: "可信发布者" },
          ],
        },
        { type: "readonly", label: "成员规模", value: fact("成员") ?? "未记录" },
        { type: "readonly", label: "角色结构", value: fact("角色") ?? row.owner },
        { type: "text", label: "成员 handle", placeholder: "@user" },
        {
          type: "select",
          label: "成员角色",
          value: "admin",
          options: [
            { value: "member", label: "成员" },
            { value: "admin", label: "管理员" },
            { value: "owner", label: "Owner" },
          ],
        },
      ],
      submitLabel: "保存组织",
    };
  }

  if (row.module === "apikeys") {
    return {
      title: "API Key 管理",
      description: "只展示可管理的非敏感字段；完整密钥不在管理台显示。",
      fields: [
        { type: "text", label: "名称", value: row.title },
        { type: "readonly", label: "前缀", value: row.subtitle },
        { type: "readonly", label: "归属", value: fact("归属") ?? row.owner },
        {
          type: "select",
          label: "状态",
          value: row.status === "已吊销" ? "revoked" : "active",
          options: [
            { value: "active", label: "有效" },
            { value: "revoked", label: "吊销" },
          ],
        },
        { type: "readonly", label: "最近使用", value: fact("最近使用") ?? row.metric },
        { type: "textarea", label: "备注", placeholder: "如需吊销，记录原因和影响范围。" },
      ],
      submitLabel: "保存 Key",
    };
  }

  if (row.module === "packages") {
    return {
      title: "Package 管理",
      description: "按发布通道、官方状态和扫描状态直接维护。",
      fields: [
        {
          type: "select",
          label: "发布通道",
          value: channelValue(fact("通道") ?? row.status),
          options: [
            { value: "community", label: "社区" },
            { value: "official", label: "官方" },
            { value: "private", label: "私有" },
          ],
        },
        { type: "readonly", label: "类型", value: fact("类型") ?? "未记录" },
        { type: "readonly", label: "执行代码", value: fact("执行代码") ?? "未记录" },
        {
          type: "select",
          label: "扫描状态",
          value: scanValue(fact("扫描") ?? row.status),
          options: [
            { value: "clean", label: "正常" },
            { value: "pending", label: "待扫描" },
            { value: "suspicious", label: "可疑" },
            { value: "malicious", label: "恶意" },
          ],
        },
        { type: "textarea", label: "处理备注", placeholder: "记录下线、恢复或扫描处理依据。" },
      ],
      submitLabel: "保存 Package",
    };
  }

  if (row.module === "audit") {
    return {
      title: "审计记录",
      description: "审计记录只读，用于定位对象和排查操作来源。",
      fields: [
        { type: "readonly", label: "动作", value: row.title },
        { type: "readonly", label: "对象", value: row.subtitle },
        { type: "readonly", label: "操作人", value: row.owner },
        { type: "readonly", label: "时间", value: row.metric },
      ],
      submitLabel: "只读记录",
    };
  }

  return {
    title: "Skill 管理",
    description: "把审核判定、可见性、访问和标记集中在一个表单里。",
    fields: [
      {
        type: "select",
        label: "审核判定",
        value: scanValue(fact("判定") ?? fact("扫描") ?? row.status),
        options: [
          { value: "clean", label: "正常" },
          { value: "suspicious", label: "可疑" },
          { value: "malicious", label: "恶意" },
        ],
      },
      {
        type: "select",
        label: "可见性",
        value: visibilityValue(fact("可见性") ?? row.status),
        options: [
          { value: "public", label: "公开" },
          { value: "restricted", label: "受限" },
          { value: "private", label: "私有" },
        ],
      },
      {
        type: "select",
        label: "人工覆盖",
        value: (fact("人工覆盖") ?? "").includes("Clean") ? "clean" : "none",
        options: [
          { value: "none", label: "未设置" },
          { value: "clean", label: "人工 Clean" },
        ],
      },
      { type: "text", label: "能力标签", value: fact("能力标签") ?? "" },
      {
        type: "checkboxes",
        label: "展示标记",
        options: [
          { label: "官方", checked: (fact("徽章") ?? "").includes("官方") },
          { label: "精选", checked: (fact("徽章") ?? "").includes("精选") },
          { label: "已弃用", checked: (fact("徽章") ?? "").includes("弃用") },
        ],
      },
      { type: "textarea", label: "处理备注", placeholder: "记录本次审核或治理原因。" },
    ],
    submitLabel: "保存 Skill",
  };
}

function buildOperationSpec(row: PrototypeRow, action: PrototypeAction): OperationSpec {
  const fact = (label: string) => row.facts.find((item) => item.label === label)?.value;
  const visibility = fact("可见性") ?? "公开";
  const scan = fact("扫描") ?? fact("判定") ?? "未记录";
  const currentOverride = fact("人工覆盖") ?? "未设置";
  const currentTags = fact("能力标签") ?? "未设置";
  const currentBadges = fact("徽章") ?? "无";

  switch (action.operation) {
    case "skill-clean-override":
      return {
        title: "人工标记 Clean",
        description: "用于把扫描误报的 Skill 标记为人工确认正常。",
        intent: "记录审核员判断和原因，后续列表应显示人工覆盖状态。",
        fields: [
          { type: "readonly", label: "当前扫描", value: scan },
          { type: "readonly", label: "当前人工覆盖", value: currentOverride },
          {
            type: "select",
            label: "人工判定",
            value: "clean",
            options: [{ value: "clean", label: "Clean" }],
          },
          {
            type: "textarea",
            label: "复核说明",
            placeholder: "说明为什么可判定为误报，例如依赖用途、行为边界、人工验证结果。",
            helper: "真实操作中该说明会进入审计日志。",
          },
        ],
        checks: ["确认最新版本仍是当前检查对象", "复核扫描摘要和举报理由", "说明不可为空"],
        preview: [`${row.title} 将显示为人工 Clean`, "扫描可疑状态不被删除，只增加人工覆盖记录"],
        submitLabel: "保存人工判定",
      };
    case "skill-clear-override":
      return {
        title: "清除人工覆盖",
        description: "用于撤销此前的 Clean 人工判定，让系统扫描结果重新生效。",
        intent: "移除人工覆盖记录，并保留清除原因供审计追溯。",
        fields: [
          { type: "readonly", label: "当前人工覆盖", value: currentOverride },
          {
            type: "textarea",
            label: "清除原因",
            placeholder: "说明为什么撤销人工覆盖，例如新版行为变化、误判复核、策略更新。",
          },
          {
            type: "checkboxes",
            label: "确认项",
            options: [{ label: "已确认清除后会重新按扫描状态展示", checked: true }],
          },
        ],
        checks: ["当前对象存在人工覆盖", "清除原因已填写", "已确认不会误恢复风险对象"],
        preview: [`${row.title} 的人工覆盖将变为未设置`, `列表状态将回到 ${scan}`],
        submitLabel: "清除覆盖",
      };
    case "skill-visibility":
      return {
        title: "调整可见性",
        description: "用于在公开、受限和私有之间调整 Skill 可访问范围。",
        intent: "改变 Skill 的可见性，同时记录变更原因。",
        fields: [
          { type: "readonly", label: "当前可见性", value: visibility },
          {
            type: "select",
            label: "新可见性",
            value: visibility === "公开" ? "restricted" : "public",
            options: [
              { value: "public", label: "公开" },
              { value: "restricted", label: "受限" },
              { value: "private", label: "私有" },
            ],
            helper: "受限/私有场景需要配合访问授权检查。",
          },
          {
            type: "textarea",
            label: "变更原因",
            placeholder: "例如临时下线、只允许指定组织访问、恢复公开等。",
          },
        ],
        checks: ["确认 owner 和访问范围", "确认不会影响已授权用户的正常使用", "变更原因已填写"],
        preview: [`${row.title} 可见性将从 ${visibility} 更新`, "审计日志会记录 visibility.set"],
        submitLabel: "更新可见性",
      };
    case "skill-access":
      return {
        title: "访问授权",
        description: "用于给受限或私有 Skill 添加/移除用户或组织授权。",
        intent: "维护访问白名单，而不是改变 Skill 所有权。",
        fields: [
          { type: "readonly", label: "当前可见性", value: visibility },
          {
            type: "select",
            label: "授权对象类型",
            value: "user",
            options: [
              { value: "user", label: "用户" },
              { value: "publisher", label: "组织" },
            ],
          },
          { type: "text", label: "Handle 或 ID", placeholder: "@user 或 @org" },
          {
            type: "select",
            label: "动作",
            value: "grant",
            options: [
              { value: "grant", label: "添加授权" },
              { value: "revoke", label: "撤销授权" },
            ],
          },
        ],
        checks: ["确认对象存在", "确认对象类型匹配", "私有 Skill 至少保留 owner 访问能力"],
        preview: ["访问授权列表将新增或移除一条记录", "审计日志会记录 access.grant 或 access.revoke"],
        submitLabel: "保存授权",
      };
    case "skill-capability-tags":
      return {
        title: "能力标签",
        description: "用于维护 Skill 的能力分类，影响发现、筛选和治理视角。",
        intent: "根据 Skill 实际能力勾选标签，避免标签堆叠或错标。",
        fields: [
          { type: "readonly", label: "当前标签", value: currentTags },
          {
            type: "checkboxes",
            label: "标签",
            options: [
              { label: "浏览器自动化", checked: currentTags.includes("browser") },
              { label: "文件系统", checked: currentTags.includes("file") },
              { label: "网络请求", checked: currentTags.includes("network") },
              { label: "代码执行", checked: currentTags.includes("code") },
              { label: "数据分析", checked: currentTags.includes("data") },
              { label: "多媒体处理", checked: currentTags.includes("media") },
            ],
          },
          { type: "textarea", label: "标注依据", placeholder: "说明标签来自 README、SKILL.md、扫描结果或人工验证。" },
        ],
        checks: ["标签必须反映真实能力", "高风险能力需要与扫描摘要一致", "不要把营销描述当作能力标签"],
        preview: [`${row.title} 的能力标签将更新`, "列表和详情检查器会显示新的标签摘要"],
        submitLabel: "保存标签",
      };
    case "skill-hide":
    case "skill-restore":
      return {
        title: action.operation === "skill-restore" ? "恢复 Skill" : "隐藏 Skill",
        description:
          action.operation === "skill-restore"
            ? "用于恢复此前被隐藏的 Skill。"
            : "用于从公开列表中隐藏 Skill，但保留记录和审计追踪。",
        intent:
          action.operation === "skill-restore"
            ? "确认风险已解除后恢复可见状态。"
            : "临时或长期阻止用户继续发现该 Skill。",
        fields: [
          { type: "readonly", label: "当前状态", value: row.status },
          {
            type: "select",
            label: "原因类型",
            value: action.operation === "skill-restore" ? "resolved" : "policy",
            options: [
              { value: "policy", label: "违反政策" },
              { value: "security", label: "安全风险" },
              { value: "spam", label: "垃圾内容" },
              { value: "resolved", label: "风险解除" },
            ],
          },
          { type: "textarea", label: "说明", placeholder: "写清楚隐藏或恢复的依据。" },
        ],
        checks: ["确认对象和 owner", "确认原因可审计", "必要时同步处理相关举报"],
        preview: [
          action.operation === "skill-restore" ? "Skill 将恢复为 active" : "Skill 将设置为 hidden/soft deleted",
          "审计日志会记录操作人、原因和时间",
        ],
        submitLabel: action.operation === "skill-restore" ? "恢复 Skill" : "隐藏 Skill",
        danger: action.operation === "skill-hide",
      };
    case "skill-hard-delete":
      return {
        title: "硬删除 Skill",
        description: "高风险操作，用于彻底删除 Skill 记录和相关可见内容。",
        intent: "只在明确需要清理违规、恶意或不可恢复内容时使用。",
        danger: true,
        fields: [
          { type: "readonly", label: "待删除对象", value: row.subtitle },
          { type: "text", label: "确认输入", placeholder: row.title, helper: "真实操作要求输入 Skill 名称或 slug。" },
          { type: "textarea", label: "删除原因", placeholder: "必须写明删除依据。" },
        ],
        checks: ["确认不是误选对象", "确认已有足够审计依据", "确认删除后无法通过普通恢复操作找回"],
        preview: ["Skill、版本和关联展示入口将不可用", "审计日志会记录 hard_delete"],
        submitLabel: "确认硬删除",
      };
    case "skill-duplicate":
    case "skill-duplicate-clear":
      return {
        title: action.operation === "skill-duplicate" ? "设置重复归并" : "清除重复标记",
        description: "用于维护 duplicate-of 关系，避免重复 Skill 分散治理。",
        intent:
          action.operation === "skill-duplicate"
            ? "把当前 Skill 归并到一个 canonical Skill。"
            : "撤销当前 Skill 的 canonical 关联。",
        fields: [
          { type: "readonly", label: "当前对象", value: row.subtitle },
          {
            type: "text",
            label: "Canonical slug",
            placeholder: "输入主 Skill slug",
            helper: action.operation === "skill-duplicate" ? "清空则无法设置归并。" : "清除操作可留空。",
          },
          { type: "textarea", label: "判断依据", placeholder: "说明为什么认为是重复、fork 或误报。" },
        ],
        checks: ["确认两个对象不是同一个 Skill", "确认 owner 和版本指纹", "确认归并不会隐藏合法 fork"],
        preview: [
          action.operation === "skill-duplicate" ? "当前 Skill 将指向 canonicalSkillId" : "canonicalSkillId 将清空",
          "列表中的重复候选状态会随之变化",
        ],
        submitLabel: action.operation === "skill-duplicate" ? "设为重复" : "清除重复",
      };
    case "skill-badge":
      return {
        title: "维护标记",
        description: "用于维护 highlighted、official、deprecated 等显示标记。",
        intent: "更新 Skill 的运营/官方状态，不改变内容本身。",
        fields: [
          { type: "readonly", label: "当前标记", value: currentBadges },
          {
            type: "checkboxes",
            label: "标记",
            options: [
              { label: "Highlighted", checked: currentBadges.includes("Highlighted") },
              { label: "Official", checked: currentBadges.includes("Official") },
              { label: "Deprecated", checked: currentBadges.includes("Deprecated") },
            ],
          },
          { type: "textarea", label: "说明", placeholder: "说明标记变化原因，例如官方迁移、版本废弃、精选推荐。" },
        ],
        checks: ["Official 只能用于确认来源的 Skill", "Deprecated 需要有替代或废弃说明", "Highlighted 不应覆盖风险状态"],
        preview: [`${row.title} 的展示标记将更新`, "审计日志会记录 badge 变化"],
        submitLabel: "保存标记",
      };
    case "skill-owner-change":
      return {
        title: "变更 owner",
        description: "用于管理员把 Skill 转移到另一个用户。",
        intent: "修正归属或完成所有权迁移。",
        fields: [
          { type: "readonly", label: "当前 owner", value: row.owner },
          { type: "text", label: "新 owner", placeholder: "用户 handle 或 userId" },
          { type: "textarea", label: "迁移原因", placeholder: "说明归属变更依据。" },
        ],
        checks: ["确认新 owner 存在", "确认迁移不会破坏发布者路径", "确认迁移原因可审计"],
        preview: ["Skill ownerUserId 将更新", "前台 URL owner 部分可能变化"],
        submitLabel: "变更 owner",
      };
    case "user-role":
      return {
        title: "调整用户角色",
        description: "用于管理员调整用户 role。",
        intent: "在 user、moderator、admin 之间改变后台权限。",
        fields: [
          { type: "readonly", label: "当前角色", value: row.status },
          {
            type: "select",
            label: "新角色",
            value: "moderator",
            options: [
              { value: "user", label: "用户" },
              { value: "moderator", label: "审核员" },
              { value: "admin", label: "管理员" },
            ],
          },
          { type: "textarea", label: "授权原因", placeholder: "说明为何调整角色。" },
        ],
        checks: ["不能误提升普通用户为管理员", "确认不是当前操作人自己", "角色变更会进入审计日志"],
        preview: [`${row.title} 的角色将更新`, "导航和管理能力会按新角色生效"],
        submitLabel: "保存角色",
      };
    case "user-content-review":
      return {
        title: "查看用户内容",
        description: "用于从用户维度检查其发布内容和治理状态。",
        intent: "聚合查看该用户名下 Skill、Package 和近期风险记录。",
        fields: [
          { type: "readonly", label: "用户", value: row.title },
          {
            type: "checkboxes",
            label: "内容范围",
            options: [
              { label: "Skills", checked: true },
              { label: "Packages", checked: true },
              { label: "举报记录", checked: true },
              { label: "审计记录" },
            ],
          },
        ],
        checks: ["确认仅查看治理所需范围", "敏感字段在公开预览下隐藏", "风险内容优先按最近更新时间排序"],
        preview: ["中间表格可切到该用户内容过滤结果", "右侧保留用户治理上下文"],
        submitLabel: "应用过滤",
      };
    case "user-ban":
    case "user-unban":
      return {
        title: action.operation === "user-unban" ? "解除封禁" : "封禁用户",
        description:
          action.operation === "user-unban"
            ? "用于恢复此前封禁的用户。"
            : "用于封禁用户，并可选择同步处理其发布内容。",
        intent:
          action.operation === "user-unban"
            ? "确认误封或风险解除后恢复用户状态。"
            : "阻止用户继续登录和发布，必要时下线其内容。",
        danger: action.operation === "user-ban",
        fields: [
          { type: "readonly", label: "用户", value: row.title },
          {
            type: "checkboxes",
            label: "影响范围",
            options:
              action.operation === "user-ban"
                ? [
                    { label: "禁止登录", checked: true, danger: true },
                    { label: "下线其 Skills", checked: true, danger: true },
                    { label: "保留审计记录", checked: true },
                  ]
                : [
                    { label: "恢复登录", checked: true },
                    { label: "保留历史审计记录", checked: true },
                  ],
          },
          { type: "textarea", label: "原因", placeholder: "写清楚封禁或解封依据。" },
        ],
        checks: ["确认不是当前操作人", "确认处理范围", "原因必须可审计"],
        preview: [action.operation === "user-ban" ? "用户将进入封禁状态" : "用户将恢复为活跃状态", "相关内容状态可能同步变化"],
        submitLabel: action.operation === "user-ban" ? "封禁用户" : "解除封禁",
      };
    case "org-members":
      return {
        title: "管理成员",
        description: "用于维护组织成员与角色。",
        intent: "添加成员、调整角色或移除成员，保证至少有 owner。",
        fields: [
          { type: "readonly", label: "组织", value: row.subtitle },
          { type: "text", label: "成员 handle", placeholder: "@user" },
          {
            type: "select",
            label: "角色",
            value: "admin",
            options: [
              { value: "member", label: "成员" },
              { value: "admin", label: "管理员" },
              { value: "owner", label: "Owner" },
            ],
          },
        ],
        checks: ["组织至少保留一个 owner", "确认成员 handle 存在", "角色变更需可追溯"],
        preview: ["成员列表会更新", "组织内容管理权限会按新角色生效"],
        submitLabel: "保存成员",
      };
    case "org-trust":
      return {
        title: "调整可信状态",
        description: "用于维护组织 trustedPublisher 状态。",
        intent: "标记或取消组织可信发布者身份。",
        fields: [
          { type: "readonly", label: "当前状态", value: row.status },
          {
            type: "select",
            label: "新状态",
            value: row.status.includes("可信") ? "false" : "true",
            options: [
              { value: "true", label: "可信发布者" },
              { value: "false", label: "普通组织" },
            ],
          },
          { type: "textarea", label: "依据", placeholder: "说明组织可信身份的认证或取消原因。" },
        ],
        checks: ["确认组织身份", "确认成员结构", "确认名下内容没有未处理风险"],
        preview: ["组织可信状态将更新", "关联包或 Skill 的展示信任信号可能变化"],
        submitLabel: "保存可信状态",
      };
    case "api-copy-prefix":
      return {
        title: "复制 Key 前缀",
        description: "只复制非敏感前缀，用于定位 Token。",
        intent: "把 Key 前缀用于排查，不展示完整密钥。",
        fields: [{ type: "readonly", label: "前缀", value: row.subtitle }],
        checks: ["只复制 prefix，不读取完整 token", "公开预览下不会显示他人完整 Key"],
        preview: ["剪贴板只包含前缀", "不会产生审计写入"],
        submitLabel: "复制前缀",
      };
    case "api-rename":
      return {
        title: "重命名 API Key",
        description: "用于调整 Key label，方便用户识别用途。",
        intent: "仅修改 label，不改变 token secret 和权限。",
        fields: [
          { type: "readonly", label: "当前名称", value: row.title },
          { type: "text", label: "新名称", placeholder: "例如 CI publish token" },
        ],
        checks: ["确认是当前用户可管理的 Key", "名称不应包含 secret", "不会改变 token 权限"],
        preview: ["API Key label 将更新", "prefix 和创建时间保持不变"],
        submitLabel: "保存名称",
      };
    case "api-revoke":
      return {
        title: "吊销 API Key",
        description: "用于立即停用 Token。",
        intent: "阻止该 Key 后续继续调用 API。",
        danger: true,
        fields: [
          { type: "readonly", label: "Key 前缀", value: row.subtitle },
          { type: "textarea", label: "吊销原因", placeholder: "例如泄露、长期未使用、人员离职。" },
          { type: "text", label: "确认输入前缀", placeholder: row.subtitle },
        ],
        checks: ["确认不会影响仍在运行的自动化", "确认 prefix 匹配", "吊销后不能恢复同一个 secret"],
        preview: ["Token 将设置 revokedAt", "后续 API 调用会失败"],
        submitLabel: "吊销 Key",
      };
    case "package-versions":
      return {
        title: "查看版本",
        description: "用于从 Package 维度检查最新版本、运行时和扫描状态。",
        intent: "确认版本风险和发布通道，不在这里编辑包内容。",
        fields: [
          { type: "readonly", label: "当前版本", value: row.metric },
          { type: "readonly", label: "扫描状态", value: row.status },
          {
            type: "select",
            label: "版本范围",
            value: "latest",
            options: [
              { value: "latest", label: "最新版本" },
              { value: "recent", label: "最近 10 个版本" },
              { value: "all", label: "全部版本" },
            ],
          },
        ],
        checks: ["代码执行包优先检查", "异常扫描状态优先处理", "确认 runtime 和发布通道"],
        preview: ["中间表格可切到版本列表", "右侧继续显示包风险上下文"],
        submitLabel: "查看版本",
      };
    case "package-takedown":
      return {
        title: "下架 Package",
        description: "用于从目录中隐藏或下线 Package。",
        intent: "阻止继续发现或安装风险 Package。",
        danger: true,
        fields: [
          { type: "readonly", label: "Package", value: row.subtitle },
          {
            type: "select",
            label: "处理范围",
            value: "package",
            options: [
              { value: "package", label: "整个 Package" },
              { value: "version", label: "仅最新版本" },
            ],
          },
          { type: "textarea", label: "原因", placeholder: "说明下架依据。" },
        ],
        checks: ["确认是否执行代码", "确认扫描和来源", "确认下架范围"],
        preview: ["Package 将从可见目录中移除", "已有安装可能需要单独处理"],
        submitLabel: "下架 Package",
      };
    case "audit-target":
      return {
        title: "查看对象",
        description: "用于从审计记录跳转到目标对象。",
        intent: "快速定位被操作的 Skill、用户、Package 或组织。",
        fields: [
          { type: "readonly", label: "审计动作", value: row.title },
          { type: "readonly", label: "目标", value: row.subtitle },
        ],
        checks: ["目标对象可能已删除", "公开预览下可能无法查看敏感对象"],
        preview: ["中间表格可按目标对象过滤", "详情区展示目标当前状态"],
        submitLabel: "查看对象",
      };
    case "audit-copy":
      return {
        title: "复制审计记录",
        description: "用于复制审计记录 ID 或摘要。",
        intent: "把记录 ID 用于排查和沟通。",
        fields: [
          { type: "readonly", label: "动作", value: row.title },
          { type: "readonly", label: "对象", value: row.subtitle },
          { type: "textarea", label: "复制内容预览", value: `${row.title} · ${row.subtitle}` },
        ],
        checks: ["不复制隐藏敏感 metadata", "仅用于内部排查"],
        preview: ["剪贴板将包含审计摘要", "不会产生写入动作"],
        submitLabel: "复制记录",
      };
    default:
      return {
        title: action.label,
        description: "该操作尚未绑定真实写入，仅展示原型字段。",
        intent: "确认操作意图和对象后再进入真实实现。",
        fields: [{ type: "textarea", label: "说明", placeholder: "填写操作说明。" }],
        checks: ["确认对象", "确认权限", "确认审计记录"],
        preview: ["原型不会写入任何数据"],
        submitLabel: action.label,
        danger: action.danger,
      };
  }
}

function renderField(field: OperationField) {
  if (field.type === "readonly") {
    return <ReadOnlyBox key={field.label} label={field.label} value={field.value} helper={field.helper} />;
  }

  if (field.type === "textarea") {
    return (
      <label key={field.label} className="block">
        <FieldLabel field={field} />
        <Textarea
          defaultValue={field.value}
          placeholder={field.placeholder}
          className="mt-1 min-h-[82px] rounded-[8px] border-[#d8d8d0] bg-[#fbfbf8] px-3 py-2 text-sm"
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label key={field.label} className="block">
        <FieldLabel field={field} />
        <select
          defaultValue={field.value}
          className="mt-1 h-9 w-full rounded-[8px] border border-[#d8d8d0] bg-[#fbfbf8] px-3 text-sm text-[#111] outline-none focus:border-[#111]"
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "checkboxes") {
    return (
      <div key={field.label}>
        <FieldLabel field={field} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {field.options.map((option) => (
            <label
              key={option.label}
              className={[
                "flex min-h-9 items-center gap-2 border px-2.5 py-2 text-xs",
                option.danger ? "border-red-200 bg-red-50 text-red-700" : "border-[#d8d8d0] bg-[#fbfbf8]",
              ].join(" ")}
            >
              <input type="checkbox" defaultChecked={option.checked} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label key={field.label} className="block">
      <FieldLabel field={field} />
      <input
        defaultValue={field.value}
        placeholder={field.placeholder}
        className="mt-1 h-9 w-full rounded-[8px] border border-[#d8d8d0] bg-[#fbfbf8] px-3 text-sm outline-none placeholder:text-[#999990] focus:border-[#111]"
      />
    </label>
  );
}

function FieldLabel({ field }: { field: { label: string; helper?: string } }) {
  return (
    <span className="flex items-center justify-between gap-2 text-xs font-medium text-[#555550]">
      <span>{field.label}</span>
      {field.helper ? <span className="truncate font-normal text-[#8a8a83]">{field.helper}</span> : null}
    </span>
  );
}

function ReadOnlyBox({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="min-w-0 border border-[#d8d8d0] bg-[#fbfbf8] p-2.5">
      <div className="text-[11px] text-[#74746d]">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[#111]">{value}</div>
      {helper ? <div className="mt-1 text-[11px] leading-4 text-[#8a8a83]">{helper}</div> : null}
    </div>
  );
}

function roleValue(value: string) {
  if (value.includes("管理员")) return "admin";
  if (value.includes("审核")) return "moderator";
  return "user";
}

function channelValue(value: string) {
  if (value.includes("官方")) return "official";
  if (value.includes("私有")) return "private";
  return "community";
}

function scanValue(value: string) {
  if (/恶意|malicious/i.test(value)) return "malicious";
  if (/可疑|suspicious|扫描可疑/i.test(value)) return "suspicious";
  if (/待|pending/i.test(value)) return "pending";
  return "clean";
}

function visibilityValue(value: string) {
  if (value.includes("受限")) return "restricted";
  if (value.includes("私有")) return "private";
  return "public";
}
