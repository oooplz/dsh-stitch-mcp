/**
 * Host half.
 *
 * The Client card stores Stitch credentials through the Host `credentials`
 * service (write-only, never read back into the UI). The MCP row for
 * `@deepseek-ai/dsh-mcp-client` reads its env through `!!js` expressions, which
 * can only see `process.env`, so this entry republishes the stored credentials
 * into `process.env` at activation.
 *
 * Row order in cordis.patch.yml matters: this entry is inserted before the
 * `stitch-mcp` row, and Cordis awaits each activation, so the variables are set
 * before the MCP client evaluates its env.
 */

/** Credential references the card can store, and the env names the CLI reads. */
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
    try {
      const resolved = await credentials.resolve(name);
      if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) {
        process.env[name] = resolved.value;
      }
    } catch {
      // An unresolvable reference simply keeps the ambient value already there.
    }
  }
}
