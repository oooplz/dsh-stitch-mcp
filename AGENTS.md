# AGENTS.md — dsh-stitch-mcp

Working notes for anyone (human or agent) picking this project up cold.

Project: `C:\project\dsh-plugins\dsh-stitch-mcp` · remote `https://github.com/oooplz/dsh-stitch-mcp.git`
(branch `main`, published on npm as `dsh-stitch-mcp`).

Google Stitch is a **remote MCP endpoint** (`https://stitch.googleapis.com/mcp`,
Streamable HTTP). This plugin registers its 16 tools in DeepSeek Harness as
`mcp__stitch__*` and adds a credential card to the plugin page.

---

## 1. Architecture

```
插件卡片(credentials 服务)
        │  Host 半 index.js  ├─→ ~/.dsh/dsh-runtimes/stitch-mcp/config.json
.credentials.yaml ──────────┘        │  (apiKey / accessToken / projectId / proxy)
上一次 config.json ──────────┘        ↓  每个请求都重读
                              relay.js  (127.0.0.1:7788/mcp)  ──proxy──→ stitch.googleapis.com
                                        ↑
                        @deepseek-ai/dsh-mcp-client (streamable-http)
```

| 文件 | 职责 |
| :-- | :-- |
| `cordis.patch.yml` | 插入 Host 行 `dsh-stitch-mcp`，再插入 `@deepseek-ai/dsh-mcp-client` 行（`streamable-http` → `http://127.0.0.1:7788/mcp`，带 `reconnect`） |
| `index.js` | Host 半：解析凭证 → 写 `config.json` → 拉起/维持 relay → 每 30s 巡检 + 一次真实 `initialize/tools/list` → 写 `status.json` |
| `relay.js` | 本地 relay：按请求选路（直连 / 代理隧道）、注入凭证头、转发请求与响应流 |
| `client.js` | Client 半：`plugins.bundle.config` 里的凭证卡片（API Key / OAuth 两个 tab + 独立代理开关），`I18N` 字典在文件内 |
| `locale/{en,zh}.json` | 插件列表里的标题/描述（未激活时也要能显示） |
| `scripts/` | **已废弃**的代理启动脚本，仅为其它插件保留，Stitch 不再需要 |
| `market/listing.json` | 应用市场提交条目（spec/version 必须与 package.json 同步） |

运行时目录（**不属于仓库**）：`~/.dsh/dsh-runtimes/stitch-mcp/`
`config.json`（0600，唯一的配置事实来源）、`status.json`（自检结果）、`relay.log`（relay 日志）。

### 为什么有 relay

1. `streamable-http` 传输跑在 Harness 宿主进程里，**没有任何代理选项**；宿主进程又不认
   `HTTPS_PROXY`（Node 只在启动时带 `--use-env-proxy` / `NODE_USE_ENV_PROXY` 才生效，插件改不了）。
2. `!!js` 配置表达式可能在 Host 半激活**之前**求值 —— 一旦用它注入凭证，客户端会发出**空的
   `X-Goog-Api-Key`**，把真 key 挡掉。这是 0.4.x 阶段"重启后必挂"的根因之一，务必不要再往
   `cordis.patch.yml` 里写凭证 header。

所以 relay 自己用 `CONNECT` 打通代理隧道（把 socket 交给 `https.Agent.createConnection`），
不依赖任何启动开关，任何 Node 版本都能跑；凭证/代理都在每个请求重读 `config.json`，
改完立即生效。

### 选路规则（0.5.0 起）

| 卡片开关 | 顺序 |
| :-- | :-- |
| 关（默认） | 先直连 → 不通再找本机代理 |
| 开 + 地址 | 先走该地址 → 失败回落直连 |

"找本机代理" = `HTTP(S)_PROXY` / `ALL_PROXY` 环境变量 → Windows 系统代理（仅启用时）→
常见本地端口 `7897 7890 10809 10808 1080 8118 8889`。走通的路记 5 分钟。

---

## 2. 本地安装 / 测试（新会话最容易卡在这里）

没有自动化测试，全部靠"装进 profile → 热重载 → 看 `status.json` → 真调一次工具"。

### 2.1 装进当前 profile

profile 在 `~/.dsh/profiles/desktop`（`package.json` 的 `dsh.profile.bundles` 里要有
`dsh-stitch-mcp`）。两种方式：

```bash
# A. 从 npm（发布过的版本，最接近真实用户）
#    用 plugin_manager 工具：remove_bundle → install_bundle(target="dsh-stitch-mcp@x.y.z",
#    registry="https://registry.npmjs.org")
#    （包已装过时必须先 remove，否则返回 already-installed）

# B. 用本地源码（改一行就想验证时用这个，不改版本号）
cd C:/project/dsh-plugins/dsh-stitch-mcp
npm pack --pack-destination C:/project/dsh-plugins/_dist
#   再把 profile package.json 的依赖指向该 tgz，然后 pnpm install
```

### 2.2 热重载（不用重启 Harness）

调用 `plugin_manager` 工具，先 `set_bundle` `enabled=false`，再 `set_bundle`
`enabled=true`（target `dsh-stitch-mcp`）。返回 `application: "applied"` 即已重新激活。
**不要**用 `settings.section` 注册卡片 —— 曾经直接把 Harness 启动搞挂。

如果只想让某个文件立刻生效、不想重装：直接覆盖 profile 里的副本即可（注意 pnpm 用硬链接，
必须先 `rm` 再 `cp`，否则会写穿到 store）：

