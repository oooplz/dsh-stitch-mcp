window.__ModuleLoader__.load({
  id: 'dsh-stitch-mcp',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-stitch-mcp';
    const REF_KEY = 'STITCH_API_KEY';
    const REF_TOKEN = 'STITCH_ACCESS_TOKEN';
    const REF_PROXY = 'STITCH_HTTPS_PROXY';
    const SETTINGS_URL = 'https://stitch.withgoogle.com/settings';
    const LOGIN_COMMAND =
      'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login';

    // UI copy. A client half cannot import modules, so the dictionaries live here;
    // locale/*.json carries the plugin's meta title and description.
    const I18N = {
      en: {
        apiKeyTab: 'API Key',
        oauthTab: 'OAuth',
        proxyTab: 'Proxy',
        pasteKey: 'Paste API Key',
        pasteToken: 'Paste AccessToken',
        pasteProxy: 'Enter a local proxy, e.g. http://127.0.0.1:7897',
        replaceKey: 'Replace API Key',
        replaceToken: 'Replace AccessToken',
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
        proxyTab: '代理',
        pasteKey: '粘贴 API Key',
        pasteToken: '粘贴 AccessToken',
        pasteProxy: '请输入本机代理，如 http://127.0.0.1:7897',
        replaceKey: '替换 API Key',
        replaceToken: '替换 AccessToken',
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
      const [values, setValues] = React.useState({ key: '', token: '', proxy: '' });
      const [state, setState] = React.useState({ key: false, token: false, proxy: false });
      const [busy, setBusy] = React.useState(null);
      const [msg, setMsg] = React.useState(null);

      const describe = () => {
        if (!creds || typeof creds.describe !== 'function') return;
        creds.describe([REF_KEY, REF_TOKEN, REF_PROXY]).then(
          (res) => {
            if (!res || res.ok !== true) return;
            const v = res.value || {};
            setState({
              key: Boolean(v[REF_KEY] && v[REF_KEY].configured === true),
              token: Boolean(v[REF_TOKEN] && v[REF_TOKEN].configured === true),
              proxy: Boolean(v[REF_PROXY] && v[REF_PROXY].configured === true),
            });
          },
          () => {},
        );
      };

      React.useEffect(() => {
        describe();
        return undefined;
      }, [creds]);

      const save = (ref, slot, value) => {
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
              setValues((prev) => ({ ...prev, [slot]: '' }));
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

      const clear = (ref, slot) => {
        if (!creds || typeof creds.unset !== 'function') return;
        setBusy(ref);
        creds.unset(ref).then(
          (res) => {
            setBusy(null);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: t.cleared });
              setState((prev) => ({ ...prev, [slot]: false }));
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

      const TABS = [
        { id: 'key', label: t.apiKeyTab, ref: REF_KEY },
        { id: 'oauth', label: t.oauthTab, ref: REF_TOKEN },
        { id: 'proxy', label: t.proxyTab, ref: REF_PROXY },
      ];
      const current = TABS.find((x) => x.id === tab) || TABS[0];
      const value = values[current.id];
      const configured = state[current.id];

      const placeholder =
        current.id === 'proxy'
          ? t.pasteProxy
          : configured
            ? { key: t.replaceKey, oauth: t.replaceToken }[current.id]
            : { key: t.pasteKey, oauth: t.pasteToken }[current.id];

      return h(
        'div',
        { 'data-stitch-credentials': true, style: s.card },
        h(
          'div',
          { style: s.tabsRow },
          h(
            'div',
            { style: s.tabs, role: 'tablist' },
            TABS.map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab === item.id,
                  style: s.tab(tab === item.id),
                  onClick: () => {
                    setTab(item.id);
                    setMsg(null);
                  },
                },
                item.label,
              ),
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
            type: current.id === 'proxy' ? 'text' : 'password',
            autoComplete: 'off',
            spellCheck: false,
            'aria-label': current.label,
            placeholder,
            value,
            onChange: (e) => setValues((prev) => ({ ...prev, [current.id]: e.target.value })),
            onKeyDown: (e) => {
              if (e.key === 'Enter') save(current.ref, current.id, value);
            },
            style: s.input,
          }),
          h(
            'button',
            {
              type: 'button',
              disabled: busy === current.ref,
              onClick: () => save(current.ref, current.id, value),
              style: s.btn(true),
            },
            busy === current.ref ? t.saving : t.save,
          ),
          configured
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: busy === current.ref,
                  onClick: () => clear(current.ref, current.id),
                  style: s.btn(false),
                },
                t.clear,
              )
            : null,
        ),
        h(
          'div',
          { style: s.actions },
          current.id === 'key'
            ? h('button', { type: 'button', onClick: open, style: s.link }, t.createKey + ' \u2197')
            : current.id === 'oauth'
              ? h(
                  React.Fragment,
                  null,
                  h('button', { type: 'button', onClick: copyCommand, style: s.link }, t.copyCommand),
                  h('span', { style: { fontSize: 12, opacity: 0.25 } }, '\u00b7'),
                  h('button', { type: 'button', onClick: open, style: s.link }, t.openSettings),
                )
              : null,
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
