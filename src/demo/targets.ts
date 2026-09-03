import { type Point } from '../remote';

const RADIUS = 46;
const LIFE_MS = 2600;
const SPAWN_MS = 900;

type Target = { x: number; y: number; born: number };

/** Demostración mínima: aparecen círculos y hay que reventarlos apuntando. */
export class Targets {
  score = 0;
  private items: Target[] = [];
  private lastSpawn = 0;

  update(now: number, box: { width: number; height: number }) {
    if (now - this.lastSpawn > SPAWN_MS) {
      this.lastSpawn = now;
      const pad = RADIUS * 2;
      this.items.push({
        x: pad + Math.random() * (box.width - pad * 2),
        y: pad + Math.random() * (box.height - pad * 2),
        born: now,
      });
    }
    this.items = this.items.filter((t) => now - t.born < LIFE_MS);
  }

  /** Devuelve true si el disparo dio en algo. */
  shoot(p: Point) {
    const hit = this.items.find((t) => Math.hypot(t.x - p.x, t.y - p.y) < RADIUS);
    if (!hit) return false;
    this.items = this.items.filter((t) => t !== hit);
    this.score += 1;
    return true;
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    for (const t of this.items) {
      // Se encogen mientras se les acaba el tiempo: se ve cuál está por irse.
      const left = 1 - (now - t.born) / LIFE_MS;
      ctx.beginPath();
      ctx.arc(t.x, t.y, RADIUS * (0.35 + left * 0.65), 0, Math.PI * 2);
      ctx.strokeStyle = '#ff5a42';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}
