import type { PhoneMsg } from './protocol';

// Más rápido no se nota y sólo llena el canal.
const SEND_HZ = 30;

export type SensorPermission = 'unknown' | 'granted' | 'denied' | 'unsupported';

type Gated = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iOS 13+ exige pedirlo desde un gesto del usuario y sobre HTTPS. */
export function needsPrompt() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  return typeof (DeviceOrientationEvent as Gated).requestPermission === 'function';
}

export async function askOrientation(): Promise<SensorPermission> {
  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
  const gated = DeviceOrientationEvent as Gated;
  if (typeof gated.requestPermission !== 'function') return 'granted';
  try {
    return await gated.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Escucha el giroscopio y va soltando lecturas al ritmo acordado. */
export function streamOrientation(send: (m: PhoneMsg) => void) {
  let last = 0;
  const onOrient = (e: DeviceOrientationEvent) => {
    const now = performance.now();
    if (now - last < 1000 / SEND_HZ) return;
    last = now;
    send({ t: 'orient', a: e.alpha ?? 0, b: e.beta ?? 0, g: e.gamma ?? 0 });
  };
  window.addEventListener('deviceorientation', onOrient);
  return () => window.removeEventListener('deviceorientation', onOrient);
}
