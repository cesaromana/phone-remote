import Peer, { type DataConnection } from 'peerjs';
import { peerOptions } from './peer-config';
import { askOrientation, streamOrientation, type SensorPermission } from './sensors';
import type { ButtonName, DesktopMsg, PhoneMsg } from './protocol';

export type LinkStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export type RemoteState = Extract<DesktopMsg, { t: 'state' }>;

export type PhoneOptions = {
  onStatus?: (s: LinkStatus) => void;
  /** Lo que la pantalla dice de sí misma: fase, calibración y etiqueta. */
  onRemote?: (s: RemoteState) => void;
};

/**
 * La cara del teléfono: se conecta a la pantalla, pide permiso de sensores y
 * le manda orientación, botones y arrastre.
 */
export class RemotePhone {
  private peer: Peer;
  private conn: DataConnection | null = null;
  private stopSensors: (() => void) | null = null;

  constructor(hostId: string, private opts: PhoneOptions = {}) {
    this.opts.onStatus?.('connecting');
    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => this.connect(hostId));
    this.peer.on('error', () => this.opts.onStatus?.('error'));
  }

  destroy() {
    this.stopSensors?.();
    this.peer.destroy();
  }

  /**
   * Pide el giroscopio y, si lo dan, empieza a transmitir. Hay que llamarlo
   * desde un gesto del usuario: iOS no lo concede de otra forma.
   */
  async start(): Promise<SensorPermission> {
    const permission = await askOrientation();
    if (permission !== 'granted') return permission;
    this.stopSensors?.();
    this.stopSensors = streamOrientation((m) => this.send(m));
    return permission;
  }

  button(name: ButtonName, down: boolean) {
    this.send({ t: 'button', name, down });
  }

  /** dy en fracción de la zona de arrastre; `end` al soltar el dedo. */
  scroll(dy: number, end = false) {
    this.send({ t: 'scroll', dy, end });
  }

  recalibrate() {
    this.send({ t: 'recalibrate' });
  }

  send(m: PhoneMsg) {
    if (this.conn?.open) this.conn.send(m);
  }

  private connect(hostId: string) {
    const c = this.peer.connect(hostId, { serialization: 'json' });
    this.conn = c;
    c.on('open', () => {
      this.opts.onStatus?.('open');
      c.send({ t: 'hello', ua: navigator.userAgent } satisfies PhoneMsg);
    });
    c.on('data', (d) => this.receive(d as DesktopMsg));
    c.on('close', () => this.opts.onStatus?.('closed'));
    c.on('error', () => this.opts.onStatus?.('error'));
  }

  private receive(m: DesktopMsg) {
    if (m.t === 'haptic') return void navigator.vibrate?.(m.ms);
    this.opts.onRemote?.(m);
  }
}
