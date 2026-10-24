import { useRegisterSW } from 'virtual:pwa-register/preact';

export function FranjaVersionNueva() {
  const {
    needRefresh: [hayNueva],
    updateServiceWorker,
  } = useRegisterSW();
  if (!hayNueva) return null;
  return (
    <div class="franja-version" role="status">
      <span>Hay una versión nueva</span>
      <span aria-hidden="true"> · </span>
      <button type="button" onClick={() => updateServiceWorker(true)}>
        Recargar
      </button>
    </div>
  );
}
