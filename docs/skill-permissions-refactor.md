---
summary: "统一 skill 权限体系的任务计划，覆盖 Web、HTTP API、CLI、下载和目录可见性。"
read_when:
  - 修改 skill 可见性或访问规则
  - 重构 skill 读取、下载、发布权限
  - 排查 private 或 restricted skill 在不同渠道的行为
---

# Skill 权限重构计划

## 目标

将 skill 权限判断收敛到一个小而明确的策略层，让 Web、CLI、HTTP API、下载、文件读取、
版本读取、catalog 列表和管理操作都复用同一套规则。

当前实现的核心概念是对的，但权限逻辑分散在 `convex/lib/skillAccess.ts`、
`convex/skills.ts`、`convex/downloads.ts` 和 `convex/httpApiV1/skillsV1.ts`。
这会导致未来新增可见性状态或新渠道时，容易出现行为不一致。

## 原则

- 先用测试锁定当前行为，再移动代码。
- 先定义产品语义，再修改 endpoint 行为。
- 权限决策集中到策略层，但 route handler 仍负责传输层细节。
- 优先小步兼容迁移，不对 `convex/skills.ts` 做一次性大重写。
- 尽量把“移动代码”和“改变行为”分开做。

## 当前权限概念

### Actor 类型

- 匿名调用者。
- 已登录 Web 用户。
- 已认证 Bearer token 用户。
- Skill owner。
- Publisher member。
- Publisher admin 或 owner。
- 被直接授权的 user。
- 被授权 publisher 的成员。
- Moderator。
- Admin。

### Skill 状态

- `visibility = "public"`。
- `visibility = "restricted"`。
- `visibility = "private"`。
- 已软删除。
- 等待安全扫描。
- 被 moderation 隐藏。
- 被 moderation 移除。
- 被标记为 malware blocked。
- suspicious 但仍可见。

### 操作类型

- 读取详情。
- 在公开列表、搜索、catalog 中可见。
- 读取版本元数据。
- 读取原始文件。
- 下载 zip。
- 发布新版本。
- 删除或恢复。
- rename、merge 或 transfer。
- 设置 visibility。
- grant 或 revoke access。
- 读取 moderation 状态。
- 读取原始 moderation evidence。

## 任务顺序

### 1. 盘点现有权限入口

先梳理所有 skill 权限判断点，不改行为。

至少检查：

- `convex/lib/skillAccess.ts`
- `convex/lib/globalStats.ts`
- `convex/lib/public.ts`
- `convex/skills.ts`
- `convex/downloads.ts`
- `convex/httpApiV1/skillsV1.ts`
- `convex/httpApi.ts`
- `src/routes/management.tsx`
- `src/routes/publish-skill.tsx`

交付物：

- 一张简表：操作 -> 当前函数/路由 -> actor 来源 -> 权限决策。

当前盘点（2026-04-24）：

