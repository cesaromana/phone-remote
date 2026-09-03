import type { PeerOptions } from 'peerjs';

// Con VITE_PEER_SELF=1 la señalización va al servidor de este repositorio.
// Sin esa variable se usa la nube gratuita de PeerJS, que sirve para probar.
//
// El servidor local levanta además un puerto HTTPS con certificado propio, y
// ese tiene su señalización en /speer. En producción hay un proxy con TLS
// real delante de un único servidor, así que ahí siempre es /peer.
const LOCAL_HTTPS_PORT = import.meta.env.VITE_HTTPS_PORT ?? '3443';

export function peerOptions(): PeerOptions {
  if (import.meta.env.VITE_PEER_SELF !== '1') return {};
  const isHttps = window.location.protocol === 'https:';
  const port = window.location.port ? Number(window.location.port) : isHttps ? 443 : 80;
  const isLocalTls = isHttps && window.location.port === String(LOCAL_HTTPS_PORT);
  return { host: window.location.hostname, port, path: isLocalTls ? '/speer' : '/peer', secure: isHttps };
}
