window.__ModuleLoader__.load({
  id: '@local/dsh-stitch-mcp',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = '@local/dsh-stitch-mcp';

    // The two credential paths the official Stitch CLI accepts. `stitch login`
    // stores OAuth tokens in the CLI's own store and refreshes them; the API key
    // is required in addition for Canvas resources (projects/screens/design systems).
    const MODES = {
      'api-key': {
        title: 'API Key',
        body: 'Canvas 资源（项目 / 界面 / 设计系统）需要 API Key；它与 Google 登录是两套凭据。',
        command: 'export STITCH_API_KEY=your-api-key',
      },
      oauth: {
        title: 'OAuth（stitch login）',
        body: '浏览器完成 Google 登录，令牌由 CLI 本地保存并自动刷新；工作区 / 洞察 / 解决方案可用，Canvas 仍需 API Key。',
        command:
          'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login',
      },
    };

    function useCopy() {
      const [copied, setCopied] = React.useState(null);
      const copy = (text, key) => {
        const done = () => {
          setCopied(key);
          setTimeout(() => setCopied(null), 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, () => setCopied('failed'));
        } else {
          setCopied('failed');
        }
      };
      return [copied, copy];
    }

    function AuthGuide() {
      const [mode, setMode] = React.useState('api-key');
      const [copied, copy] = useCopy();
      const t = MODES[mode];

      const card = (key, label, note) => {
        const active = mode === key;
        return h(
          'label',
          {
            key,
            style: {
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              border: '1px solid ' + (active ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l1)'),
              background: active ? 'var(--dsw-alias-bg-l2)' : 'transparent',
            },
          },
          h('input', {
            type: 'radio',
            name: 'stitch-auth-mode',
            checked: active,
            onChange: () => setMode(key),
            style: { marginTop: 3 },
          }),
          h(
            'span',
            null,
            h('strong', { style: { display: 'block', fontSize: 13 } }, label),
            h(
              'span',
              { style: { display: 'block', fontSize: 12, opacity: 0.75, marginTop: 2 } },
              note,
            ),
          ),
        );
      };

      return h(
        'div',
        {
          'data-stitch-auth-guide': true,
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.5,
          },
        },
        h('div', { style: { fontWeight: 600 } }, 'Stitch 凭据方式'),
        h(
          'div',
          { style: { opacity: 0.75, fontSize: 12 } },
          '两种方式可叠加使用。当前版本请在下方选择方式，并按提示在启动 Harness 之前设置。',
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          card('api-key', MODES['api-key'].title, '长期有效，适合自动化与本机常驻'),
          card('oauth', MODES.oauth.title, '无需手动管令牌，但需要浏览器交互'),
        ),
        h(
          'div',
          {
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--dsw-alias-bg-l2)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            },
          },
          t.command,
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h(
            'button',
            {
              type: 'button',
              onClick: () => copy(t.command, mode),
              style: {
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-l2)',
                cursor: 'pointer',
                color: 'inherit',
              },
            },
            copied === mode ? '已复制' : '复制命令',
          ),
          copied === 'failed'
            ? h('span', { style: { fontSize: 12, opacity: 0.7 } }, '剪贴板不可用，请手动选择')
            : null,
        ),
        h('div', { style: { fontSize: 12, opacity: 0.75 } }, t.body),
        h(
          'div',
          { style: { fontSize: 12, opacity: 0.75 } },
          '改完凭据需要重启 Harness 才会重新拉起 MCP 进程。',
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register(
            { name: 'plugins.bundle.config', key: NS, locale: NS },
            AuthGuide,
          ),
        );
      },
    };
  },
});
