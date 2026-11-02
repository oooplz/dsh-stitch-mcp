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

    // UI copy. A client half cannot import modules, so the dictionaries live here;
    // locale/*.json carries the plugin's meta title and description.
    const I18N = {
      en: {
        apiKeyTab: 'API Key',
        oauthTab: 'OAuth',
        pasteKey: 'Paste Google Stitch API Key',
        pasteToken: 'Paste Google Stitch AccessToken',
        replaceKey: 'Replace Google Stitch API Key',
        replaceToken: 'Replace Google Stitch AccessToken',
        createKey: 'Create API Key',
        copyCommand: 'Copy login command',
        openSettings: 'Open settings',
        save: 'Save',
        saving: 'Saving…',
        clear: 'Clear',
        configured: 'Configured',
        notSet: 'Not set',
        restart: 'Restart the harness to apply changes.',
        empty: 'Value is empty.',
        noService: 'The credentials service is unavailable.',
        saveFailed: 'Save failed.',
        clearFailed: 'Clear failed.',
        saved: 'Saved.',
        cleared: 'Cleared.',
        copied: 'Command copied.',
        copyFailed: 'Clipboard unavailable.',
        popupBlocked: 'Popup blocked.',
        opened: 'Settings opened.',
        openFailed: 'Could not open settings.',
      },
      zh: {
        apiKeyTab: 'API Key',
        oauthTab: 'OAuth',
        pasteKey: '粘贴 Google Stitch API Key',
        pasteToken: '粘贴 Google Stitch AccessToken',
        replaceKey: '替换 Google Stitch API Key',
        replaceToken: '替换 Google Stitch AccessToken',
        createKey: '创建 API Key',
        copyCommand: '复制登录命令',
        openSettings: '打开设置页',
        save: '保存',
        saving: '保存中…',
        clear: '清除',
        configured: '已配置',
        notSet: '未配置',
        restart: '重启 Harness 后生效。',
        empty: '内容为空。',
        noService: 'credentials 服务不可用。',
        saveFailed: '保存失败。',
        clearFailed: '清除失败。',
        saved: '已保存。',
        cleared: '已清除。',
        copied: '命令已复制。',
        copyFailed: '剪贴板不可用。',
        popupBlocked: '弹窗被拦截。',
        opened: '已打开设置页。',
        openFailed: '无法打开设置页。',
      },
    };

    const pickLocale = (ctx) => {
      try {
        const service = typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
        const active =
          service && typeof service.getSnapshot === 'function' ? service.getSnapshot().active : null;
        if (active === 'zh' || active === 'en') return active;
      } catch (e) {
        /* fall back to the browser language */
      }
      try {
        return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
      } catch (e) {
        return 'en';
      }
    };

    const BORDER = '1px solid var(--dsw-alias-border-l1)';

    const s = {
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        border: BORDER,
        borderRadius: 10,
        fontSize: 13,
        color: 'inherit',
      },
      tabsRow: { display: 'flex', alignItems: 'center', gap: 6 },
      tabs: {
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-l2)',
        border: BORDER,
      },
      tab: (active) => ({
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        borderRadius: 6,
        cursor: 'pointer',
        border: 'none',
        background: active ? 'var(--dsw-alias-bg-l1)' : 'transparent',
        color: 'inherit',
        opacity: active ? 1 : 0.7,
      }),
      status: {
        marginLeft: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        opacity: 0.7,
      },
      dot: (on) => ({
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: on ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l1)',
      }),
      row: { display: 'flex', alignItems: 'center', gap: 8 },
      input: {
        flex: 1,
        minWidth: 0,
        height: 32,
        boxSizing: 'border-box',
        padding: '0 10px',
        fontSize: 13,
        borderRadius: 6,
        border: BORDER,
        background: 'var(--dsw-alias-bg-l1)',
        color: 'inherit',
      },
      btn: (primary) => ({
        height: 32,
        boxSizing: 'border-box',
        padding: '0 14px',
        fontSize: 12,
        fontWeight: primary ? 600 : 400,
        borderRadius: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: primary ? '1px solid transparent' : BORDER,
        background: primary ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
        color: primary ? '#fff' : 'inherit',
      }),
      link: {
        padding: 0,
        fontSize: 12,
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        opacity: 0.65,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        whiteSpace: 'nowrap',
      },
      actions: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 18 },
      ok: { fontSize: 12, color: 'var(--dsw-alias-state-business-primary)' },
      err: { fontSize: 12, color: '#d14343' },
      foot: { fontSize: 11, opacity: 0.45 },
    };

    function CredentialCard(props) {
      const creds = props.creds;
      const t = props.t;
      const [tab, setTab] = React.useState('key');
      const [keyValue, setKeyValue] = React.useState('');
      const [tokenValue, setTokenValue] = React.useState('');
      const [state, setState] = React.useState({ key: false, token: false });
      const [busy, setBusy] = React.useState(null);
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

      const save = (ref, value, reset) => {
        if (!creds || typeof creds.set !== 'function') {
          setMsg({ kind: 'err', text: t.noService });
          return;
        }
        if (!value || !value.trim()) {
          setMsg({ kind: 'err', text: t.empty });
          return;
        }
        setBusy(ref);
        setMsg(null);
        creds.set(ref, value.trim()).then(
          (res) => {
            setBusy(null);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: t.saved });
              reset('');
              describe();
            } else {
              setMsg({ kind: 'err', text: (res && res.error && res.error.message) || t.saveFailed });
            }
          },
          (e) => {
            setBusy(null);
            setMsg({ kind: 'err', text: (e && e.message) || t.saveFailed });
          },
        );
      };

      const clear = (ref) => {
        if (!creds || typeof creds.unset !== 'function') return;
        setBusy(ref);
        creds.unset(ref).then(
          (res) => {
            setBusy(null);
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
            setBusy(null);
            setMsg({ kind: 'err', text: (e && e.message) || t.clearFailed });
          },
        );
      };

      const open = () => {
        try {
          const w = window.open(SETTINGS_URL, '_blank', 'noopener');
          setMsg(w ? { kind: 'ok', text: t.opened } : { kind: 'err', text: t.popupBlocked });
        } catch (e) {
          setMsg({ kind: 'err', text: t.openFailed });
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

      const isKey = tab === 'key';
      const ref = isKey ? REF_KEY : REF_TOKEN;
      const value = isKey ? keyValue : tokenValue;
      const setValue = isKey ? setKeyValue : setTokenValue;
      const configured = isKey ? state.key : state.token;

      return h(
        'div',
        { 'data-stitch-credentials': true, style: s.card },
        h(
          'div',
          { style: s.tabsRow },
          h(
            'div',
            { style: s.tabs, role: 'tablist' },
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                'aria-selected': isKey,
                style: s.tab(isKey),
                onClick: () => {
                  setTab('key');
                  setMsg(null);
                },
              },
              t.apiKeyTab,
            ),
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                'aria-selected': !isKey,
                style: s.tab(!isKey),
                onClick: () => {
                  setTab('oauth');
                  setMsg(null);
                },
              },
              t.oauthTab,
            ),
          ),
          h(
            'span',
            { style: s.status },
            h('span', { style: s.dot(configured) }),
            configured ? t.configured : t.notSet,
          ),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            'aria-label': isKey ? t.apiKeyTab : t.oauthTab,
            placeholder: configured
              ? isKey
                ? t.replaceKey
                : t.replaceToken
              : isKey
                ? t.pasteKey
                : t.pasteToken,
            value,
            onChange: (e) => setValue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') save(ref, value, setValue);
            },
            style: s.input,
          }),
          h(
            'button',
            { type: 'button', disabled: busy === ref, onClick: () => save(ref, value, setValue), style: s.btn(true) },
            busy === ref ? t.saving : t.save,
          ),
          configured
            ? h('button', { type: 'button', disabled: busy === ref, onClick: () => clear(ref), style: s.btn(false) }, t.clear)
            : null,
        ),
        h(
          'div',
          { style: s.actions },
          isKey
            ? h('button', { type: 'button', onClick: open, style: s.link }, t.createKey + ' \u2197')
            : h(
                React.Fragment,
                null,
                h('button', { type: 'button', onClick: copyCommand, style: s.link }, t.copyCommand),
                h('span', { style: { fontSize: 12, opacity: 0.25 } }, '\u00b7'),
                h('button', { type: 'button', onClick: open, style: s.link }, t.openSettings),
              ),
        ),
        msg ? h('div', { style: msg.kind === 'ok' ? s.ok : s.err }, msg.text) : null,
        h('div', { style: s.foot }, t.restart),
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
