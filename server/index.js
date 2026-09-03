// Servidor mínimo: sirve el build y hace de señalización de PeerJS.
//
// En la red local conviene HTTPS=1: sin TLS, iOS y Chrome no dan acceso al
// giroscopio, y sin giroscopio no hay mando. El certificado es propio, así que
// el teléfono avisará una vez de que no es de confianza.

import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { ExpressPeerServer } from 'peer';
import { ensureCert } from './cert.js';
import { lanAddresses } from './lan.js';

const PORT = Number(process.env.PORT ?? 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const WANTS_HTTPS = process.env.HTTPS === '1';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, '..', 'dist');

const app = express();
app.set('trust proxy', true);

const plain = createServer(app);
const secure = WANTS_HTTPS ? createSecureServer(await ensureCert(path.join(ROOT, '.cert')), app) : null;

// La señalización se ata al servidor que recibe la conexión, de ahí las dos rutas.
app.use('/peer', ExpressPeerServer(plain, { path: '/', proxied: true }));
if (secure) app.use('/speer', ExpressPeerServer(secure, { path: '/', proxied: true }));

app.get('/api/lan', (_req, res) => {
  res.setHeader('cache-control', 'no-cache');
  res.json({ hosts: lanAddresses(), port: PORT, httpsPort: HTTPS_PORT, https: WANTS_HTTPS });
});

app.use(express.static(DIST, { index: false }));
app.get('/control', (_req, res) => res.sendFile(path.join(DIST, 'control.html')));
app.get('*path', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

// Sin host explícito Node escucha en IPv4 e IPv6; atarlo a 0.0.0.0 deja fuera ::1.
plain.listen(PORT, () => announce('http', PORT));
secure?.listen(HTTPS_PORT, () => announce('https', HTTPS_PORT));

function announce(scheme, port) {
  const lines = ['localhost', ...lanAddresses()].map((h) => `  ${scheme}://${h}:${port}`).join('\n');
  process.stdout.write(`phone remote ${scheme} listo en\n${lines}\n`);
}
