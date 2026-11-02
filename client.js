window.__ModuleLoader__.load({
  id: '@local/dsh-stitch-mcp',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = '@local/dsh-stitch-mcp';
    const REF_KEY = 'STITCH_API_KEY';
    const REF_TOKEN = 'STITCH_ACCESS_TOKEN';
    const STITCH_HOME = 'https://stitch.withgoogle.com';

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
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        padding: '7px 9px',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-l2)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      },
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

    function StitchCredentials(props) {
      const creds = props && props.creds;
      const [mode, setMode] = React.useState('api-key');
      const [apiKey, setApiKey] = React.useState('');
      const [token, setToken] = React.useState('');
      const [state, setState] = React.useState({ key: false, token: false });
      const [busy, setBusy] = React.useState(false);
      const [msg, setMsg] = React.useState(null);

      const readState = () => {
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
      };

      React.useEffect(() => {
        readState();
        return undefined;
      }, [creds]);

      const store = (ref, value, label) => {
        if (!creds || typeof creds.set !== 'function') {
          setMsg({ kind: 'err', text: '当前构建没有向插件暴露 credentials 服务，无法保存。' });
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
              readState();
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
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: label + ' 已清除。' });
              setState((prev) => ({
                key: ref === REF_KEY ? false : prev.key,
                token: ref === REF_TOKEN ? false : prev.token,
              }));
            } else {
              setMsg({ kind: 'err', text: (res && res.error && res.error.message) || '清除失败。' });
            }
          },
          (e) => {
            setBusy(false);
            setMsg({ kind: 'err', text: (e && e.message) || String(e) });
          },
        );
      };

      const openBrowser = () => {
        try {
          const w = window.open(STITCH_HOME, '_blank', 'noopener');
          setMsg(
            w
              ? { kind: 'ok', text: '已在新标签打开 Stitch。' }
              : { kind: 'err', text: '弹窗被拦截，请手动打开 ' + STITCH_HOME },
          );
        } catch (e) {
          setMsg({ kind: 'err', text: '打开失败：' + ((e && e.message) || String(e)) });
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
          'Canvas 资源（项目 / 界面 / 设计系统）需要它，与 Google 登录是两套凭据。密钥只写不读，保存后不会再显示。',
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
          '点按钮在浏览器里完成 Google 授权，把拿到的 access token 粘贴到下面保存；也可以先跑一次登录命令，CLI 会把令牌存在本地。',
        ),
        h('div', { style: s.row }, h('button', { type: 'button', onClick: openBrowser, style: s.btn(true) }, '打开浏览器授权')),
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
          { style: s.mono },
          'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login',
        ),
      );

      return h(
        'div',
        { 'data-stitch-credentials': true, style: s.card },
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
      // Only `slots` is a hard dependency: an unmet inject keeps a client plugin
      // inactive, so every optional service is read through ctx.get instead.
      inject: ['slots'],
      apply(ctx) {
        const get = (name) => (typeof ctx.get === 'function' ? ctx.get(name) : undefined);
        const remotes = get('remote');
        const creds = remotes && remotes.credentials;
        const view = () => h(StitchCredentials, { creds });

        // A settings page of its own: visible even when the bundle page's
        // configuration entry is not dispatched.
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'stitch', order: 60, label: 'Stitch' },
            view,
          ),
        );

        // The bundle's own configuration area on its plugin page.
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: NS }, view),
        );
      },
    };
  },
});
