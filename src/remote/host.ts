import Peer, { type DataConnection } from 'peerjs';
import { BLOCKS, Calibrator, TICK_MS } from './calibration';
import { peerOptions } from './peer-config';
import { PointerLoop, orientToPoint } from './pointer';
import { controlUrl, type ButtonName, type DesktopMsg, type Phase, type PhoneMsg } from './protocol';

const HAPTIC = { ready: 40, click: 12 };

export type HostState = {
  peerId: string | null;
  /** Dirección para el QR. Nula hasta que la señalización responde. */
  url: string | null;
  phase: Phase;
  /** Bloques llenos de la barra de calibración, de 0 a `blocks`. */
  progress: number;
  blocks: number;
  /** true mientras el teléfono se mueve demasiado para fijar el centro. */
  shaken: boolean;
  error: string | null;
};

export type HostOptions = {
  /** Rectángulo al que se mapea el apuntado. Por defecto, la ventana. */
  box?: () => { width: number; height: number };
  onState?: (s: HostState) => void;
  onButton?: (name: ButtonName, down: boolean) => void;
  /** dy en fracción del arrastre del teléfono; multiplicalo por lo que quieras mover. */
  onScroll?: (dy: number, end: boolean) => void;
  /** Texto que el mando muestra bajo la cruceta. Útil para decir dónde está uno. */
  label?: string;
};

/**
 * La cara de la pantalla: publica un identificador, espera al teléfono,
 * calibra su centro y a partir de ahí entrega un puntero suavizado.
 */
export class RemoteHost {
  readonly pointer = new PointerLoop();
  state: HostState = { peerId: null, url: null, phase: 'waiting', progress: 0, blocks: BLOCKS, shaken: false, error: null };
  private peer: Peer;
  private conn: DataConnection | null = null;
  private calibrator = new Calibrator();
  private ticker: number | null = null;
  private label: string;

  constructor(private opts: HostOptions = {}) {
    this.label = opts.label ?? '';
    this.peer = new Peer(peerOptions());
    this.peer.on('open', (id) => this.patch({ peerId: id, url: controlUrl(id) }));
    this.peer.on('error', (e) => this.patch({ error: e.message }));
    this.peer.on('connection', (c) => this.attach(c));
    this.pointer.moveTo(this.center());
    this.pointer.start();
  }

  destroy() {
    this.stopTicker();
    this.pointer.stop();
    this.peer.destroy();
  }

  /** Vuelve a fijar el centro. El teléfono también puede pedirlo. */
  recalibrate() {
    this.calibrator.reset();
    this.pointer.active = false;
    this.patch({ phase: 'calibrating', progress: 0, shaken: false });
    this.stopTicker();
    this.ticker = window.setInterval(() => this.tick(), TICK_MS);
  }

  /** Cambia el texto que se ve en el teléfono. */
  setLabel(text: string) {
    if (text === this.label) return;
    this.label = text;
    this.broadcast();
  }

  /** Vibración corta en el teléfono, para acusar recibo de algo. */
  buzz(ms: number) {
    this.send({ t: 'haptic', ms });
  }

  private attach(c: DataConnection) {
    this.conn?.close();
    this.conn = c;
    c.on('data', (d) => this.receive(d as PhoneMsg));
    c.on('close', () => this.lost());
  }

  private lost() {
    this.stopTicker();
    this.pointer.active = false;
    this.patch({ phase: 'lost' });
  }

  private receive(m: PhoneMsg) {
    if (m.t === 'hello' || m.t === 'recalibrate') return this.recalibrate();
    if (m.t === 'orient') return this.orient(m);
    if (m.t === 'button') return this.button(m.name, m.down);
    if (m.t === 'scroll') return this.opts.onScroll?.(m.dy, m.end ?? false);
  }

  private orient(o: { a: number; b: number; g: number }) {
    const { phase } = this.state;
    if (phase === 'calibrating') return this.calibrator.push(o);
    const base = this.calibrator.baseline;
    if (phase !== 'ready' || !base) return;
    this.pointer.target = orientToPoint(o, base, this.box());
  }

  private button(name: ButtonName, down: boolean) {
    this.pointer[name] = down;
    if (down) this.buzz(HAPTIC.click);
    this.opts.onButton?.(name, down);
  }

  private tick() {
    const cal = this.calibrator;
    const isDone = cal.tick();
    this.patch({ progress: cal.progress, shaken: cal.shaken });
    if (!isDone) return;
    this.stopTicker();
    this.pointer.moveTo(this.center());
    this.pointer.active = true;
    this.patch({ phase: 'ready', progress: BLOCKS, shaken: false });
    this.buzz(HAPTIC.ready);
  }

  private box() {
    return this.opts.box?.() ?? { width: window.innerWidth, height: window.innerHeight };
  }

  private center() {
    const { width, height } = this.box();
    return { x: width / 2, y: height / 2 };
  }

  private stopTicker() {
    if (this.ticker) window.clearInterval(this.ticker);
    this.ticker = null;
  }

  private send(m: DesktopMsg) {
    if (this.conn?.open) this.conn.send(m);
  }

  private broadcast() {
    const { phase, progress, blocks } = this.state;
    if (phase !== 'waiting') this.send({ t: 'state', phase, progress, blocks, label: this.label });
  }

  private patch(p: Partial<HostState>) {
    const before = this.state;
    this.state = { ...before, ...p };
    this.opts.onState?.(this.state);
    const isSame = before.phase === this.state.phase && before.progress === this.state.progress;
    if (!isSame) this.broadcast();
  }
}
