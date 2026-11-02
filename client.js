window.__ModuleLoader__.load({
  id: 'dsh-stitch-mcp',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-stitch-mcp';
    const REF_KEY = 'STITCH_API_KEY';
    const REF_TOKEN = 'STITCH_ACCESS_TOKEN';
    const SETTINGS_URL = 'https://stitch.withgoogle.com/settings';
    const LOGIN_COMMAND =
      'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login';

    // UI copy. Kept next to the component because a client half cannot import
    // modules; locale/*.json carries the plugin's meta title and description.
    const I18N = {
      en: {
        title: 'Credentials',
        apiKeyTab: 'API Key',
        oauthTab: 'OAuth',
        configured: 'configured',
        missing: 'not set',
        apiKeyHint: 'Canvas resources require an API key.',
        createKey: 'Create key',
        apiKeyPlaceholder: 'Paste API key',
        replacePlaceholder: 'Replace key',
        oauthHint: 'Sign-in runs through the CLI; it owns the callback.',
        copyCommand: 'Copy login command',
        openSettings: 'Settings',
        tokenPlaceholder: 'Paste access token',
        replaceToken: 'Replace access token',
        save: 'Save',
        saving: 'Saving',
        clear: 'Clear',
        restartNote: 'Restart the harness to apply.',
        emptyRejected: 'Value is empty.',
        noService: 'credentials service unavailable.',
        saveFailed: 'Save failed.',
        clearFailed: 'Clear failed.',
        cleared: 'Cleared.',
        saved: 'Saved.',
        copied: 'Command copied.',
        copyFailed: 'Clipboard unavailable.',
        popupBlocked: 'Popup blocked: ',
        openedSettings: 'Settings opened.',
        openFailed: 'Could not open: ',
      },
      zh: {
        title: '凭据',
        apiKeyTab: 'API Key',
        oauthTab: 'OAuth',
        configured: '已配置',
        missing: '未配置',
        apiKeyHint: 'Canvas 资源需要 API Key。',
        createKey: '创建 Key',
        apiKeyPlaceholder: '粘贴 API Key',
        replacePlaceholder: '替换 Key',
        oauthHint: '登录由 CLI 完成，回调在它自己的本地端口。',
        copyCommand: '复制登录命令',
        openSettings: '设置页',
        tokenPlaceholder: '粘贴 access token',
        replaceToken: '替换 access token',
        save: '保存',
        saving: '保存中',
        clear: '清除',
        restartNote: '重启 Harness 生效。',
        emptyRejected: '内容为空。',
        noService: 'credentials 服务不可用。',
        saveFailed: '保存失败。',
        clearFailed: '清除失败。',
        cleared: '已清除。',
        saved: '已保存。',
        copied: '命令已复制。',
        copyFailed: '剪贴板不可用。',
        popupBlocked: '弹窗被拦截：',
        openedSettings: '已打开设置页。',
        openFailed: '打开失败：',
      },
    };

    const pickLocale = (ctx) => {
      try {
        const service = typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
        const active =
          service && typeof service.getSnapshot === 'function' ? service.getSnapshot().active : null;
        if (active === 'zh' || active === 'en') return active;
      } catch (e) {
        /* fall through to the browser language */
      }
      try {
        return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
      } catch (e) {
        return 'en';
      }
    };

    const s = {
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        fontSize: 13,
      },
      head: { display: 'flex', alignItems: 'center', gap: 8 },
      tabs: { display: 'flex', gap: 4 },
      tab: (active) => ({
        padding: '3px 10px',
        fontSize: 12,
        borderRadius: 999,
        cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: active ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
        color: active ? '#fff' : 'inherit',
      }),
      row: { display: 'flex', gap: 6, alignItems: 'center' },
      input: {
        flex: 1,
        minWidth: 0,
        padding: '5px 8px',
        fontSize: 12,
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-l2)',
        color: 'inherit',
      },
      btn: (primary) => ({
        padding: '4px 10px',
        fontSize: 12,
        borderRadius: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: primary ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-bg-l2)',
        color: primary ? '#fff' : 'inherit',
      }),
      hint: { fontSize: 12, opacity: 0.65 },
      ok: { fontSize: 12, color: 'var(--dsw-alias-state-business-primary)' },
      err: { fontSize: 12, color: '#d14343' },
      badge: (on) => ({
        padding: '0 6px',
        borderRadius: 999,
        fontSize: 11,
        background: on ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
        color: on ? '#fff' : 'inherit',
        border: '1px solid var(--dsw-alias-border-l1)',
      }),
    };

    function CredentialCard(props) {
      const creds = props.creds;
      const t = props.t;
      const [tab, setTab] = React.useState('key');
      const [keyValue, setKeyValue] = React.useState('');
      const [tokenValue, setTokenValue] = React.useState('');
      const [state, setState] = React.useState({ key: false, token: false });
      const [busy, setBusy] = React.useState(false);
      const [msg, setMsg] = React.useState(null);

      const describe = () => {
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
        describe();
        return undefined;
      }, [creds]);

      const save = (ref, value) => {
        if (!creds || typeof creds.set !== 'function') {
          setMsg({ kind: 'err', text: t.noService });
          return;
        }
        if (!value || !value.trim()) {
          setMsg({ kind: 'err', text: t.emptyRejected });
          return;
        }
        setBusy(true);
        setMsg(null);
        creds.set(ref, value.trim()).then(
          (res) => {
            setBusy(false);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: t.saved });
              if (ref === REF_KEY) setKeyValue('');
              else setTokenValue('');
              describe();
            } else {
              setMsg({ kind: 'err', text: (res && res.error && res.error.message) || t.saveFailed });
            }
          },
          (e) => {
            setBusy(false);
            setMsg({ kind: 'err', text: (e && e.message) || t.saveFailed });
          },
        );
      };

      const clear = (ref) => {
        if (!creds || typeof creds.unset !== 'function') return;
        setBusy(true);
        creds.unset(ref).then(
          (res) => {
            setBusy(false);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: t.cleared });
              setState((prev) => ({
                key: ref === REF_KEY ? false : prev.key,
                token: ref === REF_TOKEN ? false : prev.token,
              }));
            } else {
              setMsg({ kind: 'err', text: (res && res.error && res.error.message) || t.clearFailed });
            }
          },
          (e) => {
            setBusy(false);
            setMsg({ kind: 'err', text: (e && e.message) || t.clearFailed });
          },
        );
      };

      const open = (url, okText) => {
        try {
          const w = window.open(url, '_blank', 'noopener');
          setMsg(w ? { kind: 'ok', text: okText } : { kind: 'err', text: t.popupBlocked + url });
        } catch (e) {
          setMsg({ kind: 'err', text: t.openFailed + ((e && e.message) || String(e)) });
        }
      };

      const copyCommand = () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) {
            setMsg({ kind: 'err', text: t.copyFailed });
            return;
          }
          navigator.clipboard.writeText(LOGIN_COMMAND).then(
            () => setMsg({ kind: 'ok', text: t.copied }),
            () => setMsg({ kind: 'err', text: t.copyFailed }),
          );
        } catch (e) {
          setMsg({ kind: 'err', text: t.copyFailed });
        }
      };

      const field = (ref, value, setValue, placeholder, configured) =>
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            placeholder,
            value,
            onChange: (e) => setValue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') save(ref, value);
            },
            style: s.input,
          }),
          h(
            'button',
            { type: 'button', disabled: busy, onClick: () => save(ref, value), style: s.btn(true) },
            busy ? t.saving : t.save,
          ),
          configured
            ? h(
                'button',
                { type: 'button', disabled: busy, onClick: () => clear(ref), style: s.btn(false) },
                t.clear,
              )
            : null,
        );

      const status = (on) => h('span', { style: s.badge(on) }, on ? t.configured : t.missing);

      return h(
        'div',
        { 'data-stitch-credentials': true, style: s.card },
        h(
          'div',
          { style: s.head },
          h('span', { style: { fontWeight: 600 } }, t.title),
          h(
            'div',
            { style: { ...s.tabs, marginLeft: 'auto' } },
            h(
              'button',
              { type: 'button', style: s.tab(tab === 'key'), onClick: () => setTab('key') },
              t.apiKeyTab,
            ),
            h(
              'button',
              { type: 'button', style: s.tab(tab === 'oauth'), onClick: () => setTab('oauth') },
              t.oauthTab,
            ),
          ),
        ),
        tab === 'key'
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h(
                'div',
                { style: s.row },
                h('span', { style: s.hint }, t.apiKeyHint),
                status(state.key),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => open(SETTINGS_URL, t.openedSettings),
                    style: { ...s.btn(false), marginLeft: 'auto' },
                  },
                  t.createKey + ' \u2197',
                ),
              ),
              field(
                REF_KEY,
                keyValue,
                setKeyValue,
                state.key ? t.replacePlaceholder : t.apiKeyPlaceholder,
                state.key,
              ),
            )
          : h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h(
                'div',
                { style: s.row },
                h('span', { style: s.hint }, t.oauthHint),
                status(state.token),
                h(
                  'button',
                  { type: 'button', onClick: copyCommand, style: { ...s.btn(false), marginLeft: 'auto' } },
                  t.copyCommand,
                ),
                h(
                  'button',
                  { type: 'button', onClick: () => open(SETTINGS_URL, t.openedSettings), style: s.btn(false) },
                  t.openSettings,
                ),
              ),
              field(
                REF_TOKEN,
                tokenValue,
                setTokenValue,
                state.token ? t.replaceToken : t.tokenPlaceholder,
                state.token,
              ),
            ),
        msg ? h('div', { style: msg.kind === 'ok' ? s.ok : s.err }, msg.text) : null,
        h('div', { style: s.hint }, t.restartNote),
      );
    }

    return {
      // `remote.credentials` must be declared: Cordis rejects undeclared service access.
      inject: ['slots', 'remote', 'remote.credentials'],
      apply(ctx) {
        const creds = ctx.remote.credentials;
        const dict = I18N[pickLocale(ctx)] || I18N.en;

        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: NS }, () =>
            h(CredentialCard, { creds, t: dict }),
          ),
        );
      },
    };
  },
});
