// Per-origin proxy routing for one MCP endpoint.
//
// The harness installs a single outbound proxy policy per process on undici's global
// dispatcher, and every `fetch` in the process — the MCP streamable-http transport
// included — resolves it through the legacy `Symbol.for('undici.globalDispatcher.1')`
// slot. This module puts one thin wrapper in front of that dispatcher so that exactly one
// origin can be routed through an opt-in proxy while every other request is handed to the
// dispatcher that was there before, untouched.
//
// Two properties matter and are why this is a separate, transport-free module:
//
// * the switch is the only valve: an empty proxy URL means the wrapper routes nothing and
//   the previous dispatcher (which may already resolve a proxy from the environment) keeps
//   deciding for every origin, Stitch included;
// * `undici` is injected rather than imported, so the routing rules can be exercised without
//   touching process-wide state or loading a transport at module load time.

/** The only origin this plugin ever routes. Overridable for tests. */
export const STITCH_HOST = 'stitch.googleapis.com';

/**
 * The lowercase hostname of a request origin.
 *
 * undici hands `dispatch` an `opts.origin` string such as `https://stitch.googleapis.com`;
 * anything unparseable answers `''` so the caller falls back to the previous dispatcher
 * instead of guessing.
 *
 * @param {unknown} origin - the origin as the dispatcher received it.
 * @returns {string} the hostname, or `''` when it cannot be told.
 */
export function hostOf(origin) {
  if (typeof origin !== 'string' || origin === '') return '';
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Validate a proxy URL the same way the harness policy does: an absolute `http:`/`https:`
 * URL, nothing else. A SOCKS or PAC value is rejected loudly here instead of silently
 * connecting directly, because the user asked for a specific route.
 *
 * @param {unknown} value - the address as the card stored it.
 * @returns {string} the trimmed address.
 * @throws {Error} when the value is not a URL this plugin can use.
 */
export function parseProxyUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') throw new Error('proxy address is empty');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('proxy address is not an absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('only http:// and https:// proxy addresses are supported');
  }
  return raw;
}

/**
 * Build the wrapper dispatcher and the switch behind it.
 *
 * The wrapper is a plain object with `dispatch` / `close` / `destroy`; Node's built-in
 * `fetch` accepts it as a global dispatcher (a `Dispatcher` instance is not required), and
 * `close` only ever closes the agent this wrapper created — the previous dispatcher is not
 * ours to close.
 *
 * @param {object} options
 * @param {{dispatch: Function}} options.previous - dispatcher to keep in charge of everything else.
 * @param {object} options.undici - a module with `ProxyAgent`; injected so tests can stand in.
 * @param {string} [options.host] - origin hostname this wrapper routes.
 * @returns {{dispatcher: object, setProxy: (url?: string) => string, proxyUrl: () => string, close: () => Promise<void>}}
 */
export function createStitchRouter({ previous, undici, host = STITCH_HOST } = {}) {
  if (!previous || typeof previous.dispatch !== 'function') {
    throw new TypeError('a previous dispatcher with dispatch() is required');
  }
  if (!undici || typeof undici.ProxyAgent !== 'function') {
    throw new TypeError('an undici module exposing ProxyAgent is required');
  }

  const routedHost = String(host).toLowerCase();
  let target = '';
  let agent = null;

  const closeQuietly = (value) => {
    try {
      const closing = value && typeof value.close === 'function' ? value.close() : undefined;
      return Promise.resolve(closing).catch(() => undefined);
    } catch {
      return Promise.resolve(undefined);
    }
  };

  /**
   * Point the wrapper at a proxy, or at nothing.
   *
   * The new agent is created (and its URL validated) before the old one is closed, so a
   * rejected address leaves the previous route intact and no in-flight request is handed a
   * closed agent.
   *
   * @param {string} [url]
   * @returns {string} the address now in effect; `''` means direct.
   */
  const setProxy = (url) => {
    const next = typeof url === 'string' && url.trim() !== '' ? parseProxyUrl(url) : '';
    if (next === target) return target;
    const previousAgent = agent;
    agent = next === '' ? null : new undici.ProxyAgent({ uri: next });
    target = next;
    if (previousAgent) void closeQuietly(previousAgent);
    return target;
  };

  const dispatcher = {
    dispatch(opts, handler) {
      if (target !== '' && agent !== null && hostOf(opts?.origin) === routedHost) {
        return agent.dispatch(opts, handler);
      }
      return previous.dispatch(opts, handler);
    },
    close() {
      const current = agent;
      agent = null;
      target = '';
      return closeQuietly(current);
    },
    destroy() {
      const current = agent;
      agent = null;
      target = '';
      const destroyed = current && typeof current.destroy === 'function' ? current.destroy() : undefined;
      return Promise.resolve(destroyed).catch(() => undefined);
    },
  };

  return {
    dispatcher,
    setProxy,
    proxyUrl: () => target,
    close: () => dispatcher.close(),
  };
}
