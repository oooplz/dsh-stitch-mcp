# 实施计划：Stitch 插件按域名分流代理

> **For agentic workers:** 按任务顺序执行；每个任务结束都可独立验证。步骤用 `- [ ]` 勾选。

**目标：** 开关 ON 时只有 `stitch.googleapis.com` 走用户填的代理并立即生效；OFF 时插件完全不干预。

**架构：** 新增 `proxy.js` 提供 `createStitchRouter()`，包装 undici 全局 dispatcher，按 origin 分流；`index.js` 负责装/换/卸与状态；`client.js` 让开关成为即时的阀门。

**技术栈：** 纯 ESM、Node 24 内置 `fetch`、undici 7 的 `ProxyAgent` / `getGlobalDispatcher` / `setGlobalDispatcher`。

## 全局约束

- 文案/注释/README/CHANGELOG 用英文；UI 文案在 `client.js` 的 `I18N`（en/zh）。
- **不升版本号**（`package.json`、`market/listing.json` 保持 0.6.0）。
- 不写 `$DSH_HOME/.env`；只允许删除 0.6.x 的托管块。
- 不引入本地 relay、不加端口、不改 MCP 行的 `url`。
- 非 Stitch origin 必须原样转交给 `previous` dispatcher，零副作用。

---

### Task 1: `proxy.js` —— 按域名分流的包装器

**Files:**
- Create: `proxy.js`
- Test: 临时脚本（仓库外，`%TEMP%`），用打包 node 跑

**Interfaces:**
- `stitchHostOf(origin: string): string` — 小写 hostname，解析失败返回 `''`
- `createStitchRouter({ previous, proxyUrl, host? }): { dispatcher, setProxy(proxyUrl): void, close(): Promise<void> }`
  - `dispatcher` 是普通对象 `{ dispatch, close, destroy }`，可直接交给 `setGlobalDispatcher`
  - `dispatch(opts, handler)`：`stitchHostOf(opts.origin) === host` 且 `proxyUrl` 非空 → 走 `ProxyAgent`；否则 `previous.dispatch`

- [ ] 写 `proxy.js`（依赖注入 `undici`，模块内不直接 import，便于测试）
- [ ] 临时脚本断言：非 stitch origin 只调用 `previous`；stitch origin 在 `proxyUrl` 下调用 `ProxyAgent`；`setProxy(undefined)` 后回到 `previous`
- [ ] 用真实 `ProxyAgent` + 本地假代理断言收到 `CONNECT stitch.googleapis.com:443`
- [ ] `git add proxy.js && git commit -m "feat(proxy): route only the Stitch origin through an opt-in proxy"`

### Task 2: `index.js` —— 安装/切换/卸载 + 迁移

**Files:**
- Modify: `index.js`

- [ ] 删除 `writeProxyEnv()` 与 `.env` 写入路径，保留 `PROXY_BLOCK_START/END` 仅用于迁移删除
- [ ] 新增 `removeLegacyProxyEnv()`：读 `$DSH_HOME/.env`，只删托管块，有变化才写
- [ ] 新增 `applyProxyRoute(proxyUrl)`：懒加载 `undici`（失败则记录原因、不动 dispatcher）；ON 时装包装器、换地址时先建后换再关旧；OFF 时恢复 `previous`
- [ ] `apply()` 与 `keepAlive()` 接入：代理变化时 reload 一次 MCP 行；`status.json` 增加 `proxyApplied` 与 `route`（`proxy` / `direct`）
- [ ] `ctx.effect` 清理函数里卸载包装器 + 关闭 agent
- [ ] `node --check index.js`（打包 node）
- [ ] Commit

### Task 3: `client.js` —— 开关即阀门

**Files:**
- Modify: `client.js`

- [ ] `toggleProxy()`：ON → 校验 host/port 后立即 `creds.set(REF_PROXY, 'http://h:p')`；OFF → 立即 `creds.unset(REF_PROXY)`
- [ ] `describe()` 里把已存 `http://h:p` 回填到 host/port 输入框
- [ ] 文案：`proxyHint` 改为「只影响 Stitch / 立即生效」；`restart` 去掉「需重启」表述
- [ ] `node --check client.js`
- [ ] Commit

### Task 4: 清单与注释

**Files:**
- Modify: `package.json`（`dependencies.undici: ^7.29.1`、`files` 加 `proxy.js`）
- Modify: `cordis.patch.yml`（头部注释：不再写 `.env`，改为按域名分流）

- [ ] 改完 `npm pack --dry-run` 确认 `proxy.js` 在发布清单里
- [ ] Commit

### Task 5: 文档与迁移说明

**Files:**
- Modify: `AGENTS.md`（架构图、运行时文件表、Why-shape 第 5 条、pitfalls「proxy switch does nothing」）
- Modify: `README.md`（只改代理那段）
- Modify: `CHANGELOG.md`（`[Unreleased]` 条目）

- [ ] 三处文档与代码一致，无「需重启」残留
- [ ] Commit

### Task 6: 真机验收（需要重载 bundle）

- [ ] 按 AGENTS.md 的 `rm` + `cp` 覆盖 desktop profile 里的 `index.js` / `client.js` / `proxy.js` / `cordis.patch.yml` / `package.json`
- [ ] 面板关闭再开启 bundle（`plugin_manager` → `set_bundle`），代码生效
- [ ] ON（127.0.0.1:7897）→ 调 `mcp__stitch__list_projects` 出数据；`status.json` 显示 `route: "proxy"`
- [ ] ON + 死端口 → 探测失败，证明代理在链路上
- [ ] OFF → `status.json` 显示 `route: "direct"`，`.env` 里托管块已消失
