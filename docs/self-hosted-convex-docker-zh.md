---
summary: "使用 Docker 自托管 Convex，并将 ClawHub 接到该后端。"
read_when:
  - 想摆脱 Convex Cloud
  - 准备用 Docker 部署 Convex
  - 需要把 ClawHub 指到自托管 Convex
---

# 使用 Docker 自托管 Convex

这篇文档基于以下两类信息整理：

- 本仓库现有部署与环境变量约定
- Convex 官方自托管 README：
  `https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md`

目标是先用官方推荐的最小方案把 Convex 跑起来，再把 ClawHub 接到这个
自托管后端上。官方默认方案使用 Docker volume + 本地 SQLite，适合先跑通；
后续再按需要升级到 Postgres / MySQL、S3、反向代理和 HTTPS。

## 0) 先理解要部署什么

自托管 Convex 至少涉及三部分：

1. Convex backend
2. Convex dashboard
3. 你的前端应用

其中前两者由 Convex 官方提供镜像；ClawHub Web 应用还是按本仓库自己的方式
部署。

官方 Docker 默认端口：

- `3210`：Convex backend
- `3211`：Convex site / HTTP actions
- `6791`：Convex dashboard

## 1) 准备一台 Docker 主机

最小要求：

- Linux 服务器或本地开发机
- 已安装 Docker 和 Docker Compose
- 能持久化 Docker volume

开发环境可以直接用本机回环地址；生产环境建议准备一个单独域名，例如：

- Convex 后端：`https://convex.example.com`
- ClawHub 站点：`https://clawhub.example.com`

## 2) 下载官方 Docker Compose 文件

Convex 官方 README 指向的 Compose 文件在：

`https://github.com/get-convex/convex-backend/tree/main/self-hosted/docker/docker-compose.yml`

可以直接下载到一台空目录里：

```bash
mkdir convex-self-hosted
cd convex-self-hosted
curl -L \
  https://raw.githubusercontent.com/get-convex/convex-backend/main/self-hosted/docker/docker-compose.yml \
  -o docker-compose.yml
```

官方默认 Compose 会启动两个服务：

- `ghcr.io/get-convex/convex-backend:latest`
- `ghcr.io/get-convex/convex-dashboard:latest`

并创建一个名为 `data` 的 Docker volume 来保存本地数据。

## 3) 启动 Convex

直接启动：

```bash
docker compose up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f dashboard
```

如果一切正常，你应该能访问：

- Dashboard：`http://localhost:6791`
- Backend：`http://127.0.0.1:3210`
- HTTP actions / site：`http://127.0.0.1:3211`

说明：

- `3210` 更适合给 CLI / 管理操作使用
- `3211` 是浏览器侧 `/api/*`、Auth callback 等站点流量更常走的地址

## 4) 生成 admin key

按官方 README，在容器里执行：

```bash
docker compose exec backend ./generate_admin_key.sh
```

保存输出的 admin key。后面有两处会用到它：

- Convex CLI 连接自托管后端
- Dashboard 管理访问

如果你想减少手工步骤，也可以直接用仓库内置的一键脚本，它会在 key
缺失时自动生成并保存：

```powershell
bun run self-hosted:up
```

它会自动：

- 执行 `docker compose up -d`
- 在 `.env.self-hosted.local` 里生成并保存 admin key（如果缺失）
- 删除 `.env.local` 里残留的 `CONVEX_DEPLOYMENT`
- 把 `JWT_PRIVATE_KEY` / `JWKS` 这类动态生成值从 `.env.local` 迁到
  `.env.self-hosted.local`
- 在缺失时自动生成本地 Convex Auth 的 `JWT_PRIVATE_KEY` / `JWKS`
- 执行 `bunx convex deploy --typecheck=disable --yes`
- 把 `.env.local` 和 `.env.self-hosted.local` 里的后端运行时变量同步到
  自托管 Convex（但会跳过内建的 `CONVEX_SITE_URL`）

默认它会去仓库上一级目录执行 `docker compose`，也就是当前项目的
`C:\Users\61588\Desktop\Project`。如果你的 Compose 文件不在这里，可以传
`-ComposeDir <path>`。

## 5) 把 Convex CLI 指向自托管后端

在 ClawHub 项目根目录下，不再使用 `CONVEX_DEPLOY_KEY`，而是改用：

```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=<your-admin-key>
```

然后使用 `deploy` 把函数推到 Docker 自托管后端：

