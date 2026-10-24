export function textoVersion(version: string, commit: string): string {
  return `v${version} · ${commit}`;
}

export const VERSION = textoVersion(__VERSION__, __COMMIT__);
