# dsh-stitch-mcp

[English](README.md) | 简体中文

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中，把 Google **Stitch** 作为原生 `mcp__stitch__*` 工具使用，并提供面板内的 API Key 卡片和可选代理。

Stitch 是一个**远程 MCP 端点**。本插件使用 Streamable HTTP 传输直接连接它，并通过 API Key 请求头认证——这正是 Google 为 MCP 客户端提供的接入方式：

```json
{
  "servers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "type": "http",
      "headers": {
        "Accept": "application/json",
        "X-Goog-Api-Key": "YOUR-API-KEY"
      }
    }
  }
}
```

没有辅助进程，没有本地端口，也没有启动脚本：插件把上面这条 MCP 行加入 Harness，凭据由卡片提供。

## 工具

该端点提供 16 个工具，注册为 `mcp__stitch__*`：

| 工具 | 用途 |
| :-- | :-- |
| `list_projects` / `get_project` / `create_project` / `delete_project` | 项目 |
| `list_screens` / `get_screen` / `download_file` | 界面及其文件 |
| `generate_screen_from_text` / `edit_screens` / `generate_variants` | 生成与编辑 UI |
| `list_design_systems` / `create_design_system` / `create_design_system_from_design_md` / `update_design_system` / `apply_design_system` | 设计系统 |
| `upload_design_md` | 上传 DESIGN.md |

## 安装

```bash
dsh plugin --profile web add dsh-stitch-mcp@latest
```

如果 Harness 使用其他 profile 启动，请换成你自己的 profile 名。

## 凭据

设置 → 插件 → **Google Stitch** → 粘贴密钥 → **保存**。卡片包含两个标签页：

- **API Key** — 文档规定的形式，`X-Goog-Api-Key`。
- **OAuth** — `Authorization: Bearer <access token>`，可选地通过 `X-Goog-User-Project` 绑定到某个项目。

在 <https://stitch.withgoogle.com/settings> → **API key** → **Create key** 创建密钥。完整密钥只显示一次。OAuth 标签页接收 access token，例如 `gcloud auth print-access-token` 的输出。

值通过宿主 `credentials` 服务存储；Host 半部分把它们解析到 `~/.dsh/dsh-runtimes/stitch-mcp/config.json`，MCP 行在组装 `headers` 时读取该文件。因此，在卡片中保存会触发这一条目的重新加载，新凭据**无需重启 Harness** 即可生效。

## 端点与代理

**默认是直连，能访问 Google 的网络无需任何配置。**

卡片上的 **Use a proxy** 开关是唯一开关。打开后存储 `http://<ip>:<port>`，并**仅**将本插件的 Stitch 请求经其路由：Harness 中的其他一切——模型 API、网页搜索、其他 MCP 服务器——都保持原有路由。变更会在几秒内于运行中的进程内生效，因此无需重启，也不会写入 `~/.dsh/.env`。

关闭开关不存储任何内容，并将插件再次移出该路径：Stitch 随后直连，或遵循你自己为 Harness 导出的代理策略。

如果无法访问端点，不会伪造任何东西：MCP 行会报告其自身的传输错误，`~/.dsh/dsh-runtimes/stitch-mcp/status.json` 会说明哪里失败：

```json
{ "ok": false, "endpoint": "https://stitch.googleapis.com/mcp",
  "credential": "api-key", "proxy": null, "route": "direct", "reachable": false,
  "error": "UND_ERR_CONNECT_TIMEOUT", "checkedAt": "..." }
```

健康状态下类似：

```json
{ "ok": true, "endpoint": "https://stitch.googleapis.com/mcp",
  "credential": "api-key", "proxy": "http://127.0.0.1:7897", "route": "proxy",
  "reachable": true, "tools": 16, "checkedAt": "..." }
```

## 故障排查

| 现象 | 含义 |
| :-- | :-- |
| `server is disconnected` | 传输层完全无法访问 `stitch.googleapis.com`。`status.json` → `error` 会给出原因（`UND_ERR_CONNECT_TIMEOUT`、`fetch failed` 等）。为进程提供代理并重启。 |
| 工具已列出，调用时返回“Request is missing required authentication credential” | 尚未保存凭据——在卡片中粘贴 API Key。握手本身不需要密钥，因此工具会先出现。 |
| `status.json` 显示 `credential: null` | 卡片没有存储任何内容；宿主 `credentials` 服务不可达。 |
| 已开启代理但仍不可达 | 检查卡片中的地址，然后查看 `status.json` → `proxyError` / `error`。关闭代理会把 Stitch 交还给 Harness 策略。 |
| 开关已打开但 `status.json` 显示 `route: "direct"` | 该 profile 中无法解析 `undici`，因此开关保持无效；`proxyError` 会说明。重新安装插件。 |
| 重试多次后该行放弃 | MCP 客户端会永久停止重试；保存凭据会重新加载该条目，重启 Harness 也会重新启用它。 |

## 目录结构

| 文件 | 作用 |
| :-- | :-- |
| `cordis.patch.yml` | 插入 Host 条目和 `dsh-mcp-client` 行（直接 HTTPS 传输、凭据请求头、重连） |
| `index.js` | Host 半部分：解析凭据，维护 `config.json` / `status.json`，安装按来源的代理包装器，变更时重新加载该行 |
| `proxy.js` | 按来源分发包装器：仅路由 `stitch.googleapis.com`，且仅当卡片开关打开时 |
| `client.js` | 客户端半部分：`plugins.bundle.config` 中的凭据卡片，含 `I18N` 词典 |
| `locale/{en,zh}.json` | 各语言的插件标题和描述 |
| `CHANGELOG.md` | 发布历史 |
| `market/listing.json` | DSH 插件市场提交条目 |

## 许可证

MIT。
