import { angleDelta, type Orient } from './protocol';

/** Bloques que dibuja la interfaz. No son tiempo: son fracción de progreso. */
export const BLOCKS = 12;
/** Cada cuánto se revisa la estabilidad y se repinta la barra. */
export const TICK_MS = 60;

// Ventana corta sobre la que se mide el temblor de la mano.
const WINDOW_MS = 380;
// Temblor tolerado: una mano quieta oscila un par de grados, no cero.
const STILL_DEG = 4;
// Tiempo sostenido de quietud que basta para fijar el centro.
const HOLD_MS = 600;
// Techo: pasado esto se acepta la mejor lectura y se sigue. Nadie espera más.
const MAX_MS = 3000;

type Sample = Orient & { t: number };

/**
 * Calibración adaptativa: en vez de exigir tres segundos perfectos, mide el
 * temblor en una ventana corta y acepta en cuanto se sostiene la quietud.
 * Si el teléfono no para, al llegar al techo acepta igual.
 */
export class Calibrator {
  progress = 0;
  shaken = false;
  baseline: Orient | null = null;
  private window: Sample[] = [];
  private stableSince: number | null = null;
  private startedAt = now();

  push(o: Orient) {
    const t = now();
    this.window.push({ ...o, t });
    this.prune(t);
  }

  /** Llamar cada TICK_MS. Devuelve true cuando la calibración terminó. */
  tick(): boolean {
    const t = now();
    this.prune(t);
    if (this.window.length < 3) return this.giveUp(t);

    const isStill = spread(this.window) < STILL_DEG;
    this.shaken = !isStill;
    if (!isStill) {
      this.stableSince = null;
      this.progress = 0;
      return this.giveUp(t);
    }

    this.stableSince = this.stableSince ?? t;
    const held = t - this.stableSince;
    this.progress = Math.min(BLOCKS, Math.round((held / HOLD_MS) * BLOCKS));
    if (held < HOLD_MS) return this.giveUp(t);

    this.settle();
    return true;
  }

  reset() {
    this.window = [];
    this.stableSince = null;
    this.startedAt = now();
    this.progress = 0;
    this.shaken = false;
    this.baseline = null;
  }

  /** Pasado el techo se acepta lo que haya: mejor un centro aproximado que esperar. */
  private giveUp(t: number) {
    if (t - this.startedAt < MAX_MS || this.window.length === 0) return false;
    this.settle();
    return true;
  }

  private settle() {
    this.baseline = mean(this.window);
    this.progress = BLOCKS;
    this.shaken = false;
  }

  private prune(t: number) {
    while (this.window.length > 0 && t - this.window[0].t > WINDOW_MS) this.window.shift();
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Mayor desviación angular dentro de la ventana. */
function spread(list: Sample[]) {
  const ref = list[0];
  let max = 0;
  for (const o of list) {
    max = Math.max(max, Math.abs(angleDelta(o.a, ref.a)), Math.abs(o.b - ref.b), Math.abs(o.g - ref.g));
  }
  return max;
}

function mean(list: Sample[]): Orient {
  const ref = list[0];
  let a = 0;
  let b = 0;
  let g = 0;
  for (const o of list) {
    a += angleDelta(o.a, ref.a);
    b += o.b;
    g += o.g;
  }
  const n = list.length;
  return { a: ref.a + a / n, b: b / n, g: g / n };
}
