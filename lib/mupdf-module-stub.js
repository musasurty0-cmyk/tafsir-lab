// Browser stub for Node's built-in "module". MuPDF's WASM glue references
// `createRequire` from "module" inside a Node-only code path (guarded by a
// runtime isNode check), so this is never actually executed in the browser —
// it only needs to exist so the bundler can resolve the import.
export function createRequire() {
  return () => ({});
}
export default {};
