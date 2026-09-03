import QRCode from 'qrcode';
import { RemoteHost, type HostState, type PointerState } from '../remote';
import { Targets } from './targets';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const ctx = canvas.getContext('2d')!;
const card = document.querySelector<HTMLDivElement>('#card')!;
const qr = document.querySelector<HTMLCanvasElement>('#qr')!;
const note = document.querySelector<HTMLParagraphElement>('#note')!;
const scoreOut = document.querySelector<HTMLSpanElement>('#score')!;
// Salida de emergencia para probar sin teléfono: abre el mando en otra pestaña.
const link = document.querySelector<HTMLAnchorElement>('#link')!;

const box = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
const targets = new Targets();
let pointer: PointerState = { x: 0, y: 0, a: false, b: false };
let wasDown = false;
let isPlaying = false;

const host = new RemoteHost({ box, label: 'demo', onState: render });
host.pointer.subscribe((p) => {
  // El disparo se atiende en el flanco: mantener apretado no dispara en ráfaga.
  if (p.a && !wasDown && targets.shoot(p)) host.buzz(24);
  wasDown = p.a;
  if (p.b) host.recalibrate();
  pointer = p;
});

function render(s: HostState) {
  isPlaying = s.phase === 'ready';
  card.hidden = isPlaying;
  if (s.url) {
    link.href = s.url;
    link.hidden = false;
  }
  if (s.url) void QRCode.toCanvas(qr, s.url, { width: 220, margin: 1, color: { dark: '#0d0c0b', light: '#f0ece4' } });
  note.textContent = noteFor(s);
}

function noteFor(s: HostState) {
  if (s.error) return `no se pudo abrir la señalización: ${s.error}`;
  if (s.phase === 'calibrating') return s.shaken ? 'sostenelo quieto' : `fijando el centro ${'|'.repeat(s.progress)}`;
  if (s.phase === 'lost') return 'se cortó el enlace, volvé a escanear';
  if (!s.url) return 'conectando…';
  return 'escaneá con el teléfono';
}

function frame(now: number) {
  const { width, height } = box();
  const dpr = Math.min(devicePixelRatio, 2);
  if (canvas.width !== width * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  targets.update(now, { width, height });
  targets.draw(ctx, now);
  if (isPlaying) drawReticle();
  scoreOut.textContent = String(targets.score);
  requestAnimationFrame(frame);
}

function drawReticle() {
  const { x, y } = pointer;
  ctx.strokeStyle = pointer.a ? '#f5d547' : '#f0ece4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.moveTo(x - 22, y);
  ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 22, y);
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y + 22);
  ctx.stroke();
}

requestAnimationFrame(frame);
addEventListener('beforeunload', () => host.destroy());
