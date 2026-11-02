/**
 * Host half.
 *
 * The Client card stores credentials through the Host `credentials` service
 * (write-only, never read back into the UI). The MCP row for
 * `@deepseek-ai/dsh-mcp-client` reads its env through `!!js` expressions, which
 * can only see `process.env`, so this entry republishes the stored values into
 * `process.env` at activation.
 *
 * `STITCH_HTTPS_PROXY` is the outbound proxy for the CLI child. It is stored like
 * a credential because that is the only writable store a bundle can reach, but it
 * is not a secret. Node's built-in fetch ignores HTTPS_PROXY unless
 * NODE_USE_ENV_PROXY=1, which the patch row sets.
 *
 * Row order in cordis.patch.yml matters: this entry is inserted before the
 * `stitch-mcp` row, and Cordis awaits each activation, so the variables are set
 * before the MCP client evaluates its env.
 */

const ENV_REFS = [
  'STITCH_API_KEY',
  'STITCH_ACCESS_TOKEN',
  'STITCH_PROJECT_ID',
  'STITCH_BASE_URL',
];

export async function apply(ctx) {
  const credentials = ctx.get('credentials');
  if (credentials === undefined) return;

  for (const name of ENV_REFS) {
    const value = await read(credentials, name);
    if (value !== undefined) process.env[name] = value;
  }

  // A configured proxy applies to both variable names the toolchain may consult.
  const proxy = await read(credentials, 'STITCH_HTTPS_PROXY');
  if (proxy !== undefined) {
    process.env.HTTPS_PROXY = proxy;
    process.env.HTTP_PROXY = proxy;
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