| 操作 | 当前函数/路由 | actor 来源 | 权限决策 |
| --- | --- | --- | --- |
| Web 详情读取 | `api.skills.getBySlug` | Convex Auth `getAuthUserId(ctx)` | `canReadSkill`；malware blocked 允许详情透明展示 |
| HTTP v1 详情 | `GET /api/v1/skills/{slug}` | public query；失败后 Bearer token fallback | `api.skills.getBySlug`，fallback 用 `internal.skills.canReadSkillInternal` |
| HTTP v1 versions | `GET /api/v1/skills/{slug}/versions` | public query；失败后 Bearer token fallback | public skill 走 `listVersionsPage`，fallback 用 `canReadSkillInternal` 后读 internal versions |
| HTTP v1 version detail | `GET /api/v1/skills/{slug}/versions/{version}` | public query；失败后 Bearer token fallback | public skill 走 `getVersionBySkillAndVersion`，fallback 用 `canReadSkillInternal` |
| HTTP v1 scan | `GET /api/v1/skills/{slug}/scan` | public query；失败后 Bearer token fallback | public skill 走 `getBySlug`，fallback 用 `canReadSkillInternal` |
| HTTP v1 raw file | `GET /api/v1/skills/{slug}/file` | public query；失败后 Bearer token fallback | public skill 或 fallback-readable skill 可读；version soft delete 独立阻断 |
| Web readme/file actions | `api.skills.getReadme` / `api.skills.getFileText` | Convex Auth in action | `canReadSkillVersionFiles`；malware blocked file read 特殊放行 |
| Download zip | `/download/zip?slug=` | public query；失败后 Bearer token fallback | `api.skills.getBySlug` / `canReadSkillInternal` 后下载专属 moderation block |
| Public list/search | `listPublicPage*`, search hydration | anonymous/public | `toPublicSkill` / `isPublicSkillDoc` |
| Unified skill catalog | `searchPackageCatalogPublic` | anonymous/public | skill catalog maps to `official` / `community`; no private skill channel |
| Visibility 管理 | `api.skills.setVisibility` | Convex Auth `requireUser(ctx)` | `canManageSkillAccess` |
| Access grant/revoke/list | `grantAccess`, `revokeAccess`, `listAccessGrants` | Convex Auth `requireUser(ctx)` | `canManageSkillAccess` |
| Soft delete/undelete | `setSkillSoftDeletedInternal` | API token user id | direct owner or moderator |
| Staff detail | `getBySlugForStaff` | Convex Auth staff route | staff-only route helpers |

### 2. 定义权限矩阵

明确 actor、skill 状态和操作类型之间的预期结果。

矩阵必须回答：

- 谁能读取 public、restricted、private skill？
- grant 是否只对 `restricted` 生效，还是也对 `private` 生效？
- 哪些 moderation 状态会阻断 detail、file、version 和 download？
- owner 和 staff 是否能读取 hidden 或 pending skill？
- malware-blocked skill 是否为了透明度保留详情可见？
- 原始 moderation evidence 是否只允许 owner/staff 查看？

交付物：

- 在本文档或链接的测试 fixture 中记录明确矩阵。

当前兼容矩阵 v0：

| 场景 | Detail/version | Public list/search/catalog | File/readme | Download |
| --- | --- | --- | --- | --- |
| public + active | 所有人可读 | 可见 | 可读 | 可下载 |
| restricted + active | owner、publisher member、staff、direct grant、publisher grant 可读 | 不可见 | 同 detail | 同 detail |
| private + active | owner、publisher member、staff 可读；grant 不生效 | 不可见 | 同 detail | 同 detail |
| soft-deleted | staff/owner policy 可读，但 public 不可见；HTTP owner fallback 返回删除提示 | 不可见 | 不可读 version/file | 不可下载 |
| hidden pending scan | owner、publisher member、staff 可读；public 不可读 | 不可见 | 同 detail；当前 malware 例外不适用 | `423` |
| hidden by moderation | owner、publisher member、staff 可读；public 不可读 | 不可见 | 同 detail；当前 malware 例外不适用 | `403` |
| removed | owner、publisher member、staff 可读；public 不可读 | 不可见 | 同 detail；当前 malware 例外不适用 | `410` |
| blocked.malware | detail 为透明度特殊可见；普通 `canReadSkill` 仍按 moderation 不公开 | 不可见 | 当前 file/readme 特殊放行 | `403` |
| suspicious active | public 可读且带公开 moderation summary | 可见 | 可读 | 可下载 |

待产品确认：

- `private` grant 当前不生效；是否保持为“只限 owner/publisher/staff”。
- publisher member 目前读取 private/restricted 时不区分 member role；管理访问只允许 publisher `owner/admin`。
- raw moderation evidence 当前应只给 direct owner 和 staff；publisher owner/admin 是否也应包含在后续策略中。

### 3. 先增加权限矩阵测试

在移动逻辑前，先用测试描述预期行为。

覆盖：

