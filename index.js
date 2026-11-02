/**
 * Host half.
 *
 * The Client card stores credentials through the Host `credentials` service
 * (write-only, never read back into the UI). Two delivery paths exist because a
 * `!!js` config expression may be evaluated before this plugin activates:
 *
 * 1. `process.env` — the MCP row's `!!js` expressions read it.
 * 2. A `.env` file in the CLI runtime directory — the CLI loads it itself, so the
 *    key reaches the child even when the env hand-off loses the race. The patch
 *    row sets `cwd` to that directory for this reason.
 *
 * `STITCH_HTTPS_PROXY` is the outbound proxy. It is stored like a credential
 * because that is the only writable store a bundle can reach, but it is not a
 * secret. Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1,
 * which the patch row sets; that variable must therefore be a real environment
 * variable, which is why the proxy is also written to `process.env`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENV_REFS = [
  'STITCH_API_KEY',
  'STITCH_ACCESS_TOKEN',
  'STITCH_PROJECT_ID',
  'STITCH_BASE_URL',
];

const ENV_FILE = path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'stitch-mcp', '.env');

export async function apply(ctx) {
  const credentials = ctx.get('credentials');
  if (credentials === undefined) return;

  const values = {};
  for (const name of ENV_REFS) {
    const value = await read(credentials, name);
    if (value !== undefined) {
      process.env[name] = value;
      values[name] = value;
    }
  }

  const proxy = await read(credentials, 'STITCH_HTTPS_PROXY');
  if (proxy !== undefined) {
    process.env.HTTPS_PROXY = proxy;
    process.env.HTTP_PROXY = proxy;
    values.HTTPS_PROXY = proxy;
    values.HTTP_PROXY = proxy;
  }

  writeEnvFile(values);
}

/**
 * Mirror the resolved values into the CLI runtime directory so the child can read
 * them without depending on the environment hand-off. Only non-empty values are
 * written, and the file is removed when nothing is configured.
 */
function writeEnvFile(values) {
  try {
    const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
    if (lines.length === 0) {
      fs.rmSync(ENV_FILE, { force: true });
      return;
    }
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', { mode: 0o600 });
  } catch {
    // A read-only home directory only costs the fallback path, never activation.
  }
}

async function read(credentials, name) {
  try {
    const resolved = await credentials.resolve(name);
    if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) {
      return resolved.value;
    }
  } catch {
    // An unresolvable reference simply keeps whatever is already in the environment.
  }
  return undefined;
}
