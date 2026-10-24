// En el HTML único (modo "archivo") no hay service worker: sustituye a `virtual:pwa-register/preact`.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: async () => {},
  };
}