```bash
bunx convex deploy --typecheck=disable --yes
```

重要：

- 自托管模式下，不要再混用 `bunx convex dev`。
- `convex dev` 会为当前仓库创建另一套本地 deployment，并在 `.env.local`
  里写入 `CONVEX_DEPLOYMENT=...`。
- 一旦你同时设置了 `CONVEX_SELF_HOSTED_*` 和 `CONVEX_DEPLOYMENT`，
  `bunx convex deploy` / `bunx convex env ...` 会直接报错。

如果你之前跑过 `bunx convex dev`，请先删除 `.env.local` 里的
`CONVEX_DEPLOYMENT` 行，再继续自托管流程。

如果只是验证命令是否连通，也可以先看帮助：

```bash
bunx convex --help
```

## 6) 配置 ClawHub 的前端和运行时环境变量

前端 `.env.local` 只负责让浏览器和 SSR 知道该连哪台 Convex，
关键值如下：

```bash
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_CONVEX_SITE_URL=http://127.0.0.1:3211
CONVEX_SITE_URL=http://127.0.0.1:3211
SITE_URL=http://localhost:3000
```

如果是生产环境，改成你的真实域名：

```bash
VITE_CONVEX_URL=https://convex.example.com
VITE_CONVEX_SITE_URL=https://convex.example.com
CONVEX_SITE_URL=https://convex.example.com
SITE_URL=https://clawhub.example.com
```

还需要保留仓库原本依赖的其他环境变量：

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `OPENAI_API_KEY`

这些变量的用途可参考根目录 [`.env.local.example`](../.env.local.example)。

但要注意：

- `.env.local` 里建议只放你手工维护的值，例如 `AUTH_GITHUB_ID`、
  `AUTH_GITHUB_SECRET`、`SITE_URL` 等。
- `.env.self-hosted.local` 由脚本自动维护，专门保存 admin key、
  `JWT_PRIVATE_KEY`、`JWKS` 这类动态生成值。
- 这两个文件都匹配仓库的 `.env*.local` 忽略规则，不会被提交。
- Docker 自托管的 Convex backend 容器不会自动读取这个仓库里的
  本地 env 文件。
- 所以凡是 Convex 函数运行时需要用到的变量，必须额外写进自托管 Convex
  后端环境里。

## 7) 连接本仓库进行本地开发

推荐启动顺序：

1. 在 ClawHub 仓库里写好前端 `.env.local`
2. 直接执行 `bun run self-hosted:up`
3. 脚本会自动启动 Docker、生成或复用 admin key、生成或复用 auth keys、
   deploy Convex 函数，并把后端运行时变量写入自托管 Convex
4. 另开一个终端执行 `bun run dev`

一个本地 `.env.local` 示例：

```bash
# Frontend
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_CONVEX_SITE_URL=http://127.0.0.1:3211
SITE_URL=http://localhost:3000
CONVEX_SITE_URL=http://127.0.0.1:3211

# 注意：不要再保留 CONVEX_DEPLOYMENT=
```

首次运行后，脚本还会在仓库根目录额外写一个 `.env.self-hosted.local`，
里面保存自动生成的 admin key、`JWT_PRIVATE_KEY`、`JWKS`。

## 8) GitHub OAuth 和 Convex Auth

这个仓库使用 Convex Auth + GitHub OAuth，关键点有两个：

1. `convex/auth.config.ts` 里的 provider domain 读取 `CONVEX_SITE_URL`
2. GitHub OAuth callback 必须指向你的自托管 Convex 站点

也就是说，GitHub OAuth App 里应该配置类似这样的回调地址：

```text
https://convex.example.com/api/auth/callback/github
```

同时确保 Convex 后端环境变量指向正确：

```bash
bunx convex env set SITE_URL https://clawhub.example.com
bunx convex env set AUTH_GITHUB_ID <github-client-id>
bunx convex env set AUTH_GITHUB_SECRET <github-client-secret>
bunx convex env set JWT_PRIVATE_KEY '<private-key>'
bunx convex env set JWKS '<jwks-json>'
```

虽然 `convex/auth.config.ts` 里读取的是 `process.env.CONVEX_SITE_URL`，
但在 self-hosted Convex 里，这个值是内建变量，来源于 backend 的 site
origin 配置，而不是 `bunx convex env set`。对本仓库附带的 Docker Compose
配置来说，也就是要保证 `CONVEX_SITE_ORIGIN` / `3211` 这个站点代理地址
指向正确的公开 Convex URL。

