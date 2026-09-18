# English Daily · 英语每日练习

面向初三一对一英语教学的练习站，支持教师布置作业、学生作答、批改反馈、学习统计和收藏打印。本仓库是**自有服务器部署版**，由原 Sites 版本移植，使用 Next.js + Node.js + SQLite + 本地媒体文件，不需要 Sites、Cloudflare、GPT 账号或 AI API Key。

## 功能

- 教师与学生使用独立用户名和密码；角色由服务器确定，没有师生身份切换入口。教师管理唯一学生账号，学生不能进入教师操作。
- 阅读：导入 `<questions>` JSON 题目，单独导入 `<solutions>` 答案解析。
- 听力：上传完整 TXT 文字稿和音频，核对分句后勾选重点句生成听写题，自动填参考答案。每次建议 2–4 句；支持听音次数、暂停、可选进度/速度、逐词核对和补一次重听。分句并非语音对齐，教师需核对序号或在题干写时间提示。
- 语法选择、填空、语篇题，写作，视频和 HTML 知识拓展。无歌曲或 AI 转述功能。
- 双栏独立滚动、划线、单词/句子收藏、批注、筛选和 A4 打印/HTML 导出。
- 学生草稿自动保存；首次答案与成绩保留，订正另存；原文和答案按教师设置在提交后或批改后开放。
- 作业保存材料快照：修改题库只影响以后布置的作业。

## 部署前准备

推荐一台 Linux 服务器，安装 Docker Engine、Docker Compose v2 和 Caddy；准备指向该服务器的域名，开放 80/443 端口。构建时需要能访问 GitHub、npm 和 Docker 镜像仓库。小规模单教师/单学生使用，建议至少 2GB 内存，构建时留足可用内存与磁盘空间。

本版本只部署**一个应用实例**，SQLite 和媒体保存在同一个持久化数据卷。不要把数据库放进 NFS，也不要直接扩为多个副本。

公网登录必须使用 HTTPS：会话 Cookie 使用 `Secure` 和 `__Host-`。只用 HTTP 公网 IP 访问可能出现“登录后仍未登录”。页面字体和脚本随网站提供，不依赖 Google Fonts 等远程资源；教师引用的外部资料和 HTML 外链图片仍取决于学生网络。

## 方式一：Docker Compose（推荐）

### 1. 拉取与配置

```bash
git clone https://github.com/kissthe/EnglishDaily.git
cd EnglishDaily
cp .env.example .env
```

编辑 `.env`：

```dotenv
PUBLIC_ORIGIN=https://english.example.com
DATA_DIR=/app/data
```

将域名换成你自己的。`PUBLIC_ORIGIN` 必须与浏览器地址的协议、域名、端口完全一致，**不带路径或末尾斜杠**。它是写操作的来源校验依据。Compose 固定容器内数据目录为 `/app/data`；`.env` 的 `DATA_DIR` 主要供非 Docker 运行参考。

### 2. 构建并初始化教师

```bash
docker compose build
read -r -p '教师用户名（3–32 位英文字母、数字、._-）：' TEACHER_USERNAME
read -r -s -p '教师密码（至少 12 位）：' TEACHER_PASSWORD
export TEACHER_USERNAME TEACHER_PASSWORD
docker compose run --rm -e TEACHER_USERNAME -e TEACHER_PASSWORD app node scripts/init-teacher.mjs
unset TEACHER_USERNAME TEACHER_PASSWORD
```

密码输入不会回显，不要把真实密码写入仓库、README 或聊天。初始化会创建数据库、执行迁移并创建唯一教师账号；若已有教师会拒绝覆盖。新部署题库为空，请登录后创建/导入材料。网页不开放注册，也不能通过伪造平台身份头创建教师。

### 3. 启动

```bash
docker compose up -d
docker compose logs --tail=100 app
```

应用只绑定服务器的 `127.0.0.1:3000`，由 HTTPS 反向代理对外提供服务。

### 4. 配置 HTTPS

安装 Caddy 后，将 `deploy/Caddyfile` 的域名改成 `.env` 中的域名，合并到服务器的 Caddy 配置中。不要覆盖已有其他网站配置。示例：

```caddyfile
english.example.com {
    request_body {
        max_size 85MB
    }
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Real-IP {remote_host}
    }
}
```

验证、重载（按实际配置路径调整）：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

