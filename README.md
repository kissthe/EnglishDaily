# English Daily · 英语每日练习

面向初三一对一英语教学的练习站，支持教师布置作业、学生作答、批改反馈、学习统计和收藏打印。本仓库是**自有服务器部署版**，由原 Sites 版本移植，使用 Next.js + Node.js + SQLite + 本地媒体文件，不需要 Sites、Cloudflare、GPT 账号或 AI API Key。

## 功能

- 教师与学生使用独立用户名和密码；角色由服务器确定，没有师生身份切换入口。教师管理唯一学生账号，学生不能进入教师操作。
- 阅读：导入 `<questions>` JSON 题目，单独导入 `<solutions>` 答案解析。
- 听力：上传完整 TXT 文字稿和音频，核对分句后勾选重点句生成听写题，自动填参考答案。每次建议 2–4 句；支持听音次数、暂停、可选进度/速度、逐词核对和补一次重听。分句并非语音对齐，教师需核对序号或在题干写时间提示。
- 语法选择、填空、语篇题，写作，视频和 HTML 知识拓展。听力支持分阶段转述训练与 AI 反馈。
- 双栏独立滚动、划线、单词/句子收藏、批注、筛选和 A4 打印/HTML 导出。
- 学生草稿自动保存；首次答案与成绩保留，订正另存；原文和答案按教师设置在提交后或批改后开放。
- 作业保存材料快照：修改题库只影响以后布置的作业。
- 阅读提交后可选中文字使用 AI 语境翻译，并保存译文到收藏夹；服务器禁止未提交或仅存草稿时调用。默认提示词在“AI 配置中心 → 阅读 · 划线翻译”中调整，也可暂停功能或指定模型。
- 听力支持最多 6 张配图，每张 PNG/JPEG/WebP 不超过 8MB，教师上传并填写说明；配图随作业快照保存，学生可在已开放的听力作业中查看原图。
- 学生首页设有统一“老师留言板”，无作业时同样显示。教师在学习概览发布、修改或清空留言；各作业页面和布置窗口不再显示或填写“老师的话”。
- 词汇：师生均可查看整库学习覆盖率、长期巩固率、话题完成情况和每词复习记录，支持搜索与状态筛选。完成一次练习计入已学习，连续四轮认对计入长期巩固；答错或不确定会重新巩固，仍按计划继续复习。
- 完整北京中考词表含 424 词、1,272 个导入语境句。原有 32 词的已核对练习保持可用；其余原始例句在教师编辑页中供采用和核对，可手动填写，或使用“用 AI 补齐翻译与选项”生成保留原句的草稿；核对句中词义、整句翻译与三个干扰项后启用。尚未启用的词也计入整库分母，页面单独显示可练词数。

词表随应用构建打包，升级后首次访问词汇页面会自动补充到数据库，保留已有教师编辑和学生进度。重新处理同格式 Markdown 可运行 `node scripts/import-vocabulary-context.mjs "词表.md"`，随后重新构建部署；该步骤不会替换已经核对的练习。词库种子版本 2 只补充缺失的原始语境句，教师日常修改继续在网页中保存。

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

## AI 转述评测

教师可在“AI评测设置”中配置兼容 OpenAI Chat Completions 的 API 地址、模型 ID 和密钥。密钥只保存在服务器数据目录中的 SQLite 设置记录，不会通过课程接口返回浏览器或学生端。学生提交转述时，服务器会把听力原文、信息槽、参考转述和学生文本发送给教师配置的服务商，并保存结构化分数与建议。使用前请确认所选服务商的数据处理政策。

新建听力材料默认使用转述训练，可选择“听懂并记要点”“看要点组织表达”或“听后独立转述”。旧的重点句听写材料保持原有编辑与作答流程。

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

### 听力转述学习流程

- 阶段一按材料的信息项填写关键词，标记“不确定 / 没听到”；只展示信息获取评分。
- 阶段二根据给定要点组织英文表达，提供可收起的示例和提交前自查。
- 阶段三分别保存听力笔记与正式转述，帮助区分听辨遗漏与表达遗漏。
- 新材料默认使用学习练习，可重听、调整进度和速度；限次练习保留教师设置的播放次数。当前仅为文字内容训练，不含录音或发音评分。
- 教师可选择“遗漏或错误信息需要订正”或“由老师决定”。后一种方式在 AI 评测后等待教师确认。
- 首次成绩和答案保留；订正会重新评测，单独显示最新订正表现。AI 暂时失败时仍保留答案，可重新评测或由教师批改。
- 学生提交前，服务器只返回信息项名称，不返回标准信息、听力原文或参考转述。提交后遵守材料的答案开放设置，参考表达默认折叠。
- 无须数据库迁移；既有作业使用原快照，旧文本笔记仍可查看和订正。最新订正评测保存在独立评测记录中，不提供所有历史订正版本。


### 统一学习界面与 AI 配置中心

- 阅读采用专注正文、浮动工具栏与底部题目抽屉；支持字号、划线收藏、逐题切换、展开全部题目、草稿保存和订正。
- 听力提供显著的播放按钮、进度与时间显示，按“记录要点 → 写转述 → 检查并提交”组织学习；保存与提交固定在底部。
- 学生作业、写作、语法、知识拓展，以及教师题库、批改、统计与设置统一采用暖白背景、深色文字和紫色操作按钮，并适配手机。
- 教师进入 **AI 配置中心**，统一设置 API 地址、默认模型、密钥、通用教学要求、随机性和建议数量。三个听力阶段、阅读辅助出题、写作辅助批改可分别设置提示词、模型与启停状态。保存后可测试当前场景。
- 阅读编辑器可生成题目草稿，先核对答案和解析再采用；写作批改可生成分数与反馈建议，采用后仍需教师保存。暂停听力 AI 后学生答案仍保存，由教师批改；重新启用后可重试评测。
- 接口需兼容 Chat Completions 与 JSON 输出。普通练习不依赖 AI；使用 AI 功能需要配置服务。密钥仅保留在服务器，学生端不会收到教师提示词与连接配置。
- AI 分数与客观题正确率分开展示。已有任务快照、首次答案和首次成绩保留。

界面截图：[阅读](docs/project-guide/images/11-reading-redesign.png)、[听力](docs/project-guide/images/12-listening-redesign.png)。


### 知识拓展与黑夜模式

知识拓展库支持主题分类、关键词搜索与学习时长展示。点击“开始探索”或题库预览，将进入独立的 `/knowledge/<材料ID>` 全屏页面；返回时回到知识拓展库。既有 HTML 与 Culture Lab 五步学习进度继续保留。

右下角月亮/太阳按钮切换日间与黑夜模式，默认跟随系统，手动选择保存在当前浏览器。学习页、教师页与 HTML 内容同步切换。HTML 中的图片保留原色；夜间会覆盖正文的亮色背景和文字，以保持可读性。

第一轮六个主题和课堂活动见 [主题课程设计](docs/knowledge-topics/主题课程设计.md)。可上传使用的原创示例：[California 与 Los Angeles](docs/knowledge-topics/california-los-angeles.html)。在“知识拓展 → 新建知识拓展”上传 HTML、核对来源与发布设置后发布；也可启用五步学习流程，增加检测和表达任务。示例未自动发布到现有课程。
