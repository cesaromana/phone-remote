import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lanAddresses } from './lan.js';

const DAYS = 825;

/**
 * Certificado propio para poder servir HTTPS en la red local. El teléfono
 * avisará de que no es de confianza (hay que aceptarlo una vez), pero sin
 * HTTPS iOS y Chrome no dan acceso al giroscopio.
 */
export async function ensureCert(dir) {
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  if (existsSync(keyPath) && existsSync(certPath)) {
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
  }

  const hosts = ['localhost', ...lanAddresses()];
  const altNames = hosts.map((h) => (/^\d+\.\d+\.\d+\.\d+$/.test(h) ? { type: 7, ip: h } : { type: 2, value: h }));
  const { default: selfsigned } = await import('selfsigned');
  const pems = await selfsigned.generate([{ name: 'commonName', value: hosts[0] }], {
    days: DAYS,
    keySize: 2048,
    extensions: [{ name: 'subjectAltName', altNames }],
  });

  mkdirSync(dir, { recursive: true });
  writeFileSync(keyPath, pems.private);
  writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}