DNS 和 80/443 可用时，Caddy 负责签发并续期证书。`X-Real-IP` 必须由代理覆盖，用于登录限流，不要将 3000 端口直接暴露公网。使用宝塔/Nginx 也可以：代理到 `http://127.0.0.1:3000`，配置有效 HTTPS 证书、至少 85MB 上传限制，并覆盖 `X-Real-IP`。不要缓存 `/api/*` 或 `/favorites/print`。

### 5. 第一次使用

打开 `https://你的域名`，使用刚设置的教师账号登录：

1. 在“教学设置”填写学生姓名、教材、地区和每日时长。
2. 在“账号与密码 → 学生账号”创建学生的用户名和密码，需要确认教师密码。
3. 新建材料、核对来源与答案、通过审核，再在“每日作业”中布置。
4. 学生从同一个网址登录自己的账号。要换账号，先退出再输入另一账号的凭据。

## 方式二：直接使用 Node.js

使用 Node.js **22.16.0 或更高版本**（建议 Node 22 LTS）；依赖内置 `node:sqlite`。从项目根目录运行：

```bash
npm ci
npm run build
export DATA_DIR=/srv/english-daily-data
export PUBLIC_ORIGIN=https://english.example.com
mkdir -p "$DATA_DIR"
read -r -p '教师用户名：' TEACHER_USERNAME
read -r -s -p '教师密码：' TEACHER_PASSWORD
export TEACHER_USERNAME TEACHER_PASSWORD
npm run init:teacher
unset TEACHER_USERNAME TEACHER_PASSWORD
npm start
```

`DATA_DIR` 必须对运行用户可写。初始化脚本不会自动读取 `.env`，需要按上面导出环境变量。生产环境请用 systemd 等进程管理器保持运行，工作目录设置为仓库根目录，持续提供 `DATA_DIR`、`PUBLIC_ORIGIN` 和 `NODE_ENV=production`。默认只监听 `127.0.0.1:3000`，沿用上面的 HTTPS 代理。

Docker 使用 Next.js standalone 输出；直接 `npm start` 使用完整项目和 `node_modules`。请勿使用静态导出、GitHub Pages 或只复制 `public/`：登录、数据库、上传和作业都需要服务端。

## 数据保存在哪里

| 内容 | Docker 中的位置 |
| --- | --- |
| 账号密码哈希、会话、题库、作业、提交、批改、听音次数、收藏批注 | `/app/data/english-daily.sqlite` |
| SQLite 运行时文件 | 同目录的 `-wal`、`-shm` 文件 |
| 音频与视频 | `/app/data/media/<文件ID>` |
| 文件 MIME 元信息 | `/app/data/media/<文件ID>.json` |

这些文件保存在 Docker 命名卷 `english_daily_data`，普通重启、重建镜像不会删除。**不要执行 `docker compose down -v`**，那会删除数据卷。数据文件、媒体、密码和 `.env` 都不应提交到 GitHub。

密码使用带随机盐的 scrypt 哈希；会话仅保存令牌摘要。登录有效期七天；修改密码或教师重置学生密码会撤销旧会话。登录限流按账号/IP/全局计数，反复失败最长可能需要等待 15 分钟。没有内置“找回教师密码”流程，请安全保存凭据和备份。

## 备份与恢复

为保证数据库和媒体一致，以下简单方案会短暂停止网站。建议每次升级前备份，并定期把备份复制到另一台机器。

### 备份（Docker）

在仓库根目录执行，文件名请每次使用不同日期：

```bash
mkdir -p backups
docker compose stop app
docker compose run --rm --no-deps -T app tar -C /app/data -czf - . > backups/english-daily-2026-09-12.tar.gz
docker compose start app
tar -tzf backups/english-daily-2026-09-12.tar.gz
```

确认命令成功且归档包含数据库和媒体后再保留。备份包含学生作业及账号哈希，应限制访问；不要放到网站公开目录或 GitHub。

### 恢复到一个新的空数据卷

先停止应用，**保留旧数据卷**。创建恢复专用卷，将备份恢复进去：

```bash
docker compose stop app
docker volume create english_daily_restored
docker run --rm -i --user 0 -v english_daily_restored:/data node:22-bookworm-slim sh -c 'tar -xzf - -C /data && chown -R 1000:1000 /data' < backups/english-daily-2026-09-12.tar.gz
```

