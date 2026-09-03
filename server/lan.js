import { networkInterfaces } from 'node:os';

/** Direcciones IPv4 de la red local, sin loopback ni interfaces virtuales. */
export function lanAddresses() {
  const nets = networkInterfaces();
  const out = [];
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      out.push(net.address);
    }
  }
  // Las 192.168.x.x suelen ser la red de casa; van primero.
  return out.sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')));
}
