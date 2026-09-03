import { angleDelta, type Orient } from './protocol';

// Cuánto giro de muñeca recorre la pantalla entera. Menos grados, más nervioso.
const DEG_PER_SCREEN = 36;
// Suavizado exponencial: 1 sería seguir el sensor crudo, con todo su temblor.
const LERP = 0.15;

export type Point = { x: number; y: number };
export type PointerState = Point & { a: boolean; b: boolean };
type Listener = (p: PointerState) => void;

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Orientación relativa al centro calibrado → punto dentro de un rectángulo. */
export function orientToPoint(o: Orient, base: Orient, box: { width: number; height: number }): Point {
  const dx = -angleDelta(o.a, base.a) * (box.width / DEG_PER_SCREEN);
  const dy = -(o.b - base.b) * (box.height / DEG_PER_SCREEN);
  return {
    x: clamp(box.width / 2 + dx, 0, box.width - 1),
    y: clamp(box.height / 2 + dy, 0, box.height - 1),
  };
}

/**
 * Persigue el objetivo a cadencia de pantalla en vez de saltar a cada lectura
 * del sensor, que llegan a 30 Hz y con temblor. Lleva también los botones,
 * para que quien dibuje reciba un único estado coherente.
 */
export class PointerLoop {
  target: Point = { x: 0, y: 0 };
  a = false;
  b = false;
  active = false;
  private current: Point = { x: 0, y: 0 };
  private listeners = new Set<Listener>();
  private raf = 0;
  private readonly isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  start() {
    const step = () => {
      if (this.active) this.advance();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** Planta puntero y objetivo en el mismo sitio, sin recorrido de por medio. */
  moveTo(p: Point) {
    this.target = { ...p };
    this.current = { ...p };
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private advance() {
    const k = this.isReduced ? 1 : LERP;
    this.current.x += (this.target.x - this.current.x) * k;
    this.current.y += (this.target.y - this.current.y) * k;
    const snapshot = { x: this.current.x, y: this.current.y, a: this.a, b: this.b };
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
