---
summary: "部署检查清单：Convex 后端 + Vercel Web 应用 + /api 重写。"
read_when:
  - 准备发布到生产环境时
  - 调试 /api 路由时
---

# 部署

ClawHub 有两个可部署部分：

- Web 应用（TanStack Start）→ 通常部署到 Vercel。
- Convex 后端 → 部署到 Convex（提供 `/api/...` 路由）。

如果你想在自己的基础设施上运行 Convex，而不是使用 Convex Cloud，
请先阅读 [`docs/self-hosted-convex.md`](self-hosted-convex.md)。应用代码已经会从环境变量中读取
Convex 基础 URL，所以主要的部署工作是配置这些环境变量，并将 `/api/*`
路由到你自托管 Convex 的 HTTP 端点。

## 1) 部署 Convex

在本地机器上执行：

```bash
bunx convex env set APP_BUILD_SHA "$(git rev-parse HEAD)" --prod
bunx convex env set APP_DEPLOYED_AT "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --prod
bunx convex deploy
```

或者使用 GitHub Actions 流水线：

```bash
gh workflow run deploy.yml --repo openclaw/clawhub --ref main
```

生产部署说明：

- `deploy.yml` 仅支持手动触发（`workflow_dispatch`）。合并到 `main` 不会自动部署。
- 该工作流必须从 `main` 分支启动。
- 部署目标：
  - `full`：部署 Convex、验证契约、等待匹配的 Vercel 生产部署完成，然后执行冒烟测试
  - `backend`：部署 Convex、验证契约，然后针对当前生产环境执行冒烟测试
  - `frontend`：等待所选 `main` SHA 对应的 Vercel 生产部署完成，然后执行冒烟测试
- `frontend` 目前还不会直接调用 `vercel deploy`。它依赖该 SHA 已存在的 Vercel 基于 Git 的生产部署。
- 实际部署任务使用 GitHub 的 `Production` environment 来提供部署密钥，但不需要额外审批。
- 必需的 `Production` environment secret：`CONVEX_DEPLOY_KEY`。
- 可选的 `Production` environment secret：`PLAYWRIGHT_AUTH_STORAGE_STATE_JSON`，用于带认证态的冒烟测试覆盖。

## CLI npm 发布

`clawhub` CLI 包的发布与应用部署分开进行。
这里只支持稳定版发布：`vX.Y.Z`。

使用 GitHub Actions 工作流：

```bash
gh workflow run clawhub-cli-npm-release.yml \
  --repo openclaw/clawhub \
  --ref main \
  -f tag=v0.10.0 \
  -f preflight_only=true
```

然后从 `main` 再次运行同一个工作流，并带上：

- 相同的 `tag`
- `preflight_only=false`
- `preflight_run_id=<成功的预检运行 id>`

CLI 发布说明：

- 实际发布仅支持手动触发，并且必须从 `main` 分支启动工作流。
- 发布任务会在 GitHub 的 `npm-release` environment 等待审批。
- npm 认证通过 npm trusted publishing 处理，而不是使用 `NPM_TOKEN`。
- 必须为 `clawhub` 包配置 npm trusted publisher，配置项包括仓库 `openclaw/clawhub`、工作流 `clawhub-cli-npm-release.yml`，以及环境 `npm-release`。

该工作流假定此仓库已启用 Vercel Git 集成。它不会直接运行 `vercel deploy`；
与前端相关的步骤会等待所选 SHA 上 GitHub 提交状态 `Vercel – clawhub` 完成，
然后对生产环境执行冒烟测试。

确保 Convex 环境变量已设置（认证 + embeddings）：

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `CONVEX_SITE_URL`
- `JWT_PRIVATE_KEY`
- `JWKS`
- `OPENAI_API_KEY`
- `SITE_URL`（你的 Web 应用 URL）
- 可选的 webhook 环境变量（见 `docs/webhook.md`）
- 可选：`GITHUB_TOKEN`（推荐；可提高发布门禁中使用的 GitHub 账号查询上限）

## 2) 部署 Web 应用（Vercel）

设置环境变量：

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`（Convex 的 “site” URL）
- `CONVEX_SITE_URL`（相同的值；供认证提供方配置使用）
- `SITE_URL`（Web 应用 URL）
- `VITE_APP_BUILD_SHA`（设置为与写入 Convex 的提交 SHA 相同的值）

部署顺序：

1. Convex
2. contract verify
3. 等待同一 Git SHA 的 Vercel 生产部署完成
4. smoke

## 3) 将 `/api/*` 路由到 Convex

当前仓库通过 `vercel.json` 中的 rewrites 实现：

- `source: /api/:path*`
- `destination: https://<deployment>.convex.site/api/:path*`

如果是自托管：

- 将 `vercel.json` 更新为你部署所使用的 Convex site URL。

## 4) Registry 发现

CLI 可以从以下位置发现 API 基地址：

- `/.well-known/clawhub.json`（推荐）
- `/.well-known/clawdhub.json`（旧版兼容）

如果你不提供该文件，用户必须设置：

```bash
export CLAWHUB_REGISTRY=https://your-site.example
```

## 5) 部署后检查

```bash
curl -i "https://<site>/api/v1/search?q=test"
curl -i "https://<site>/api/v1/skills/gifgrep"
```

然后执行：

```bash
clawhub login --site https://<site>
clawhub whoami
```

限流检查：

```bash
curl -i "https://<site>/api/v1/download?slug=gifgrep"
```

确认以下响应头存在：

- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- 在 `429` 响应上有 `Retry-After`

漂移检查：

```bash
bun run verify:convex-contract -- --prod
PLAYWRIGHT_BASE_URL=https://clawhub.ai bunx playwright test e2e/menu-smoke.pw.test.ts e2e/upload-auth-smoke.pw.test.ts
```

Playwright 冒烟测试套件应当在以下情况失败：

- 出现可见错误 UI
- 页面报错
- 浏览器控制台报错

代理/IP 注意事项：

- 默认 IP 来源是 `cf-connecting-ip`。
- 对于非 Cloudflare 的可信代理部署，设置 `TRUST_FORWARDED_IPS=true`。
- 如果代理头没有被正确转发或信任，多个用户可能会被视为同一个 IP，从而误触发限流。
