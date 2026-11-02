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
          setMsg({ kind: 'err', text: 'This build does not expose the credentials service, so the value cannot be saved.' });
          return;
        }
        if (!value || value.trim().length === 0) {
          setMsg({ kind: 'err', text: 'The value is empty; nothing was saved.' });
          return;
        }
        setBusy(true);
        setMsg(null);
        creds.set(ref, value.trim()).then(
          (res) => {
            setBusy(false);
            if (res && res.ok === true) {
              setMsg({ kind: 'ok', text: label + ' saved. Restart the harness to apply.' });
              if (ref === REF_KEY) setApiKey('');
              else setToken('');
              refresh();
            } else {
              setMsg({ kind: 'err', text: (res && res.error && res.error.message) || 'Save failed.' });
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
                ? { kind: 'ok', text: label + ' cleared.' }
                : { kind: 'err', text: (res && res.error && res.error.message) || 'Clear failed.' },
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
          if (!w) setMsg({ kind: 'err', text: 'The browser blocked the popup; open it manually: ' + url });
          else setMsg({ kind: 'ok', text: okText });
        } catch (e) {
          setMsg({ kind: 'err', text: 'Could not open: ' + ((e && e.message) || String(e)) });
        }
      };

      const LOGIN_COMMAND =
        'node "$HOME/.dsh/dsh-runtimes/stitch-mcp/node_modules/@google/stitch/dist/stitch.js" login';

      const copyLogin = () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(LOGIN_COMMAND).then(
              () => setMsg({ kind: 'ok', text: 'Login command copied. Paste it into a terminal.' }),
              () => setMsg({ kind: 'err', text: 'Clipboard unavailable; copy the command manually.' }),
            );
          } else {
            setMsg({ kind: 'err', text: 'Clipboard unavailable; copy the command manually.' });
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
          h('span', { style: s.badge(state.key) }, state.key ? 'Configured' : 'Not configured'),
        ),
        h(
          'div',
          { style: s.hint },
          'Required for Canvas resources (projects, screens, design systems); separate from your Google sign-in.',
        ),
        h(
          'div',
          { style: { ...s.hint, whiteSpace: 'pre-line' } },
          'Steps (the Stitch settings page is in English):\n' +
            '1. Open the settings page with the button below\n' +
            '2. In the "API key" card, click "Create key" on the right\n' +
            '3. Copy the generated key (it is shown in full only once)\n' +
            '4. Paste it into the field below and press Save',
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
                  'Opened the Stitch settings page: click "Create key" under the "API key" section, then paste the key above.',
                ),
            },
            'Open settings and create an API Key',
          ),
          h('span', { style: s.hint }, 'API key → Create key'),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            placeholder: state.key ? 'Saved; type a new value to replace it' : 'Paste your API Key',
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
            busy ? 'Saving…' : 'Save',
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
                'Clear',
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
          h('span', { style: s.badge(state.token) }, state.token ? 'Configured' : 'Not configured'),
        ),
        h(
          'div',
          { style: s.hint },
          'Google sign-in must run through the CLI: the authorization callback is delivered to a loopback port the CLI opens, so a plain browser tab finishes on the homepage without a token. Use the login command below; the browser opens and the callback lands, and the CLI stores the token locally.',
        ),
        h(
          'div',
          { style: s.row },
          h('button', { type: 'button', onClick: copyLogin, style: s.btn(true) }, 'Copy login command'),
          h(
            'button',
            {
              type: 'button',
              onClick: () => openUrl(STITCH_SETTINGS, 'Opened the Stitch settings page.'),
              style: s.btn(false),
            },
            'Open Stitch settings',
          ),
        ),
        h(
          'div',
          { style: s.row },
          h('input', {
            type: 'password',
            autoComplete: 'off',
            placeholder: state.token ? 'Saved; type a new value to replace it' : 'Paste STITCH_ACCESS_TOKEN',
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
            'Save',
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
                'Clear',
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
        h('div', { style: { fontWeight: 600 } }, 'Stitch credentials'),
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
        h('div', { style: s.hint }, 'Restart the harness after changing credentials so the MCP process respawns with them.'),
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
