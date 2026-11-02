# Stitch 插件代理设计（0.6.x → 仅对 Stitch 生效的按域名分流）

日期：2026-11-02
状态：已确认（用户确认「全部确认，开工」）

## 问题

0.6.0 已经有代理开关，但它把 `http://host:port` 写进 `$DSH_HOME/.env` 的
`HTTPS_PROXY` / `HTTP_PROXY`，由 `dsh` 启动器在**下次启动**时解析成进程级策略
（`@deepseek-ai/dsh-http-proxy`：一个进程只有一份策略）。由此产生三个问题：

1. **需要重启**：拨动开关当场没有任何效果，卡片只能写「重启后生效」。
2. **影响整进程**：开启后 DeepSeek API、web 搜索、其他 MCP 全部走代理。
3. **阀门不唯一**：用户自己 export 了 `HTTPS_PROXY` 时，插件「关」也不等于直连。

用户要求：**国外用户不需要代理，只有国内用户需要；开启代理是唯一的阀门——用户
选择开才开，不开就直连。**

## 目标与非目标

目标：

- 开关 ON 时，**只有 `stitch.googleapis.com`** 的出站请求走用户填的代理；
- 开关 ON 的改动**立即生效**，不需要重启 Harness；
- 开关 OFF 时插件**不干预任何东西**：Stitch 直连，或按用户环境里的 `HTTPS_PROXY`
  由 harness 自己的策略决定（不强制直连，不覆盖用户意图）；
- 不再写 `$DSH_HOME/.env`，并清掉 0.6.x 留下的托管块。

非目标：

- 不支持 SOCKS / PAC（与 harness 策略一致，`http://`、`https://` 之外的值报错）；
- 不做代理认证 UI（地址里带 `user:pass@` 由 ProxyAgent 自行处理，不额外配置）；
- 不改 MCP 行的 `url`、不加本地 relay 进程、不改 `projectId` 链路。

## 行为矩阵

| 开关 | 插件动作 | Stitch 实际走向 | 其它流量 |
| :-- | :-- | :-- | :-- |
| OFF（默认，无 `STITCH_HTTPS_PROXY`） | 卸载包装器 / 不安装 | 直连，或按环境 `HTTPS_PROXY` | 完全不受影响 |
| ON（`STITCH_HTTPS_PROXY` 有值） | 安装按域名分流的包装器 | 走该代理 | 完全不受影响（原样转交） |

## 机制

harness 的 `@deepseek-ai/dsh-http-proxy` 把出站策略装在 **undici 的全局
dispatcher 槽位**上，Node 内置 `fetch` 与所有最终落到 `globalThis.fetch` 的 SDK
（含 MCP 的 HTTP 传输）都经过它。

插件在 Host half 装一个**极薄的包装器 dispatcher**：

```
fetch(opts)
  └─ wrapper.dispatch(opts, handler)
       ├─ origin 主机是 stitch.googleapis.com 且开关 ON → ProxyAgent(用户地址)
       └─ 其它 → previous.dispatch(opts, handler)      // 纯转交
```

- `previous` 是安装包装器那一刻的全局 dispatcher（可能已是 harness 的代理策略），
  因此 OFF 时插件完全退出链路，环境变量代理照常生效。
- 卸载（禁用/卸载插件）时恢复 `previous` 并关闭自己的 `ProxyAgent`。
- 切换代理地址：**先建新的 `ProxyAgent`，再原子替换字段，最后关旧的**，避免请求打到已关闭的 agent。
- 若发现全局 dispatcher 已不是我们的包装器（被其它插件覆盖），下一个 tick 重新安装。

已验证（打包运行时 Node 24.21 + Electron，undici 7.30.1）：

- 包装器被 Node 内置 `fetch` 调用（`wrapper consulted: true`）；
- 代理分支真的向代理发出 `CONNECT stitch.googleapis.com:443`。

## 状态与持久化

沿用现有 credential ref，**不新增 ref**：

- `STITCH_HTTPS_PROXY` 有值 = ON；无值 = OFF（默认）。
- 开关拨到 ON：立即校验 IP/端口并保存 `http://host:port`，随后 ≤2.5s 内生效
  （`keepAlive` 轮询间隔），并 `pluginManager.reload(['stitch-mcp'])` 一次，
  让因断网而耗尽重连预算的行重新连上。
- 开关拨到 OFF：立即 `unset`，包装器卸载，恢复直连/环境策略。
- 面板挂载时若已有地址，把 host/port 回填到输入框。

## 迁移

0.6.x 在 `$DSH_HOME/.env` 写过：

```
# >>> dsh-stitch-mcp proxy (managed; restart the harness to apply)
HTTPS_PROXY=...
HTTP_PROXY=...
# <<< dsh-stitch-mcp proxy
```

新版本激活时**只删除这个带标记的块**（幂等，不碰 `.env` 里其它内容），
否则「全局代理」会残留、与「只对 Stitch 生效」矛盾。之前保存过代理地址的用户
自然保持 ON（ref 有值）。

## 文件改动

| 文件 | 改动 |
| :-- | :-- |
| `proxy.js`（新增） | 纯函数模块：`createStitchRouter({ undici, previous, proxyUrl, host })`，负责按域名分流；`stitchHostOf(origin)` 解析 origin |
| `index.js` | 删 `writeProxyEnv`；加 `applyProxyRoute()`（装/换/卸包装器）、`removeLegacyProxyEnv()`；`status.json` 增加 `proxyApplied` 与 `route`；tick 里响应代理变化并 reload |
| `client.js` | 开关即保存/即 unset；回填已存地址；文案改成「只影响 Stitch、立即生效、无需重启」 |
| `cordis.patch.yml` | 更新头部注释（不再写 `.env`） |
| `package.json` | `dependencies.undici`（`^7.29.1`，与 `dshmarket` 同款）；`files` 加 `proxy.js` |
| `AGENTS.md` / `README.md` / `CHANGELOG.md` | 架构、行为、迁移说明同步；**不升版本号** |

## 失败处理

| 情况 | 行为 |
| :-- | :-- |
| `undici` 解析不到 | 不动 dispatcher，`status.json` 记 `proxyApplied:false` 与原因，工具仍按环境策略工作 |
| 代理地址非法（`ProxyAgent` 抛错） | 保存失败/状态退回直连，面板报错，不影响其它流量 |
| 代理挂了 | 如实上报 transport error（不做假连接），`status.json` 记录 `error` |
| 用户在 ON 时清空地址 | 等价于 OFF（卸载包装器） |

## 验收

1. `proxy.js` 的运行时行为测试（打包 node 24.21）：非 Stitch origin 100% 转交给
   `previous`；Stitch origin 走 `ProxyAgent` 且代理端收到 `CONNECT stitch.googleapis.com:443`；
   卸载后 dispatcher 恢复为 `previous`。
2. 真机：装进 desktop profile → 面板 ON（127.0.0.1:7897）→ `mcp__stitch__list_projects` 出数据；
   ON 但填死端口 → `status.json` 探测失败（证明代理确实在链路上）；OFF → 探测直连结果如实记录。
3. 迁移：激活后 `$DSH_HOME/.env` 里不再有托管块。
