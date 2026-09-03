// Mensajes entre el teléfono (el mando) y el navegador que muestra la
// pantalla. Viajan por un DataChannel de WebRTC; PeerJS sólo se encarga de
// presentarlos, después el tráfico va directo de un aparato al otro.

/** Lectura cruda del giroscopio: alfa (brújula), beta (inclinar), gamma (girar). */
export type Orient = { a: number; b: number; g: number };

export type ButtonName = 'a' | 'b';

export type PhoneMsg =
  | { t: 'hello'; ua: string }
  | ({ t: 'orient' } & Orient)
  | { t: 'button'; name: ButtonName; down: boolean }
  // dy va como fracción de la zona de arrastre, no en píxeles: así el
  // recorrido se siente igual venga del teléfono que venga.
  | { t: 'scroll'; dy: number; end?: boolean }
  | { t: 'recalibrate' };

/** waiting: sin teléfono. calibrating: buscando el centro. ready: apuntando. lost: se cayó. */
export type Phase = 'waiting' | 'calibrating' | 'ready' | 'lost';

export type DesktopMsg =
  | { t: 'state'; phase: Phase; progress: number; blocks: number; label: string }
  | { t: 'haptic'; ms: number };

/** Ruta donde vive la página del mando. Cambiala si la montás en otro sitio. */
export const CONTROL_PATH = '/control';

/** Dirección que se mete en el QR para que el teléfono abra el mando. */
export function controlUrl(peerId: string, origin = window.location.origin) {
  return `${origin}${CONTROL_PATH}?id=${encodeURIComponent(peerId)}`;
}

/** El identificador de la pantalla, leído de la dirección del mando. */
export function peerIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('id');
}

/** Diferencia angular con envoltura en (-180, 180]. */
export function angleDelta(a: number, b: number) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}