将 `compose.yaml` 最下面的数据卷 `name` 从 `english_daily_data` 改成 `english_daily_restored`，然后执行 `docker compose up -d`。确认账号、作业、收藏和音视频都正常后再决定是否清理旧卷。恢复后不要再次初始化教师账号。直接 Node 部署可在停止服务后备份/恢复整个 `DATA_DIR`。

## 更新代码

```bash
# 先按上面的步骤备份
git pull --ff-only
docker compose up -d --build
docker compose logs --tail=100 app
```

数据库首次访问时会按顺序执行未应用的 `drizzle/*.sql` 迁移，已执行记录保存在 `selfhost_migrations`。不要修改已应用的 SQL 文件。若未来升级修改数据库结构，回退时应配合升级前的数据备份，不能保证只回退代码就能兼容。

## 从原 Sites 网站迁移

本次提交的是**应用源代码和部署配置**，没有迁移原 Sites 上的真实账号、材料、作业、收藏或音视频。原网址的数据不会因为克隆仓库而出现，也不会被本仓库修改。

站内导出的课程 JSON 不是完整数据库备份，不包含账号密码、会话、媒体字节，也不能直接作为 SQLite 恢复文件使用。本版尚未提供 Sites 全量数据导入工具。若要保留旧记录，应另行取得原数据库导出和完整媒体，进行字段/账号归属/文件 ID 映射和迁移验证；不要直接用旧 D1 SQL 覆盖一个已经初始化的新数据库。

## 验证与排查

```bash
npm run typecheck
npm test
npm run build
```

已在 Node 24 环境通过生产编译、standalone 服务启动检查和下面的业务测试；当前环境未运行 Docker 镜像构建，仍需在目标服务器验证 Docker、域名和 HTTPS。

测试覆盖本地磁盘数据库初始化、重复初始化保护、事务回滚、重启后数据保留、角色权限、来源校验、媒体存取与视频 Range、听音次数和单次播放凭证、原文隐藏、听写评分与订正保留。

- “请求来源验证失败”：检查 `PUBLIC_ORIGIN` 是否与浏览器地址完全一致，更改 `.env` 后重建容器配置（`docker compose up -d`）。
- 登录后仍未登录：检查 HTTPS、浏览器 Cookie、代理配置；不要使用公网 HTTP。
- 上传失败/413：检查反向代理请求大小上限。音频限 20MB，视频限 80MB。
- 数据库不可用：查看日志，检查数据卷权限、剩余空间、Node 版本及 `drizzle/` 是否存在；不要删除数据库重试。
- 重建后数据消失：检查是否使用了相同的数据卷名称或 `DATA_DIR`。
- 首次启动显示“老师尚未完成初始化”：先运行 `init-teacher.mjs`，然后刷新。
- 从国内网络安装依赖或拉镜像失败：需为服务器配置可用的软件源或镜像访问；该问题不等同于网站运行后要求学生使用 VPN。

## 技术说明

Next.js App Router、React、TypeScript、现有 shadcn/Radix 组件。后端沿用教学业务 API，使用 SQLite 事务适配原数据库接口；媒体通过经过鉴权的 API 读取，不在 `public/` 下。无需外部 AI API。HTML 拓展仅展示受限制的静态内容，不执行上传页面中的脚本。

部署方式参考 [Next.js 自托管文档](https://nextjs.org/docs/app/guides/self-hosting)、[standalone 输出说明](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) 和 [Caddy 反向代理文档](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。

## 2026-09-18 学生端精简更新

学生导航精简为“作业、收藏夹”；作业内含今天、待订正与历史，漏交和未读反馈按需提醒。反馈通过“我已看过反馈”标记，老师更新后会重新提醒。服务器计算知识点统计，尚未开放的答案不参与学生错题统计。

学生使用 `/practice/<任务ID>` 独立页面作答。手机切换材料和题目时播放器保留；老师可以在题目中填写片段起止秒数，播放整篇或片段每次均计一次，暂停继续不重复计次。旧作业快照不变，如需新增片段请编辑材料后重新布置。

草稿仍以服务器为准；浏览器为当前账号和任务缓存尚未同步的输入，重新打开时可选择恢复。公用设备退出前请保存或提交。收藏夹的打印与 HTML 下载已收进同一菜单。

写作支持 1–100 的整数满分，老师可在反馈中分别说明内容、语言与结构。是否要求表达题订正由老师明确勾选，不以未满分自动判定。客观题订正自动核对，表达题订正重新进入待批改。新增 0005 迁移只为提交记录添加反馈/订正字段，部署前请备份。
