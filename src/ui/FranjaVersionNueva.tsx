import { useRegisterSW } from 'virtual:pwa-register/preact';
import { FranjaVersion } from './comun/Franjas';

export function FranjaVersionNueva() {
  const {
    needRefresh: [hayNueva],
    updateServiceWorker,
  } = useRegisterSW();
  if (!hayNueva) return null;
  return <FranjaVersion onRecargar={() => updateServiceWorker(true)} />;
}
