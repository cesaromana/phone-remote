# Phone Remote

El teléfono como mando de una página web. Se escanea un QR, el teléfono se
enlaza con el navegador y a partir de ahí el giroscopio mueve un puntero en la
pantalla grande, con dos botones y una zona de arrastre.

No hay aplicación que instalar en ninguno de los dos lados: el mando es otra
página web. Tampoco hay servidor en el medio del tráfico, la señalización sólo
los presenta y después los datos van directo de un aparato al otro por WebRTC.

Salió de mi portafolio, donde lo uso para recorrer la página y jugar. Acá está
suelto, con una demo de dianas para probarlo.

## Probarlo

```bash
npm install
npm run dev
```

Eso alcanza en la computadora, pero el teléfono necesita HTTPS: sin TLS ni iOS
ni Chrome dan acceso al giroscopio. Para la red local:

```bash
npm start                       # compila y sirve
HTTPS=1 npm start               # además levanta TLS con certificado propio
```

El servidor imprime las direcciones de la red local. Se abre la de `https://`
en la computadora, se acepta el aviso del certificado, se escanea el QR con el
teléfono y se acepta el aviso también allí, una vez.

En la nube hace falta un proxy con TLS real delante y `VITE_PEER_SELF=1` al
compilar, para que la señalización vaya a este servidor y no a la de PeerJS.

## Usarlo en otra página

La pantalla crea un anfitrión y se suscribe al puntero:

```ts
import { RemoteHost } from './src/remote';

const host = new RemoteHost({
  box: () => canvas.getBoundingClientRect(),   // a qué rectángulo se apunta
  onState: (s) => pintarQr(s.url),             // s.url es lo que va en el QR
  onButton: (name, down) => { if (name === 'a' && down) disparar(); },
  onScroll: (dy) => window.scrollBy(0, dy * window.innerHeight),
});

host.pointer.subscribe(({ x, y, a }) => dibujarCruceta(x, y, a));
```

El teléfono abre `/control?id=…` y arranca los sensores desde un gesto, que es
la única forma en que iOS los concede:

```ts
import { RemotePhone, peerIdFromUrl } from './src/remote';

const phone = new RemotePhone(peerIdFromUrl()!, { onRemote: (s) => mostrar(s) });
boton.onclick = () => phone.start();
```

## Lo que hay que saber

**La calibración no es un temporizador.** Pedir tres segundos quieto es una
eternidad. Acá se mide el temblor en una ventana de 380 ms y se acepta el
centro en cuanto la mano se sostiene 600 ms; si el teléfono no para, a los tres
segundos se acepta igual la mejor lectura. En la práctica termina en menos de
un segundo.

**El puntero no sigue al sensor.** Las lecturas llegan a 30 Hz y con temblor;
si se dibujan crudas, la cruceta vibra. `PointerLoop` persigue el objetivo con
suavizado exponencial a cadencia de pantalla, y respeta
`prefers-reduced-motion`.

**El arrastre viaja en fracciones, no en píxeles.** Un teléfono chico y uno
grande recorren lo mismo con el mismo gesto.

**Los botones vibran desde el otro lado.** Quien confirma es la pantalla, no el
teléfono: si el mensaje no llegó, no hay vibración, y se nota.

## Cómo está armado

```
src/remote/    la librería, sin dependencias de framework
  protocol.ts    los mensajes que cruzan el canal
  host.ts        la cara de la pantalla
  phone.ts       la cara del teléfono
  calibration.ts encontrar el centro sin hacer esperar
  pointer.ts     mapeo de ángulos a pantalla y suavizado
  sensors.ts     permisos del giroscopio y transmisión
src/demo/      la demo de dianas
server/        estáticos, señalización de PeerJS y TLS local
```

## Licencia

MIT.