- anonymous 访问 public、restricted、private。
- owner 访问 public、restricted、private。
- publisher member 访问 public、restricted、private。
- grant user 和 grant publisher 访问 restricted。
- grant user 和 grant publisher 访问 private。
- moderator/admin 行为。
- soft-deleted、pending scan、hidden、removed、malware blocked、suspicious 状态。
- detail、list/search/catalog、version、file、download、manage access。

交付物：

- 聚焦的测试；如果权限矩阵意外变化，测试会失败。

### 4. 明确 catalog channel 和 skill visibility 的关系

先明确 package catalog 的 `channel` 和 skill 的 `visibility` 是否是同一套语义。

当前行为：

- Skill catalog 只映射为 `official` 或 `community`。
- `channel=private` 不返回 skills。
- Skill 的 `public/restricted/private` 是另一套 visibility 概念。

需要决策：

- 保持两套概念分离，并在文档中明确说明。
- 或者让 `channel=private` 返回当前调用者可读的 private/restricted skills。

这个决策必须在修改 catalog filter 前完成。

交付物：

- 更新产品/API 说明，明确 catalog channel 和 skill visibility 的关系。

当前决策 v0：

- 先保持两套概念分离。
- Package catalog `channel` 表示 package registry channel。
- Skill catalog 暂时只映射公开可发现 skill 的 `official` / `community`。
- `channel=private` 不返回 skills；private/restricted skill 只通过 detail/file/version 的授权读取路径暴露。

### 5. 新建 `convex/lib/skillPolicy.ts`

新增策略模块，第一步只包装当前行为，不急着改语义。

候选 API：

- `canReadSkillForActor(ctx, skill, actor)`
- `canListSkillPublicly(skill)`
- `canReadSkillVersion(ctx, skill, actor)`
- `canReadSkillFile(ctx, skill, actor)`
- `canDownloadSkill(ctx, skill, actor)`
- `canManageSkillAccess(ctx, skill, actor)`
- `canPublishSkillVersion(ctx, existingSkill, actor, targetPublisherId)`
- `canDeleteSkill(ctx, skill, actor)`
- `canSeeModerationEvidence(ctx, skill, actor)`

返回值可以是 boolean，也可以是结构化结果。下载和 HTTP route 需要区分状态码/错误消息，
更适合结构化结果。

交付物：

- 新策略模块。
- 覆盖核心矩阵的测试。

### 6. 迁移现有 `skillAccess` 逻辑

移动或 re-export 现有函数，保证只有一个规范实现。

需要保留的现有函数：

- `getSkillVisibility`
- `isStaffUser`
- `isModerationPubliclyReadable`
- `canManageSkillAccess`
- `hasSkillAccessGrant`
- `canReadSkill`

避免长期保留两套独立实现。

交付物：

- `convex/lib/skillAccess.ts` 委托给 `skillPolicy.ts`，或变成兼容导出层。

### 7. 统一详情、版本和文件读取权限

让读取路径统一调用策略层。

目标：

- `api.skills.getBySlug`
- `api.skills.listVersions`
- `api.skills.listVersionsPage`
- `api.skills.getVersionById`
- `api.skills.getVersionBySkillAndVersion`
- 读取 version files 的相关 helper/action

交付物：

- 这些读取路径不再手写 visibility 判断。

进展（2026-04-24）：

- `listVersions`、`listVersionsPage`、`getVersionById`、`getVersionBySkillAndVersion` 已改为调用 `canReadSkillVersion`。
- `getReadme`、`getFileText` 已通过 `canReadSkillFileInternal` 调用策略层，保留 malware-blocked 文件透明读取行为。
- `api.skills.getBySlug` 暂时仍保留 detail 专属的 malware transparency 和 moderation response shaping，后续再抽到 readable resolver。

### 8. 统一 HTTP API 私有 fallback

重构 `convex/httpApiV1/skillsV1.ts`，让所有 skill GET endpoint 通过同一个 helper 解析可读 skill。

候选 helper：

- `resolveReadableSkillForRequest(ctx, request, slug)`

它需要处理：

