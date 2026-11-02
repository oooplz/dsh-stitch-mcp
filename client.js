window.__ModuleLoader__.load({
  id: 'dsh-stitch-mcp',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-stitch-mcp';

    // Credential references, resolved by the Host `credentials` service. The Host
    // half reads them at activation and republishes them into process.env so the
    // MCP row's `!!js` expressions can hand them to the CLI.
    const REF_KEY = 'STITCH_API_KEY';
    const REF_TOKEN = 'STITCH_ACCESS_TOKEN';

    // Where a user creates an API key and manages their Stitch account.
    const STITCH_SETTINGS = 'https://stitch.withgoogle.com/settings';

    const s = {
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.5,
      },
      tabs: { display: 'flex', gap: 6 },
      tab: (active) => ({
        padding: '5px 12px',
        fontSize: 12,
        borderRadius: 999,
        cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: active ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
        color: active ? '#fff' : 'inherit',
      }),
      row: { display: 'flex', gap: 8, alignItems: 'center' },
      input: {
        flex: 1,
        minWidth: 0,
        padding: '6px 9px',
        fontSize: 12,
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-l2)',
        color: 'inherit',
      },
      btn: (primary) => ({
        padding: '5px 12px',
        fontSize: 12,
        borderRadius: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: primary ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-bg-l2)',
        color: primary ? '#fff' : 'inherit',
      }),
      hint: { fontSize: 12, opacity: 0.72 },
      ok: { fontSize: 12, color: 'var(--dsw-alias-state-business-primary)' },
      err: { fontSize: 12, color: '#d14343' },
      badge: (on) => ({
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 999,
        fontSize: 11,
        marginLeft: 6,
        background: on ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-bg-l2)',
        color: on ? '#fff' : 'inherit',
        border: '1px solid var(--dsw-alias-border-l1)',
      }),
    };

    function AuthCard(props) {
      // Accessing an undeclared service property throws in Cordis, so `remote.credentials`
      // is declared in the plugin's inject list and read defensively here.
      let creds;
      try {
        creds = props.creds;
      } catch (e) {
        creds = undefined;
      }
      const [mode, setMode] = React.useState('api-key');
      const [apiKey, setApiKey] = React.useState('');
      const [token, setToken] = React.useState('');
      const [state, setState] = React.useState({ key: false, token: false });
      const [busy, setBusy] = React.useState(false);
      const [msg, setMsg] = React.useState(null);

      const refresh = React.useCallback(() => {
        if (!creds || typeof creds.describe !== 'function') return;
        creds.describe([REF_KEY, REF_TOKEN]).then(
          (res) => {
            if (!res || res.ok !== true) return;
            const v = res.value || {};
            setState({
              key: Boolean(v[REF_KEY] && v[REF_KEY].configured === true),
              token: Boolean(v[REF_TOKEN] && v[REF_TOKEN].configured === true),
            });
          },
          () => {},
        );
      }, [creds]);

      React.useEffect(() => {
        refresh();
      }, [refresh]);

      // Always render the actionable card; `compact` only trims padding when the
      // owner renders the same entry as a one-line summary.
      const compact = Boolean(props && props.compact);

      const store = (ref, value, label) => {
        if (!creds || typeof creds.set !== 'function') {
          setMsg({ kind: 'err', text: '当前构建没有暴露 credentials 服务，无法保存。' });
          return;
        }
        if (!value || value.trim().length === 0) {
          setMsg({ kind: 'err', text: '内容为空，未保存。' });
          return;
        }
        setBusy(true);
        setMsg(null);
        creds.set(ref, value.trim()).then(
          (res) => {
            setBusy(false);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: label + ' 已保存。重启 Harness 后生效。' });
              if (ref === REF_KEY) setApiKey('');
              else setToken('');
              refresh();
            } else {
              setMsg({ kind: 'err', text: (res && res.error && res.error.message) || '保存失败。' });
            }
          },
          (e) => {
            setBusy(false);
            setMsg({ kind: 'err', text: (e && e.message) || String(e) });
          },
        );
      };

      const clear = (ref, label) => {
        if (!creds || typeof creds.unset !== 'function') return;
        setBusy(true);
        creds.unset(ref).then(
          (res) => {
            setBusy(false);
            setMsg(
              res && res.ok === true
                ? { kind: 'ok', text: label + ' 已清除。' }
                : { kind: 'err', text: (res && res.error && res.error.message) || '清除失败。' },
            );
            refresh();
          },
          (e) => {
            setBusy(false);
            setMsg({ kind: 'err', text: (e && e.message) || String(e) });
          },
        );
      };

      const openUrl = (url, okText) => {
        try {
          const w = window.open(url, '_blank', 'noopener');
          if (!w) setMsg({ kind: 'err', text: '浏览器拦截了弹窗，请手动打开 ' + url });
          else setMsg({ kind: 'ok', text: okText });
        } catch (e) {
          setMsg({ kind: 'err', text: '打开失败：' + ((e && e.message) || String(e)) });
        }
      };

      const LOGIN_COMMAND =
        'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login';

      const copyLogin = () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(LOGIN_COMMAND).then(
              () => setMsg({ kind: 'ok', text: '登录命令已复制，粘贴到终端执行即可。' }),
              () => setMsg({ kind: 'err', text: '剪贴板不可用，请手动复制命令。' }),
            );
          } else {
            setMsg({ kind: 'err', text: '剪贴板不可用，请手动复制命令。' });
          }
        } catch (e) {
          setMsg({ kind: 'err', text: (e && e.message) || String(e) });
        }
      };

      const apiKeyPane = h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h(
          'div',
          { style: { fontWeight: 600 } },
          'API Key',
          h('span', { style: s.badge(state.key) }, state.key ? '已配置' : '未配置'),
        ),
        h(
          'div',
          { style: s.hint },
          'Canvas 资源（项目 / 界面 / 设计系统）需要它；与 Google 登录是两套凭据。',
        ),
        h(
          'div',
          { style: { ...s.hint, whiteSpace: 'pre-line' } },
          '获取步骤（Stitch 设置页为英文界面）：\n' +
            '1. 点下方按钮打开设置页\n' +
            '2. 找到「API key」区块，点右侧「Create key」\n' +
            '3. 复制生成的密钥（完整密钥只在创建时显示一次）\n' +
            '4. 粘贴到下面的输入框并点「保存」',
        ),
        h(
          'div',
          { style: s.row },
          h(
            'button',
            {
              type: 'button',
              onClick: () =>
                openUrl(
                  STITCH_SETTINGS,
                  '已打开 Stitch 设置页：在「API key」区块点「Create key」，复制后粘贴回上面的输入框。',
                ),
            },
            '打开设置页创建 API Key',
          ),
          h('span', { style: s.hint }, 'API key → Create key'),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            placeholder: state.key ? '已保存；输入新值可覆盖' : '粘贴 API Key',
            value: apiKey,
            onChange: (e) => setApiKey(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') store(REF_KEY, apiKey, 'API Key');
            },
            style: s.input,
            'aria-label': 'Stitch API Key',
          }),
          h(
            'button',
            {
              type: 'button',
              disabled: busy,
              onClick: () => store(REF_KEY, apiKey, 'API Key'),
              style: s.btn(true),
            },
            busy ? '保存中…' : '保存',
          ),
          state.key
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: () => clear(REF_KEY, 'API Key'),
                  style: s.btn(false),
                },
                '清除',
              )
            : null,
        ),
      );

      const oauthPane = h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h(
          'div',
          { style: { fontWeight: 600 } },
          'OAuth',
          h('span', { style: s.badge(state.token) }, state.token ? '已配置' : '未配置'),
        ),
        h(
          'div',
          { style: s.hint },
          'Google 登录必须由 CLI 完成：授权回调落在 CLI 在本机起的监听端口上，单开一个浏览器标签授权完成后拿不到 token（会回到首页）。请用下面的登录命令，浏览器会自动弹出并回调，CLI 把令牌存在本地。',
        ),
        h(
          'div',
          { style: s.row },
          h('button', { type: 'button', onClick: copyLogin, style: s.btn(true) }, '复制登录命令'),
          h(
            'button',
            {
              type: 'button',
              onClick: () => openUrl(STITCH_SETTINGS, '已打开 Stitch 设置页。'),
              style: s.btn(false),
            },
            '打开 Stitch 设置页',
          ),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            placeholder: state.token ? '已保存；输入新值可覆盖' : '粘贴 STITCH_ACCESS_TOKEN',
            value: token,
            onChange: (e) => setToken(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') store(REF_TOKEN, token, 'Access Token');
            },
            style: s.input,
            'aria-label': 'Stitch access token',
          }),
          h(
            'button',
            {
              type: 'button',
              disabled: busy,
              onClick: () => store(REF_TOKEN, token, 'Access Token'),
              style: s.btn(true),
            },
            '保存',
          ),
          state.token
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: () => clear(REF_TOKEN, 'Access Token'),
                  style: s.btn(false),
                },
                '清除',
              )
            : null,
        ),
        h(
          'div',
          {
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              padding: '7px 9px',
              borderRadius: 6,
              background: 'var(--dsw-alias-bg-l2)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            },
          },
          'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login',
        ),
      );

      return h(
        'div',
        { 'data-stitch-auth': true, style: compact ? { ...s.card, padding: '10px 12px', gap: 8 } : s.card },
        h('div', { style: { fontWeight: 600 } }, 'Stitch 凭据'),
        h(
          'div',
          { style: s.tabs },
          h(
            'button',
            { type: 'button', style: s.tab(mode === 'api-key'), onClick: () => setMode('api-key') },
            'API Key',
          ),
          h('button', { type: 'button', style: s.tab(mode === 'oauth'), onClick: () => setMode('oauth') }, 'OAuth'),
        ),
        mode === 'api-key' ? apiKeyPane : oauthPane,
        msg ? h('div', { style: msg.kind === 'ok' ? s.ok : s.err, role: 'status' }, msg.text) : null,
        h('div', { style: s.hint }, '改完凭据需要重启 Harness，MCP 进程才会带着新凭据重启。'),
      );
    }

    return {
      // `remote.credentials` must be declared: Cordis throws
      // "cannot get property ... without inject" on undeclared service access.
      inject: ['slots', 'remote', 'remote.credentials'],
      apply(ctx) {
        const creds = ctx.remote.credentials;

        // The bundle's own configuration area, rendered between the bundle
        // description and its component rows. Keyed by the bundle package name.
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: NS }, (props) =>
            h(AuthCard, { creds, compact: props && props.view === 'summary' }),
          ),
        );
      },
    };
  },
});