```bash
D="C:/Users/yangjiacheng/.dsh/profiles/desktop/node_modules/dsh-stitch-mcp"
for f in index.js relay.js client.js cordis.patch.yml; do rm -f "$D/$f" && cp "$f" "$D/$f"; done
```

### 2.3 验证（三步，缺一不可）

```bash
# 1. Host 半自检：ok / credential / proxy / route / tools
cat ~/.dsh/dsh-runtimes/stitch-mcp/status.json
#    期望 {"ok": true, "credential": "api-key", "route": "...", "tools": 16}

# 2. relay 活着，且知道这次走哪条路
curl -s http://127.0.0.1:7788/healthz

# 3. 真调一次工具（不要只看 status.json 就宣布成功）
#    mcp__stitch__list_projects / mcp__stitch__list_screens(projectId=...)
```

`status.json` 诊断对照：

| 值 | 含义 |
| :-- | :-- |
| `ok: false, error: "no credential configured"` | 卡片里没存凭证 |
| `ok: false, httpStatus: 502, error: {"reason":"ETIMEDOUT"}` | 直连和所有代理都不通 |
| `ok: ` 缺失 / 文件不存在 | Host 半没激活（bundle 未启用或重载失败） |
| `tools: 16` | 正常 |

工具注册状态可以直接查：`cordis_inspect_query(platform="host", provider="Tool",
method="listTools")`，再在结果里找 `mcp__stitch__`。这比问用户"你能看到工具吗"快得多。

### 2.4 单独跑 relay（不经过 Harness）

```bash
cd ~/.dsh/dsh-runtimes/stitch-mcp          # config.json 必须在这个 cwd
STITCH_RELAY_PORT=7799 node C:/project/dsh-plugins/dsh-stitch-mcp/relay.js &
curl -s http://127.0.0.1:7799/healthz
```

---

## 3. 发布流程

```bash
# 1. 改版本（package.json + CHANGELOG 的 [x.y.z] 段 + market/listing.json 的 spec/version）
#    ⚠️ 未经用户确认不要自行改版本号
# 2. 提交 + tag + push（GitHub 直连被墙，必须带代理）
git add -A && git commit -m "chore(release): x.y.z"
git tag -a vx.y.z -m "x.y.z: ..."
https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 git push origin main --follow-tags
# 3. npm publish（本机默认 registry 是 npmmirror，且未登录；用临时 npmrc + 环境变量注入 token）
printf 'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\nproxy=http://127.0.0.1:7897\nhttps-proxy=http://127.0.0.1:7897\n' > /tmp/npmrc-pub/.npmrc
NPM_TOKEN=<token> npm publish --userconfig /tmp/npmrc-pub/.npmrc
rm -rf /tmp/npmrc-pub                      # token 不落盘
# 4. 等 1-3 分钟，确认 dist-tags.latest
curl -s -x http://127.0.0.1:7897 https://registry.npmjs.org/dsh-stitch-mcp | grep -o '"latest":"[^"]*"'
```

事实记录：

- 网络：`stitch.googleapis.com` 和 `github.com` **直连不通**，本机代理 `http://127.0.0.1:7897`；
  npm registry 也要走代理。
- GitHub PAT 只有内容读写权限：`POST /releases` 与 topics 会被 403，**Release 页面得人工建**。
- npm 发布后 registry 有 1-3 分钟延迟，期间 `install_bundle` 会解析不到新版本。

---

## 4. 已知坑

| 坑 | 处理 |
| :-- | :-- |
| `!!js` 注入凭证 | 永远不要；凭证只在 relay 里注入 |
| 激活顺序 | Host 半可能早于 `credentials` 服务 → 必须多路兜底（服务 → `.credentials.yaml` → 环境变量 → 上次 config.json），且**绝不能因为读到空就删配置** |
| `settings.section` | 会让 Harness 起不来，禁用 |
| `plugins.bundle.config` | 只有当宿主存在 Config 表单时才会派发；本 bundle 无 Config，卡片挂载依赖 Host 侧 slot 行为，改动前先热重载验证 |
| pnpm 硬链接 | 覆盖 profile 内文件要先 `rm` 再 `cp` |
| `remove_bundle` + `link:` 依赖 | 会破坏源仓库 `.git`（HEAD/config/index 全没），只用 tarball / registry 安装 |
| 目录被占用 | DSH 监听当前工作区，旧项目目录可能 `Device or resource busy`：用 `cp -a` 复制到新位置再删，删不掉就等关掉 DSH |
| `reg query` / `node -e` 传反斜杠 | Git Bash 下会被吃掉，用 `powershell -NoProfile -Command` 读注册表 |
| MSYS 下 `mv` 跨目录 | 先 `cp -a` 再清理，别指望 `mv` |

---

## 5. 用户偏好（照做，别自作主张）

- UI 文案要短、面向开发者，不要教程式长句；字体/主题跟随系统，不要自定义字体。
- 凭证标签一律写 **API Key**，不能简写成 KEY。
- 源码、README、CHANGELOG、注释全部**英文**；界面文案走 `client.js` 里的 `I18N`（en/zh）。
- 代理是独立开关 + IP/端口，默认 `127.0.0.1:7897`，两项都必填；但**没有代理的机器必须零配置可用**。
- 不要擅自改版本号、不要擅自改插件描述/README 措辞。
- 结论要有证据：改完必须真调一次 `mcp__stitch__*` 工具，别只贴日志。
