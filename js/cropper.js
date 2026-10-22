// Circular crop tool: drag to position, slider or mouse wheel to zoom.
// Exports a square JPEG covering the circle; it is displayed round everywhere.

const VIEW = 280;
const OUTPUT = 512;
const MAX_ZOOM = 4;

export function createCropper(canvas, zoomInput) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = VIEW * dpr;
  canvas.height = VIEW * dpr;
  canvas.style.width = `${VIEW}px`;
  const ctx = canvas.getContext('2d');

  zoomInput.min = '1';
  zoomInput.max = String(MAX_ZOOM);
  zoomInput.step = '0.01';

  let img = null;
  let baseScale = 1;
  let zoom = 1;
  let x = 0;
  let y = 0;
  let drag = null;

  const scale = () => baseScale * zoom;

  // Keep the image covering the whole crop area.
  function clamp() {
    const w = img.naturalWidth * scale();
    const h = img.naturalHeight * scale();
    x = Math.min(0, Math.max(VIEW - w, x));
    y = Math.min(0, Math.max(VIEW - h, y));
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW, VIEW);
    if (!img) return;
    ctx.drawImage(img, x, y, img.naturalWidth * scale(), img.naturalHeight * scale());
    ctx.fillStyle = 'rgba(17, 24, 39, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, VIEW, VIEW);
    ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2, 0, Math.PI * 2);
    ctx.fill('evenodd');
  }

  // Zoom around the centre of the crop area.
  function setZoom(value) {
    const next = Math.min(MAX_ZOOM, Math.max(1, value));
    const centre = VIEW / 2;
    const ratio = next / zoom;
    x = centre - (centre - x) * ratio;
    y = centre - (centre - y) * ratio;
    zoom = next;
    zoomInput.value = String(next);
    clamp();
    draw();
  }

  zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));

  canvas.addEventListener('pointerdown', (event) => {
    if (!img) return;
    canvas.setPointerCapture(event.pointerId);
    // The canvas may be shrunk on narrow screens; convert screen pixels to crop pixels.
    const ratio = VIEW / canvas.getBoundingClientRect().width;
    drag = { startX: event.clientX, startY: event.clientY, x, y, ratio };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    x = drag.x + (event.clientX - drag.startX) * drag.ratio;
    y = drag.y + (event.clientY - drag.startY) * drag.ratio;
    clamp();
    draw();
  });

  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (event) => {
    if (!img) return;
    event.preventDefault();
    setZoom(zoom * Math.exp(-event.deltaY * 0.001));
  }, { passive: false });

  return {
    load(image) {
      img = image;
      baseScale = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
      zoom = 1;
      zoomInput.value = '1';
      x = (VIEW - img.naturalWidth * baseScale) / 2;
      y = (VIEW - img.naturalHeight * baseScale) / 2;
      draw();
    },

    toBlob() {
      const out = document.createElement('canvas');
      out.width = OUTPUT;
      out.height = OUTPUT;
      const f = OUTPUT / VIEW;
      const outCtx = out.getContext('2d');
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(img, x * f, y * f, img.naturalWidth * scale() * f, img.naturalHeight * scale() * f);
      return new Promise((resolve, reject) => {
        out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process image.'))), 'image/jpeg', 0.9);
      });
    },
  };
}