- 公开可读 skill。
- Bearer token 用户读取 restricted/private skill 的 fallback。
- owner 查看 hidden 状态时需要的特殊错误提示。

交付物：

- detail、versions、version detail、scan、file endpoint 使用同一个 readable-skill resolver。

进展（2026-04-24）：

- 新增 `resolveReadableSkillForRequest(ctx, request, slug)`，统一处理公开 `getBySlug` 和 Bearer token fallback。
- `GET /api/v1/skills/{slug}`、`/versions`、`/versions/{version}`、`/scan`、`/file` 已使用同一个 readable-skill resolver。
- moderation endpoint 暂时保留独立逻辑，因为它需要 raw evidence 和 owner/staff redaction 规则。

### 9. 统一下载授权

重构 `convex/downloads.ts`，下载前统一使用策略层判断 read 和 download block。

route handler 仍保留下载专属逻辑：

- rate limit bucket。
- version/tag 解析。
- zip 构建。
- 下载统计记录。
- CORS 和响应 headers。

把权限和 moderation denial 决策移动到策略层。

交付物：

- 下载拒绝行为由矩阵测试覆盖，并且读取规则与 file/version endpoint 一致。

进展（2026-04-24）：

- `convex/downloads.ts` 的 malware、pending scan、removed、hidden moderation download block 已改为调用 `canDownloadSkill`。
- route handler 仍保留 rate limit、version/tag 解析、zip 构建、统计和响应 header。

### 10. 统一公开列表、搜索和 catalog 可见性

让公开发现流统一使用一个 visibility predicate。

目标：

- `isPublicSkillDoc`
- `toPublicSkill`
- `listPublicPageV3`
- `listPublicPageV4`
- skill catalog filters
- search digest hydration

交付物：

- 所有公开发现路径使用同一套公开可见规则。

进展（2026-04-24）：

- `toPublicSkill` 直接使用 `canListSkillPublicly`。
- `listPublicPageV3/V4` digest hydration 和 capability-tag 扫描路径已在入口使用 `canListSkillPublicly`。
- skill package catalog 的 list/search 过滤已使用 `canListSkillPublicly`，并保持 `channel=private` 不返回 skills。
- search exact slug、embedding hydration、lexical fallback 已在候选阶段使用 `canListSkillPublicly`，避免只检查 `softDeletedAt`。

### 11. 修正 API 文档和 v1 列表行为

确认 `/api/v1/skills` 当前是否返回真实结果，还是走了已废弃的空实现。

如果返回空：

- 用当前活跃的 V4 list path 恢复实现；或
- 标记 deprecated，并记录替代路径。

交付物：

- `docs/http-api.md` 与实现一致。
- 测试覆盖文档描述的行为。

进展（2026-04-24）：

- `GET /api/v1/skills` 已从废弃的 `api.skills.listPublicPage` 空实现切到 `api.skills.listPublicPageV4`。
- 文档已更新为 V4 支持的 sort 集合；旧 `installsCurrent`、`installsAllTime`、`trending` 参数作为兼容别名映射到 `installs`。
- handler 测试覆盖 tag 批量解析、sort alias、`nonSuspiciousOnly` 和 legacy `nonSuspicious`。

### 12. 检查 audit log 完整性

确认所有改变权限的操作都有审计日志。

检查：

- Visibility 修改。
- Access grant。
- Access revoke。
- Delete。
- Undelete。
- Ownership transfer。
- Rename 或 merge，如相关。
- Moderation override。

交付物：

- 补齐缺失的 audit log。

进展（2026-04-24）：