注意：官方 README 额外提醒，如果你使用 Convex Auth，需按官方手动说明完成配置；
不要假设所有云端自动化步骤都能原样套到自托管环境。

如果你还依赖 embeddings / 其他后端功能，也同样需要写进 Convex 后端：

```bash
bunx convex env set OPENAI_API_KEY <openai-api-key>
```

也就是说，排查 “GitHub 认证环境变量没加载” 时，要优先确认的不是
`.env.local`，而是下面这条命令能否看到值：

```bash
bunx convex env list
```

如果你不想手动逐条 `env set`，也可以直接用一键脚本同步：

```powershell
bun run self-hosted:up -- -SkipDocker -SkipDeploy
```

这个脚本会故意跳过 `CONVEX_SITE_URL`，因为 self-hosted Convex 会拒绝覆盖它。

这会保留当前容器和代码部署状态，只把 `.env.local` /
`.env.self-hosted.local` 里的后端变量重新写入自托管 Convex。

如果你想把本地自动生成状态全部清掉并重新生成，可以运行：

```powershell
bun run self-hosted:up -- -ResetGeneratedState
```

## 9) 修正 `/api/*` 转发

这个仓库当前的 [`vercel.json`](../vercel.json) 把：

- `/api/:path*`

重写到了一个固定的 Convex Cloud 域名。切到自托管后，这一步必须改掉，
否则浏览器流量仍然会打到旧的云端地址。

如果你继续把前端部署在 Vercel，至少要把 rewrite 改成你的自托管 Convex
site URL，例如：

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://convex.example.com/api/:path*"
    }
  ]
}
```

如果你是自己托管前端，则在 Nginx / Caddy / Traefik 中把 `/api/*` 代理到
Convex 的 site 地址即可。

## 10) 验证是否部署成功

先直接测 Convex：

```bash
curl -i http://127.0.0.1:3210/version
curl -i "http://127.0.0.1:3211/api/version"
```

如果你只是检查函数是否真的部署到了自托管后端，可以额外执行：

```bash
bunx convex run users:me '{}'
```

如果这里报 `Could not find function`，通常说明：

- 你还没执行 `bunx convex deploy --typecheck=disable --yes`
- 或者 `.env.local` 里还残留着 `CONVEX_DEPLOYMENT`
- 或者当前 shell 没有设置 `CONVEX_SELF_HOSTED_URL` /
  `CONVEX_SELF_HOSTED_ADMIN_KEY`

再测 ClawHub 走公开站点的 API：

```bash
curl -i "https://clawhub.example.com/api/v1/search?q=test"
curl -i "https://clawhub.example.com/api/v1/skills/gifgrep"
```

最后验证登录和 CLI：

```bash
clawhub login --site https://clawhub.example.com
clawhub whoami --site https://clawhub.example.com
```

## 11) 生产环境建议

官方最小 Compose 适合快速启动，但生产至少应考虑：

- 给 Docker volume 挂持久盘
- 用 HTTPS 暴露 Convex 站点
- 视规模改用 Postgres / MySQL
- 视文件量改用 S3 存储 exports、modules、files、search indexes
- 固定镜像版本，不要长期使用 `latest`

官方 README 还给了这些进阶主题入口：

- Postgres / MySQL
- S3 storage
- fly.io / Railway / 自有服务器
- dashboard 本地运行
- 升级自托管版本
- knobs / benchmark / logging

当你只是想先在一台机器上把 ClawHub 跑起来时，建议先坚持最小方案：

1. Docker Compose
2. 本地 SQLite
3. Docker volume
4. 正确的 `CONVEX_SELF_HOSTED_*` 与 `VITE_CONVEX_*` 配置
5. 修正 OAuth callback 和 `/api/*` 转发

这样排障成本最低。

## 12) 和本仓库最相关的检查点

如果切换后仍然打到旧的 Convex Cloud 地址，优先检查这些文件：

- [`src/convex/client.ts`](../src/convex/client.ts)
- [`convex/auth.config.ts`](../convex/auth.config.ts)
- [`src/lib/packageApi.ts`](../src/lib/packageApi.ts)
- [`vercel.json`](../vercel.json)

## 参考

- Convex 官方自托管 README：
  [get-convex/convex-backend self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- Convex 官方 Docker Compose：
  [self-hosted/docker/docker-compose.yml](https://github.com/get-convex/convex-backend/tree/main/self-hosted/docker/docker-compose.yml)
