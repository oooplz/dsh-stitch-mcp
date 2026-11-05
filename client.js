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
        proxyHint: 'On: use the proxy server. Off: direct by default, or the system proxy.',
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
        proxyHint: '开：走代理服务器，关：默认直连，或者使用系统代理。',
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

    // The UI language is a harness preference, not the browser's. The `locale` service is
    // the only correct source; `document.documentElement.lang` is what the harness writes
    // on every switch, so it is the fallback before the OS language. Reading
    // `navigator.language` first is what used to render this card in Chinese on an
    // English UI whenever the two disagreed.
    const pickLocale = (service) => {
      try {
        const active =
          service && typeof service.getSnapshot === 'function' ? service.getSnapshot().active : null;
        if (typeof active === 'string' && active.toLowerCase().startsWith('zh')) return 'zh';
        if (typeof active === 'string' && active.toLowerCase().startsWith('en')) return 'en';
      } catch (e) {
        /* no service: fall back to the document, then the browser */
      }
      try {
        const lang = String(document.documentElement.lang || '').toLowerCase();
        if (lang.startsWith('zh')) return 'zh';
        if (lang.startsWith('en')) return 'en';
      } catch (e) {
        /* no document */
      }
      try {
        return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
      } catch (e) {
        return 'en';
      }
    };

    // A language switch republishes the locale snapshot; live cards re-render through
    // this set, because the translate function resolves on every call.
    const localeListeners = new Set();
    const notifyLocale = () => {
      for (const listener of Array.from(localeListeners)) {
        try {
          listener();
        } catch (e) {
          /* one broken card must not stop the others */
        }
      }
    };

    // Masked-value memory. The credentials service is write-only — `describe` reports
    // whether a value exists, never the value — so the card cannot read a stored key
    // back. It remembers the mask of what this browser saved instead, and drops it as
    // soon as the reference stops resolving or resolves from a different source.
    const MASK_STORE = 'dsh-stitch-mcp:masks:v1';
    // The Host half publishes the masked form of whatever is stored, so a key saved
    // before this card existed — or from another browser — still shows its mask.
    const MASK_ROUTE = '/api/dsh-stitch-mcp/credential-mask';
    const maskValue = (value) => {
      const text = String(value == null ? '' : value).trim();
      if (text === '') return '';
      if (text.length <= 6) return '\u2022\u2022\u2022\u2022\u2022\u2022';
      return text.slice(0, 3) + '\u2022\u2022\u2022' + text.slice(-3);
    };
    const readMasks = () => {
      try {
        const raw = window.localStorage.getItem(MASK_STORE);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (e) {
        return {};
      }
    };
    const writeMasks = (masks) => {
      try {
        window.localStorage.setItem(MASK_STORE, JSON.stringify(masks));
      } catch (e) {
        /* a blocked storage only costs the mask, never the card */
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
      mask: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        letterSpacing: '0.02em',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'text',
      },
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
      // Whether the field is showing the stored value instead of taking a new one.
      const [editing, setEditing] = React.useState(false);
      const masksRef = React.useRef(readMasks());
      const [masks, setMasks] = React.useState(masksRef.current);
      // What the Host half says is stored, when it can answer at all.
      const [hostMask, setHostMask] = React.useState(null);
      const aliveRef = React.useRef(true);

      const loadMask = () => {
        try {
          fetch(MASK_ROUTE, { headers: { accept: 'application/json' } }).then(
            (res) => (res && res.ok ? res.json() : null),
            () => null,
          ).then((data) => {
            if (!aliveRef.current || !data || data.ok !== true) return;
            setHostMask({
              apiKey: typeof data.apiKey === 'string' ? data.apiKey : '',
              accessToken: typeof data.accessToken === 'string' ? data.accessToken : '',
            });
          });
        } catch (e) {
          // A host without a web server leaves the card on its own memory.
        }
      };

      const refreshMaskSoon = () => {
        // The Host half notices a credential change on its own poll, so give it a moment
        // before asking again rather than caching the answer that was true before the save.
        for (const delay of [2500, 5000]) {
          window.setTimeout(() => {
            if (aliveRef.current) loadMask();
          }, delay);
        }
      };

      const commitMasks = (next) => {
        masksRef.current = next;
        setMasks(next);
        writeMasks(next);
      };

      const rememberMask = (ref, value) => {
        const text = maskValue(value);
        if (text === '') return;
        commitMasks({ ...masksRef.current, [ref]: { text } });
      };

      const forgetMask = (ref) => {
        if (!masksRef.current[ref]) return;
        const next = { ...masksRef.current };
        delete next[ref];
        commitMasks(next);
      };

      // A remembered mask describes the value this browser saved. When the reference is
      // no longer configured, or now resolves from another source, it is stale: drop it
      // instead of showing the tail of a key that is not the one in use.
      const reconcileMasks = (info) => {
        const current = masksRef.current;
        let next = current;
        for (const ref of [REF_KEY, REF_TOKEN]) {
          const entry = current[ref];
          if (!entry) continue;
          const row = info(ref);
          if (row.configured !== true || (entry.source && row.source && entry.source !== row.source)) {
            if (next === current) next = { ...current };
            delete next[ref];
            continue;
          }
          if (!entry.source && typeof row.source === 'string' && row.source !== '') {
            if (next === current) next = { ...current };
            next[ref] = { ...entry, source: row.source };
          }
        }
        if (next !== current) commitMasks(next);
      };

      const describe = () => {
        if (!creds || typeof creds.describe !== 'function') return;
        creds.describe([REF_KEY, REF_TOKEN, REF_PROXY]).then(
          (res) => {
            if (!res || res.ok !== true) return;
            const v = res.value || {};
            const info = (ref) => (v[ref] && typeof v[ref] === 'object' ? v[ref] : {});
            const configured = (ref) => info(ref).configured === true;
            setState({ key: configured(REF_KEY), oauth: configured(REF_TOKEN), proxy: configured(REF_PROXY) });
            setProxyOn(configured(REF_PROXY));
            reconcileMasks(info);
          },
          () => {},
        );
      };

      React.useEffect(() => {
        describe();
        return undefined;
      }, [creds]);

      // Re-render on a harness language switch: `t` resolves per call, so the copy needs
      // no other bookkeeping than a fresh paint.
      const [, bumpLocale] = React.useReducer((n) => n + 1, 0);
      React.useEffect(() => {
        localeListeners.add(bumpLocale);
        return () => {
          localeListeners.delete(bumpLocale);
        };
      }, []);

      React.useEffect(() => {
        aliveRef.current = true;
        loadMask();
        return () => {
          aliveRef.current = false;
        };
      }, []);

      // Messages carry a copy key, not resolved text, so a message that is already on
      // screen follows a language switch with the rest of the card. Service text is the
      // only thing stored verbatim.
      const write = (ref, slot, value, okKey) => {
        if (!creds || typeof creds.set !== 'function') {
          setMsg({ kind: 'err', key: 'noService' });
          return;
        }
        setBusy(slot);
        setMsg(null);
        creds.set(ref, value).then(
          (res) => {
            setBusy(null);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', key: okKey });
              if (slot === 'proxy') {
                setProxyOn(true);
              } else {
                setValues((prev) => ({ ...prev, [slot]: '' }));
                rememberMask(ref, value);
                setEditing(false);
              }
              describe();
            } else {
              const detail = res && res.error && res.error.message;
              setMsg(detail ? { kind: 'err', text: detail } : { kind: 'err', key: 'saveFailed' });
            }
          },
          (e) => {
            setBusy(null);
            setMsg({ kind: 'err', text: (e && e.message) || undefined, key: 'saveFailed' });
          },
        );
      };

      const saveField = (ref, slot, value) => {
        if (!value || !value.trim()) {
          setMsg({ kind: 'err', key: 'empty' });
          return;
        }
        write(ref, slot, value.trim(), 'saved');
      };

      const clearField = (ref, slot) => {
        if (!creds || typeof creds.unset !== 'function') return;
        setBusy(slot);
        creds.unset(ref).then(
          (res) => {
            setBusy(null);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', key: 'cleared' });
              setState((prev) => ({ ...prev, [slot]: false }));
              forgetMask(ref);
              setEditing(false);
              setHostMask(null);
              refreshMaskSoon();
            } else {
              const detail = res && res.error && res.error.message;
              setMsg(detail ? { kind: 'err', text: detail } : { kind: 'err', key: 'clearFailed' });
            }
          },
          (e) => {
            setBusy(null);
            setMsg({ kind: 'err', text: (e && e.message) || undefined, key: 'clearFailed' });
          },
        );
      };

      // The switch is the valve: turning it on saves the address in the same action, and
      // turning it off unsets it. There is no "on but not saved" state to get stuck in.
      const proxyAddress = () => {
        const hostValue = host.trim();
        const portValue = port.trim();
        if (!hostValue || !portValue) {
          setMsg({ kind: 'err', key: 'proxyRequired' });
          return null;
        }
        if (!/^\d+$/.test(portValue) || Number(portValue) < 1 || Number(portValue) > 65535) {
          setMsg({ kind: 'err', key: 'portInvalid' });
          return null;
        }
        return 'http://' + hostValue + ':' + portValue;
      };

      const saveProxy = () => {
        const address = proxyAddress();
        if (address === null) return;
        write(REF_PROXY, 'proxy', address, 'saved');
      };

      const toggleProxy = () => {
        if (proxyOn) {
          setProxyOn(false);
          clearField(REF_PROXY, 'proxy');
          return;
        }
        const address = proxyAddress();
        if (address === null) return;
        // `write` flips the switch on only after the service confirms the save.
        write(REF_PROXY, 'proxy', address, 'saved');
      };

      const open = () => {
        try {
          const w = window.open(SETTINGS_URL, '_blank', 'noopener');
          setMsg(w ? { kind: 'ok', key: 'opened' } : { kind: 'err', key: 'popupBlocked' });
        } catch (e) {
          setMsg({ kind: 'err', key: 'openFailed' });
        }
      };

      const copyCommand = () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) {
            setMsg({ kind: 'err', key: 'copyFailed' });
            return;
          }
          navigator.clipboard.writeText(TOKEN_COMMAND).then(
            () => setMsg({ kind: 'ok', key: 'copied' }),
            () => setMsg({ kind: 'err', key: 'copyFailed' }),
          );
        } catch (e) {
          setMsg({ kind: 'err', key: 'copyFailed' });
        }
      };

      const maskFor = (ref) => {
        const entry = masks[ref];
        const remembered = entry && typeof entry.text === 'string' ? entry.text : '';
        if (remembered !== '') return remembered;
        if (hostMask === null) return '';
        return (ref === REF_TOKEN ? hostMask.accessToken : hostMask.apiKey) || '';
      };

      const statusDot = (on) =>
        h(
          'span',
          { style: s.status },
          h('span', { style: s.dot(on) }),
          h('span', null, on ? t('configured') : t('notSet')),
        );

      const isKey = tab === 'key';
      const slot = isKey ? 'key' : 'oauth';
      const value = isKey ? values.key : values.oauth;
      const configured = isKey ? state.key : state.oauth;
      const activeRef = isKey ? REF_KEY : REF_TOKEN;
      const maskText = maskFor(activeRef);
      // The stored credential is shown *in* the field, where a value belongs, until the
      // reader focuses it to paste a new one. Nothing secret reaches the DOM: it is the
      // three-plus-three mask, and it is read-only while it stands there.
      const showMask = !editing && value === '' && configured && maskText !== '';

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
                  setEditing(false);
                  setMsg(null);
                },
              },
              t('apiKeyTab'),
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
                  setEditing(false);
                  setMsg(null);
                },
              },
              t('oauthTab'),
            ),
          ),
          statusDot(configured),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: showMask ? 'text' : 'password',
            autoComplete: 'off',
            spellCheck: false,
            'aria-label': isKey ? t('apiKeyTab') : t('oauthTab'),
            placeholder: isKey
              ? state.key
                ? t('replaceKey')
                : t('pasteKey')
              : state.oauth
                ? t('replaceToken')
                : t('pasteToken'),
            value: showMask ? maskText : value,
            readOnly: showMask,
            title: showMask ? t('replaceKey') : undefined,
            onFocus: () => {
              if (showMask) setEditing(true);
            },
            onBlur: () => {
              if (value.trim() === '') setEditing(false);
            },
            onChange: (e) => setValues((prev) => ({ ...prev, [slot]: e.target.value })),
            onKeyDown: (e) => {
              if (e.key === 'Enter') saveField(isKey ? REF_KEY : REF_TOKEN, slot, value);
            },
            style: showMask ? { ...s.input, ...s.mask } : s.input,
          }),
          h(
            'button',
            {
              type: 'button',
              // Nothing to save while the field is showing the stored value.
              disabled: busy === slot || showMask,
              onClick: () => saveField(isKey ? REF_KEY : REF_TOKEN, slot, value),
              style: s.btn(true),
            },
            busy === slot ? t('saving') : t('save'),
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
                t('clear'),
              )
            : null,
        ),
        h(
          'div',
          { style: s.actions },
          isKey
            ? h('button', { type: 'button', onClick: open, style: s.link }, t('createKey') + ' \u2197')
            : h(
                React.Fragment,
                null,
                h('button', { type: 'button', onClick: copyCommand, style: s.link }, t('copyCommand')),
                h('span', { style: { fontSize: 12, opacity: 0.25 } }, '\u00b7'),
                h('button', { type: 'button', onClick: open, style: s.link }, t('openSettings')),
              ),
        ),
        h('div', { style: s.divider }),
        h(
          'div',
          { style: s.row },
          h('span', { style: s.sectionTitle }, t('proxyUse')),
          h(Switch, { on: proxyOn, onToggle: toggleProxy, label: t('proxyTitle') }),
          h('span', { style: { fontSize: 12, opacity: 0.65 } }, proxyOn ? t('proxyOn') : t('proxyOff')),
          statusDot(state.proxy),
        ),
        proxyOn
          ? h(
              'div',
              { style: { display: 'flex', alignItems: 'flex-end', gap: 8 } },
              h(
                'div',
                { style: { flex: 1, minWidth: 0 } },
                h('label', { style: s.fieldLabel }, t('hostLabel')),
                h('input', {
                  type: 'text',
                  autoComplete: 'off',
                  spellCheck: false,
                  'aria-label': t('hostLabel'),
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
                h('label', { style: s.fieldLabel }, t('portLabel')),
                h('input', {
                  type: 'text',
                  inputMode: 'numeric',
                  'aria-label': t('portLabel'),
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
                busy === 'proxy' ? t('saving') : t('save'),
              ),
            )
          : null,
        proxyOn ? h('div', { style: s.hint }, t('proxyHint')) : null,
        msg ? h('div', { style: msg.kind === 'ok' ? s.ok : s.err }, msg.key ? t(msg.key) : msg.text) : null,
      );
    }

    // The harness `locale` service is the source of the UI language. It is registered
    // here rather than read once, because the active language is a user preference that
    // can change while the card is mounted, and because a client half cannot import
    // modules: the service carries this dictionary for us.
    const makeT = (locale) => {
      let bound;
      if (locale && typeof locale.bind === 'function') {
        try {
          bound = locale.bind(NS);
        } catch (e) {
          bound = undefined;
        }
      }
      return (key) => {
        if (typeof bound === 'function') {
          try {
            const text = bound(key);
            if (typeof text === 'string' && text !== '' && text !== key) return text;
          } catch (e) {
            /* fall through to the local dictionary */
          }
        }
        const dict = I18N[pickLocale(locale)] || I18N.en;
        return typeof dict[key] === 'string' ? dict[key] : key;
      };
    };

    return {
      // `locale` and `remote.credentials` must be declared: Cordis rejects undeclared
      // service access, and `ctx.get('locale')` without the declaration is how this card
      // ended up on the browser language while the rest of the UI was English.
      inject: ['slots', 'remote', 'remote.credentials', 'locale'],
      apply(ctx) {
        const creds = ctx.remote.credentials;
        const locale = ctx.locale;
        const t = makeT(locale);

        if (locale) {
          ctx.effect(() => {
            try {
              return locale.register(NS, I18N);
            } catch (e) {
              return undefined;
            }
          }, 'stitch-mcp: locale dictionaries');
          if (typeof locale.subscribe === 'function') {
            ctx.effect(() => locale.subscribe(notifyLocale), 'stitch-mcp: locale subscription');
          }
        }

        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: NS }, () =>
            h(CredentialCard, { creds, t }),
          ),
        );
      },
    };
  },
});
