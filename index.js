// Host half: this bundle is configuration-only, so the Host entry has no work to do.
// It exists so the bundle is a normal Cordis plugin, which is what mounts the
// Client half declared under "dsh.client" in package.json.
export function apply() {}