- `setVisibility` 已记录 `skill.visibility.set`。
- `grantAccess` / `revokeAccess` 已记录 `skill.access.grant` / `skill.access.revoke`。
- `setSoftDeleted` 和 `setSkillSoftDeletedInternal` 已记录 `skill.delete` / `skill.undelete`。
- `setSkillManualOverride` / `clearSkillManualOverride` 已记录 `skill.manual_override.set` / `skill.manual_override.clear`。
- `renameOwnedSkill` / `mergeOwnedSkillIntoCanonical` 已记录 `skill.slug.rename` / `skill.merge`。
- transfer request/accept/reject/cancel 已记录 `skill.transfer.*`。
- 已补齐 ownership transfer 的 skill 维度审计：
  - `acceptTransferInternal` 额外记录 `skill.owner.change`，便于按 skill 审计历史查询归属变更。
  - `reclaimSlugInternal(..., transferRootSlugOnly: true)` 额外记录 `skill.owner.change`，避免原本只写 `targetType="slug"` 的 `slug.reclaim` 导致 staff skill audit 看不到归属变化。
- 用户 ban/unban、malware autoban、user moderation 批处理由用户级 audit log 记录触发原因和影响数量；单个 skill 级批量日志暂不展开，避免大批量写入放大。

### 13. 策略稳定后再拆分 `convex/skills.ts`

只有在测试和策略层稳定后，才拆分这个大模块。

建议拆分：

- `convex/skills.read.ts`
- `convex/skills.publish.ts`
- `convex/skills.access.ts`
- `convex/skills.catalog.ts`
- `convex/skills.moderation.ts`
- `convex/skills.versions.ts`

在调用方迁移完成前，保留 `convex/skills.ts` 作为公共导出聚合层。

交付物：

- 更小的模块。
- 不改变行为。
- import 保持稳定，或有计划地迁移。

进展（2026-04-24）：

- 阶段 13 已完成第一轮安全拆分：先抽纯 helper / 展示层 helper，暂不移动 `api.skills.*` / `internal.skills.*` Convex 函数导出路径。
- 新增 `convex/lib/skillCatalog.ts`，承载 package skill catalog 的 cursor 编解码、channel/filter、public item 构造和搜索评分。
- 新增 `convex/lib/skillVersions.ts`，承载 skill version 的公开响应类型与序列化函数。
- 新增 `convex/lib/skillPublicEntries.ts`，承载公开 skill entry 构建、digest entry 构建和 active owner 过滤。
- `convex/skills.ts` 仍保留 `listPackageCatalogPage` / `searchPackageCatalogPublic` query handler 和分页扫描流程，避免影响生成的 Convex API 路径。
- 更深层的函数导出拆分（例如 `skills.read.ts`、`skills.publish.ts`、`skills.access.ts`）需要单独迁移调用方或保留聚合导出，后续作为独立重构继续推进。

### 14. 回归验证

运行常规检查：

```bash
bun run lint
bun run test
bun run coverage
```

如果 Convex 函数签名或 generated API 引用发生变化：

```bash
bunx convex codegen
```

合并前还需要运行仓库要求的 typecheck：

```bash
bunx tsc -p packages/schema/tsconfig.json --noEmit
bunx tsc -p packages/clawhub/tsconfig.json --noEmit
```

如果修改了 Convex 代码，还要运行 deploy 等价路径使用的 Convex typecheck，
确保 `bunx convex deploy` 不会在 `tsc` 阶段失败。

进展（2026-04-24）：

- `bun run lint` 通过。
- `bun run test` 通过：129 files / 992 tests。
- `bun run coverage` 通过：全局 statements 88.28%、functions 90.84%、branches 76.81%、lines 91.77%，满足全局 80% 覆盖要求。
- `bunx tsc --noEmit` 通过。
- `bunx tsc -p packages/schema/tsconfig.json --noEmit` 通过。
- `bunx tsc -p packages/clawhub/tsconfig.json --noEmit` 通过。

## 预期最终状态

- 权限行为有明确矩阵。
- 测试保护权限矩阵。
- 所有读取、下载、管理路径都调用统一策略层。
- HTTP routes 共享同一个 readable-skill resolver。
- 公开发现流有唯一的公开可见 predicate。
- Catalog channel 和 skill visibility 不再语义混淆。
- 因为权限行为已经集中，后续可以安全拆分 `convex/skills.ts`。
