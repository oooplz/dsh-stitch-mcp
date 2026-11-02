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
        title: 'Credentials',
        apiKey: 'API Key',
        token: 'OAuth access token',
        apiKeyHint: 'Required for Canvas resources: projects, screens, design systems.',
        tokenHint: 'Sign-in runs through the CLI, which owns the OAuth callback.',
        createKey: 'Create API Key',
        copyCommand: 'Copy login command',
        openSettings: 'Open settings',
        pasteKey: 'Paste API Key',
        replaceKey: 'Replace API Key',
        pasteToken: 'Paste access token',
        replaceToken: 'Replace access token',
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
        title: '凭据',
        apiKey: 'API Key',
        token: 'OAuth access token',
        apiKeyHint: 'Canvas 资源（项目 / 界面 / 设计系统）需要 API Key。',
        tokenHint: '登录由 CLI 完成，OAuth 回调由它接收。',
        createKey: '创建 API Key',
        copyCommand: '复制登录命令',
        openSettings: '打开设置页',
        pasteKey: '粘贴 API Key',
        replaceKey: '替换 API Key',
        pasteToken: '粘贴 access token',
        replaceToken: '替换 access token',
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
        padding: '14px 16px',
        border: BORDER,
        borderRadius: 10,
        fontSize: 13,
        color: 'inherit',
      },
      title: {
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
        marginBottom: 12,
      },
      group: { display: 'flex', flexDirection: 'column', gap: 6 },
      divider: {
        height: 1,
        background: 'var(--dsw-alias-border-l1)',
        opacity: 0.6,
        margin: '14px 0',
      },
      labelRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 18,
      },
      label: {
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.3,
        opacity: 0.9,
      },
      hint: {
        fontSize: 12,
        opacity: 0.55,
        lineHeight: 1.4,
      },
      statusDot: (on) => ({
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: on ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l1)',
        display: 'inline-block',
        marginRight: 5,
      }),
      status: {
        marginLeft: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 12,
        opacity: 0.75,
      },
      fieldRow: { display: 'flex', alignItems: 'center', gap: 8 },
      input: {
        flex: 1,
        minWidth: 0,
        height: 32,
        boxSizing: 'border-box',
        padding: '0 10px',
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        borderRadius: 6,
        border: BORDER,
        background: 'var(--dsw-alias-bg-l2)',
        color: 'inherit',
        outline: 'none',
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
        height: 32,
        padding: '0 2px',
        fontSize: 12,
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        opacity: 0.7,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        whiteSpace: 'nowrap',
      },
      actions: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 32 },
      ok: { fontSize: 12, marginTop: 10, color: 'var(--dsw-alias-state-business-primary)' },
      err: { fontSize: 12, marginTop: 10, color: '#d14343' },
      foot: { fontSize: 11, opacity: 0.45, marginTop: 10 },
    };

    function Field(props) {
      const { label, hint, value, onChange, onSave, onClear, configured, busy, t, placeholder, children } = props;
      return h(
        'div',
        { style: s.group },
        h(
          'div',
          { style: s.labelRow },
          h('span', { style: s.label }, label),
          h(
            'span',
            { style: s.status },
            h('span', { style: s.statusDot(configured) }),
            configured ? t.configured : t.notSet,
          ),
        ),
        h('div', { style: s.hint }, hint),
        h(
          'div',
          { style: s.fieldRow },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            'aria-label': label,
            placeholder,
            value,
            onChange: (e) => onChange(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') onSave();
            },
            style: s.input,
          }),
          h('button', { type: 'button', disabled: busy, onClick: onSave, style: s.btn(true) }, busy ? t.saving : t.save),
          configured
            ? h('button', { type: 'button', disabled: busy, onClick: onClear, style: s.btn(false) }, t.clear)
            : null,
        ),
        h('div', { style: s.actions }, children),
      );
    }

    function CredentialCard(props) {
      const creds = props.creds;
      const t = props.t;
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

      const save = (ref, value, setValue) => {
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
              setValue('');
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

      return h(
        'div',
        { 'data-stitch-credentials': true, style: s.card },
        h('div', { style: s.title }, t.title),
        h(
          Field,
          {
            label: t.apiKey,
            hint: t.apiKeyHint,
            value: keyValue,
            onChange: setKeyValue,
            onSave: () => save(REF_KEY, keyValue, setKeyValue),
            onClear: () => clear(REF_KEY),
            configured: state.key,
            busy: busy === REF_KEY,
            placeholder: state.key ? t.replaceKey : t.pasteKey,
            t,
          },
          h('button', { type: 'button', onClick: open, style: s.link }, t.createKey + ' \u2197'),
        ),
        h('div', { style: s.divider }),
        h(
          Field,
          {
            label: t.token,
            hint: t.tokenHint,
            value: tokenValue,
            onChange: setTokenValue,
            onSave: () => save(REF_TOKEN, tokenValue, setTokenValue),
            onClear: () => clear(REF_TOKEN),
            configured: state.token,
            busy: busy === REF_TOKEN,
            placeholder: state.token ? t.replaceToken : t.pasteToken,
            t,
          },
          h('button', { type: 'button', onClick: copyCommand, style: s.link }, t.copyCommand),
          h('span', { style: { fontSize: 12, opacity: 0.25 } }, '\u00b7'),
          h('button', { type: 'button', onClick: open, style: s.link }, t.openSettings),
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
