import { RemotePhone, peerIdFromUrl, type RemoteState } from '../remote';

const start = document.querySelector<HTMLButtonElement>('#start')!;
const pad = document.querySelector<HTMLDivElement>('#pad')!;
const note = document.querySelector<HTMLParagraphElement>('#note')!;
const drag = document.querySelector<HTMLDivElement>('#drag')!;

const hostId = peerIdFromUrl();
if (!hostId) note.textContent = 'falta el identificador de la pantalla: escaneá el QR';

const phone = hostId
  ? new RemotePhone(hostId, {
      onStatus: (s) => {
        if (s === 'open') note.textContent = 'enlazado';
        if (s === 'closed' || s === 'error') note.textContent = 'se cayó el enlace';
      },
      onRemote: showRemote,
    })
  : null;

start.addEventListener('click', async () => {
  const permission = await phone?.start();
  if (permission !== 'granted') {
    note.textContent = permission === 'denied' ? 'sin permiso de sensores no hay apuntado' : 'este teléfono no da giroscopio';
    return;
  }
  start.hidden = true;
  pad.hidden = false;
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-btn]')) {
  const name = button.dataset.btn === 'b' ? 'b' : 'a';
  const set = (down: boolean) => (e: PointerEvent) => {
    e.preventDefault();
    button.classList.toggle('is-down', down);
    phone?.button(name, down);
  };
  button.addEventListener('pointerdown', set(true));
  button.addEventListener('pointerup', set(false));
  button.addEventListener('pointercancel', set(false));
}

// El arrastre se manda como fracción de la altura de la zona, no en píxeles:
// así un teléfono chico y uno grande recorren lo mismo con el mismo gesto.
let lastY: number | null = null;
drag.addEventListener('pointerdown', (e) => {
  drag.setPointerCapture(e.pointerId);
  lastY = e.clientY;
});
drag.addEventListener('pointermove', (e) => {
  if (lastY === null) return;
  phone?.scroll((lastY - e.clientY) / drag.clientHeight);
  lastY = e.clientY;
});
const release = () => {
  if (lastY === null) return;
  lastY = null;
  phone?.scroll(0, true);
};
drag.addEventListener('pointerup', release);
drag.addEventListener('pointercancel', release);

function showRemote(s: RemoteState) {
  if (s.phase === 'calibrating') {
    note.textContent = `fijando el centro ${'|'.repeat(s.progress)}${'.'.repeat(s.blocks - s.progress)}`;
    return;
  }
  note.textContent = s.phase === 'ready' ? s.label || 'listo' : 'esperando la pantalla';
}
