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
    // The OAuth tab takes an access token; this is how a Google Cloud user gets one.
    const TOKEN_COMMAND = 'gcloud auth print-access-token';
    const DEFAULT_HOST = '127.0.0.1';
    const DEFAULT_PORT = '7897';

    // UI copy. A client half cannot import modules, so the dictionaries live here;
    // locale/*.json carries the plugin's meta title and description.
    const I18N = {
      en: {
        apiKeyTab: 'API Key',
        oauthTab: 'OAuth',
        proxyTitle: 'Proxy server',
        proxyUse: 'Use a proxy',
        proxyOn: 'On',
        proxyOff: 'Off',
        proxyHint: 'Off: direct, no configuration needed. On: this address is written to ~/.dsh/.env as HTTPS_PROXY for the whole harness.',
        hostLabel: 'Proxy IP address',
        portLabel: 'Port',
        pasteKey: 'Paste API Key',
        pasteToken: 'Paste AccessToken',
        replaceKey: 'Replace API Key',
        replaceToken: 'Replace AccessToken',
        createKey: 'Create API Key',
        copyCommand: 'Copy token command',
        openSettings: 'Open settings',
        save: 'Save',
        saving: 'Saving…',
        clear: 'Clear',
        configured: 'Configured',
        notSet: 'Not set',
        restart: 'A saved credential reloads the connection on its own; a proxy applies after restarting the harness.',
        empty: 'Value is empty.',
        proxyRequired: 'Host and port are required.',
        portInvalid: 'Port must be a number between 1 and 65535.',
        noService: 'The credentials service is unavailable.',
        saveFailed: 'Save failed.',
        clearFailed: 'Clear failed.',
        saved: 'Saved — the connection reloads on its own.',
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
        proxyTitle: '代理服务器',
        proxyUse: '使用代理服务器',
        proxyOn: '开',
        proxyOff: '关',
        proxyHint: '关：直连，不需要任何配置。开：该地址会写入 ~/.dsh/.env 的 HTTPS_PROXY，对整个 Harness 生效。',
        hostLabel: '代理 IP 地址',
        portLabel: '端口',
        pasteKey: '粘贴 API Key',
        pasteToken: '粘贴 AccessToken',
        replaceKey: '替换 API Key',
        replaceToken: '替换 AccessToken',
        createKey: '创建 API Key',
        copyCommand: '复制取令牌命令',
        openSettings: '打开设置页',
        save: '保存',
        saving: '保存中…',
        clear: '清除',
        configured: '已配置',
        notSet: '未配置',
        restart: '凭据保存后自动重载连接；代理需重启 Harness 后生效。',
        empty: '内容为空。',
        proxyRequired: '服务器和端口都不能为空。',
        portInvalid: '端口需为 1–65535 的数字。',
        noService: 'credentials 服务不可用。',
        saveFailed: '保存失败。',
        clearFailed: '清除失败。',
        saved: '已保存，连接会自动重载。',
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
      numInput: {
        width: 96,
        flex: '0 0 auto',
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
      divider: { height: 1, background: 'var(--dsw-alias-border-l1)', opacity: 0.6 },
      sectionTitle: { fontSize: 12, fontWeight: 600, opacity: 0.9 },
      fieldLabel: { fontSize: 11, opacity: 0.6, marginBottom: 4, display: 'block' },
      ok: { fontSize: 12, color: 'var(--dsw-alias-state-business-primary)' },
      err: { fontSize: 12, color: '#d14343' },
      hint: { fontSize: 11, opacity: 0.5, lineHeight: 1.4 },
      foot: { fontSize: 11, opacity: 0.45 },
    };

    function Switch(props) {
      const on = props.on;
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': on,
          'aria-label': props.label,
          onClick: props.onToggle,
          style: {
            width: 36,
            height: 20,
            flex: '0 0 auto',
            borderRadius: 999,
            border: 'none',
            padding: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: on ? 'flex-end' : 'flex-start',
            background: on ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l1)',
            transition: 'background 120ms ease',
          },
        },
        h('span', {
          style: {
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          },
        }),
      );
    }

    function CredentialCard(props) {
      const creds = props.creds;
      const t = props.t;
      const [tab, setTab] = React.useState('key');
      const [values, setValues] = React.useState({ key: '', oauth: '' });
      const [state, setState] = React.useState({ key: false, oauth: false, proxy: false });
      const [proxyOn, setProxyOn] = React.useState(false);
      const [host, setHost] = React.useState(DEFAULT_HOST);
      const [port, setPort] = React.useState(DEFAULT_PORT);
      const [busy, setBusy] = React.useState(null);
      const [msg, setMsg] = React.useState(null);

      const describe = () => {
        if (!creds || typeof creds.describe !== 'function') return;
        creds.describe([REF_KEY, REF_TOKEN, REF_PROXY]).then(
          (res) => {
            if (!res || res.ok !== true) return;
            const v = res.value || {};
            const configured = (ref) => Boolean(v[ref] && v[ref].configured === true);
            setState({ key: configured(REF_KEY), oauth: configured(REF_TOKEN), proxy: configured(REF_PROXY) });
            setProxyOn(configured(REF_PROXY));
          },
          () => {},
        );
      };

      React.useEffect(() => {
        describe();
        return undefined;
      }, [creds]);

      const write = (ref, slot, value, okText) => {
        if (!creds || typeof creds.set !== 'function') {
          setMsg({ kind: 'err', text: t.noService });
          return;
        }
        setBusy(slot);
        setMsg(null);
        creds.set(ref, value).then(
          (res) => {
            setBusy(null);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: okText });
              if (slot === 'proxy') setProxyOn(true);
              else setValues((prev) => ({ ...prev, [slot]: '' }));
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

      const saveField = (ref, slot, value) => {
        if (!value || !value.trim()) {
          setMsg({ kind: 'err', text: t.empty });
          return;
        }
        write(ref, slot, value.trim(), t.saved);
      };

      const clearField = (ref, slot) => {
        if (!creds || typeof creds.unset !== 'function') return;
        setBusy(slot);
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

      const saveProxy = () => {
        const h1 = host.trim();
        const p1 = port.trim();
        if (!h1 || !p1) {
          setMsg({ kind: 'err', text: t.proxyRequired });
          return;
        }
        if (!/^\d+$/.test(p1) || Number(p1) < 1 || Number(p1) > 65535) {
          setMsg({ kind: 'err', text: t.portInvalid });
          return;
        }
        write(REF_PROXY, 'proxy', 'http://' + h1 + ':' + p1, t.saved);
      };

      const toggleProxy = () => {
        if (proxyOn) {
          setProxyOn(false);
          clearField(REF_PROXY, 'proxy');
        } else {
          setProxyOn(true);
          setMsg(null);
        }
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
          navigator.clipboard.writeText(TOKEN_COMMAND).then(
            () => setMsg({ kind: 'ok', text: t.copied }),
            () => setMsg({ kind: 'err', text: t.copyFailed }),
          );
        } catch (e) {
          setMsg({ kind: 'err', text: t.copyFailed });
        }
      };

      const statusDot = (on) =>
        h('span', { style: s.status }, h('span', { style: s.dot(on) }), on ? t.configured : t.notSet);

      const isKey = tab === 'key';
      const slot = isKey ? 'key' : 'oauth';
      const value = isKey ? values.key : values.oauth;
      const configured = isKey ? state.key : state.oauth;

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
          statusDot(configured),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            'aria-label': isKey ? t.apiKeyTab : t.oauthTab,
            placeholder: isKey
              ? state.key
                ? t.replaceKey
                : t.pasteKey
              : state.oauth
                ? t.replaceToken
                : t.pasteToken,
            value,
            onChange: (e) => setValues((prev) => ({ ...prev, [slot]: e.target.value })),
            onKeyDown: (e) => {
              if (e.key === 'Enter') saveField(isKey ? REF_KEY : REF_TOKEN, slot, value);
            },
            style: s.input,
          }),
          h(
            'button',
            {
              type: 'button',
              disabled: busy === slot,
              onClick: () => saveField(isKey ? REF_KEY : REF_TOKEN, slot, value),
              style: s.btn(true),
            },
            busy === slot ? t.saving : t.save,
          ),
          configured
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: busy === slot,
                  onClick: () => clearField(isKey ? REF_KEY : REF_TOKEN, slot),
                  style: s.btn(false),
                },
                t.clear,
              )
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
        h('div', { style: s.divider }),
        h(
          'div',
          { style: s.row },
          h('span', { style: s.sectionTitle }, t.proxyUse),
          h(Switch, { on: proxyOn, onToggle: toggleProxy, label: t.proxyTitle }),
          h('span', { style: { fontSize: 12, opacity: 0.65 } }, proxyOn ? t.proxyOn : t.proxyOff),
          statusDot(state.proxy),
        ),
        proxyOn
          ? h(
              'div',
              { style: { display: 'flex', alignItems: 'flex-end', gap: 8 } },
              h(
                'div',
                { style: { flex: 1, minWidth: 0 } },
                h('label', { style: s.fieldLabel }, t.hostLabel),
                h('input', {
                  type: 'text',
                  autoComplete: 'off',
                  spellCheck: false,
                  'aria-label': t.hostLabel,
                  value: host,
                  onChange: (e) => setHost(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') saveProxy();
                  },
                  style: { ...s.input, height: 32 },
                }),
              ),
              h(
                'div',
                { style: { flex: '0 0 auto' } },
                h('label', { style: s.fieldLabel }, t.portLabel),
                h('input', {
                  type: 'text',
                  inputMode: 'numeric',
                  'aria-label': t.portLabel,
                  value: port,
                  onChange: (e) => setPort(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') saveProxy();
                  },
                  style: { ...s.numInput, width: 96 },
                }),
              ),
              h(
                'button',
                { type: 'button', disabled: busy === 'proxy', onClick: saveProxy, style: s.btn(true) },
                busy === 'proxy' ? t.saving : t.save,
              ),
            )
          : null,
        proxyOn ? h('div', { style: s.hint }, t.proxyHint) : null,
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
