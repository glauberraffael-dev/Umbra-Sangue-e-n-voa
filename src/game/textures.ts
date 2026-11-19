import * as THREE from 'three';

export interface GothicTextures {
  cobbleMap: THREE.CanvasTexture;
  cobbleBump: THREE.CanvasTexture;
  cobbleRoughness: THREE.CanvasTexture;
  stoneMap: THREE.CanvasTexture;
  roofMap: THREE.CanvasTexture;
  stainedGlassMap: THREE.CanvasTexture;
  roseWindowMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  visionConeMap: THREE.CanvasTexture;
  lampPoolMap: THREE.CanvasTexture;
  eyeClosedMap: THREE.CanvasTexture;
  eyeHalfMap: THREE.CanvasTexture;
  eyeOpenMap: THREE.CanvasTexture;
  dispose: () => void;
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
  retroNearest = false,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = retroNearest ? 1 : maxAniso;
  if (retroNearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapNearestFilter;
  }
  tex.needsUpdate = true;
  return tex;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createEyeMarkerTexture(openness: 'closed' | 'half' | 'open'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 64);

  const cx = 64;
  const cy = 32;
  const w = 50;
  const h = openness === 'closed' ? 4 : openness === 'half' ? 14 : 24;

  // Dark outer backing for contrast against night sky
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w - 5, cy);
  ctx.quadraticCurveTo(cx, cy - h - 7, cx + w + 5, cy);
  ctx.quadraticCurveTo(cx, cy + h + 7, cx - w - 5, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(4, 6, 14, 0.86)';
  ctx.fill();
  ctx.restore();

  if (openness === 'closed') {
    // Narrow watchful eyelid line + tiny central slit
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy);
    ctx.quadraticCurveTo(cx, cy + 7, cx + 44, cy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 7, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Almond eye silhouette
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w, cy);
    ctx.quadraticCurveTo(cx, cy - h, cx + w, cy);
    ctx.quadraticCurveTo(cx, cy + h, cx - w, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fill();
    ctx.clip();

    // Glowing iris disc
    const irisR = openness === 'open' ? 17 : 13;
    const irisGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, irisR);
    irisGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    irisGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.9)');
    irisGrad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Dark sharp gothic pupil
    ctx.fillStyle = '#05070e';
    ctx.beginPath();
    ctx.ellipse(cx, cy, openness === 'open' ? 5.5 : 4.2, irisR * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crisp outer eyelid stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy);
    ctx.quadraticCurveTo(cx, cy - h, cx + w, cy);
    ctx.quadraticCurveTo(cx, cy + h, cx - w, cy);
    ctx.closePath();
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createGothicTextures(renderer: THREE.WebGLRenderer): GothicTextures {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const rand = seededRand(1337);

  // 1. PS2-era crisp low-res cobblestone street texture (128x128)
  const cobbleCanvas = document.createElement('canvas');
  cobbleCanvas.width = 128;
  cobbleCanvas.height = 128;
  const cCtx = cobbleCanvas.getContext('2d')!;
  cCtx.fillStyle = '#0f131d';
  cCtx.fillRect(0, 0, 128, 128);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 128;
  bumpCanvas.height = 128;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#202020';
  bCtx.fillRect(0, 0, 128, 128);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 128;
  roughCanvas.height = 128;
  const rgCtx = roughCanvas.getContext('2d')!;
  rgCtx.fillStyle = '#f8f8f8'; // matte mortar crevices
  rgCtx.fillRect(0, 0, 128, 128);

  const rows = 8;
  const cols = 6;
  const cellH = 128 / rows;
  const cellW = 128 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cellW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = Math.round(c * cellW + offset + 1);
      const y = Math.round(r * cellH + 1);
      const w = Math.round(cellW - 2);
      const h = Math.round(cellH - 2);
      const shade = 26 + Math.floor(rand() * 20);
      const blueTint = 10 + Math.floor(rand() * 12);
      cCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + blueTint})`;
      cCtx.fillRect(x, y, w, h);

      // Subtle PS2 stone crown edge
      cCtx.fillStyle = `rgba(120, 145, 185, ${0.12 + rand() * 0.1})`;
      cCtx.fillRect(x, y, w, 1);
      cCtx.fillRect(x, y, 1, h);

      const bVal = 135 + Math.floor(rand() * 90);
      bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bCtx.fillRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));

      // Consistently rough matte stone crowns
      const rVal = 232 + Math.floor(rand() * 20);
      rgCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
      rgCtx.fillRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
    }
  }

  for (let i = 0; i < 24; i++) {
    const px = Math.floor(rand() * 128);
    const py = Math.floor(rand() * 128);
    const pw = 8 + Math.floor(rand() * 10);
    const ph = 3 + Math.floor(rand() * 5);
    cCtx.fillStyle = 'rgba(12, 16, 26, 0.32)';
    cCtx.fillRect(px, py, pw, ph);
    // Slightly weathered dark stone patch without mirror sheen
    rgCtx.fillStyle = 'rgb(220, 220, 220)';
    rgCtx.fillRect(px, py, pw, ph);
  }

  const cobbleMap = configureTexture(cobbleCanvas, true, maxAniso, 64, 64, true);
  const cobbleBump = configureTexture(bumpCanvas, false, maxAniso, 64, 64, true);
  const cobbleRoughness = configureTexture(roughCanvas, false, maxAniso, 64, 64, true);

  // 2. PS2 Gothic Ashlar Stone Wall Texture (128x128)
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 128;
  stoneCanvas.height = 128;
  const sCtx = stoneCanvas.getContext('2d')!;
  sCtx.fillStyle = '#12151f';
  sCtx.fillRect(0, 0, 128, 128);

  const sRows = 8;
  const sCols = 4;
  const sH = 128 / sRows;
  const sW = 128 / sCols;
  for (let r = 0; r < sRows; r++) {
    const off = (r % 2) * (sW * 0.5);
    for (let c = -1; c <= sCols; c++) {
      const v = 34 + Math.floor(rand() * 24);
      const bx = Math.round(c * sW + off + 1);
      const by = Math.round(r * sH + 1);
      const bw = Math.round(sW - 2);
      const bh = Math.round(sH - 2);
      sCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 10})`;
      sCtx.fillRect(bx, by, bw, bh);

      // Top highlight & bottom grime band (classic PS2 baked AO)
      sCtx.fillStyle = 'rgba(148, 163, 184, 0.14)';
      sCtx.fillRect(bx, by, bw, 1);
      sCtx.fillStyle = 'rgba(8, 10, 16, 0.36)';
      sCtx.fillRect(bx, by + bh - 3, bw, 3);
    }
  }
  const stoneMap = configureTexture(stoneCanvas, true, maxAniso, 2, 2, true);

  // 3. PS2 Slate Roof Tiles (64x64)
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = 64;
  roofCanvas.height = 64;
  const rCtx = roofCanvas.getContext('2d')!;
  rCtx.fillStyle = '#0c101a';
  rCtx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const sh = 22 + Math.floor(rand() * 18);
      rCtx.fillStyle = `rgb(${sh}, ${sh + 6}, ${sh + 18})`;
      rCtx.fillRect(x + 1, y + 1, 6, 6);
    }
  }
  const roofMap = configureTexture(roofCanvas, true, maxAniso, 4, 4, true);

  // 4. Stained Glass Lancet Window Texture (64x128 crisp PS2)
  const glassCanvas = document.createElement('canvas');
  glassCanvas.width = 64;
  glassCanvas.height = 128;
  const gCtx = glassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#090a10';
  gCtx.fillRect(0, 0, 64, 128);

  const grad = gCtx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#c2410c');
  grad.addColorStop(0.45, '#991b1b');
  grad.addColorStop(0.85, '#3b1c32');
  grad.addColorStop(1, '#1e1b4b');
  gCtx.fillStyle = grad;
  gCtx.beginPath();
  gCtx.moveTo(8, 120);
  gCtx.lineTo(8, 42);
  gCtx.quadraticCurveTo(32, 4, 56, 42);
  gCtx.lineTo(56, 120);
  gCtx.closePath();
  gCtx.fill();

  gCtx.strokeStyle = '#090a0f';
  gCtx.lineWidth = 3;
  gCtx.stroke();
  gCtx.beginPath();
  gCtx.moveTo(32, 14);
  gCtx.lineTo(32, 120);
  gCtx.moveTo(8, 62);
  gCtx.lineTo(56, 62);
  gCtx.moveTo(8, 90);
  gCtx.lineTo(56, 90);
  gCtx.stroke();

  const stainedGlassMap = configureTexture(glassCanvas, true, maxAniso, 1, 1, true);
  stainedGlassMap.wrapS = THREE.ClampToEdgeWrapping;
  stainedGlassMap.wrapT = THREE.ClampToEdgeWrapping;

  // 5. Cathedral Rose Window Texture (128x128 crisp PS2)
  const roseCanvas = document.createElement('canvas');
  roseCanvas.width = 128;
  roseCanvas.height = 128;
  const rwCtx = roseCanvas.getContext('2d')!;
  rwCtx.fillStyle = '#07080d';
  rwCtx.fillRect(0, 0, 128, 128);
  const rGrad = rwCtx.createRadialGradient(64, 64, 6, 64, 64, 58);
  rGrad.addColorStop(0, '#fbbf24');
  rGrad.addColorStop(0.35, '#dc2626');
  rGrad.addColorStop(0.75, '#581c87');
  rGrad.addColorStop(1, '#1e1b4b');
  rwCtx.fillStyle = rGrad;
  rwCtx.beginPath();
  rwCtx.arc(64, 64, 58, 0, Math.PI * 2);
  rwCtx.fill();

  rwCtx.strokeStyle = '#08090e';
  rwCtx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rwCtx.beginPath();
    rwCtx.moveTo(64, 64);
    rwCtx.lineTo(64 + Math.cos(a) * 59, 64 + Math.sin(a) * 59);
    rwCtx.stroke();
  }
  rwCtx.beginPath();
  rwCtx.arc(64, 64, 27, 0, Math.PI * 2);
  rwCtx.stroke();
  rwCtx.beginPath();
  rwCtx.arc(64, 64, 57, 0, Math.PI * 2);
  rwCtx.stroke();

  const roseWindowMap = configureTexture(roseCanvas, true, maxAniso, 1, 1, true);
  roseWindowMap.wrapS = THREE.ClampToEdgeWrapping;
  roseWindowMap.wrapT = THREE.ClampToEdgeWrapping;

  // 6. Soft Radial Contact Shadow Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const shCtx = shadowCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  shGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.35)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 64, 64);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);
  contactShadowMap.needsUpdate = true;

  // 7. Faint Guard Vision Cone Gradient Texture
  const coneCanvas = document.createElement('canvas');
  coneCanvas.width = 64;
  coneCanvas.height = 64;
  const cnCtx = coneCanvas.getContext('2d')!;
  const cnGrad = cnCtx.createRadialGradient(32, 32, 2, 32, 32, 31);
  cnGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  cnGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.14)');
  cnGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  cnCtx.fillStyle = cnGrad;
  cnCtx.fillRect(0, 0, 64, 64);
  const visionConeMap = new THREE.CanvasTexture(coneCanvas);
  visionConeMap.needsUpdate = true;

  // 8. Warm Streetlamp Pool Ground Texture
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = 64;
  poolCanvas.height = 64;
  const pCtx = poolCanvas.getContext('2d')!;
  const pGrad = pCtx.createRadialGradient(32, 32, 3, 32, 32, 31);
  pGrad.addColorStop(0, 'rgba(255, 194, 112, 0.28)');
  pGrad.addColorStop(0.55, 'rgba(255, 145, 55, 0.10)');
  pGrad.addColorStop(1, 'rgba(255, 120, 40, 0.0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);
  const lampPoolMap = new THREE.CanvasTexture(poolCanvas);
  lampPoolMap.colorSpace = THREE.SRGBColorSpace;
  lampPoolMap.magFilter = THREE.NearestFilter;
  lampPoolMap.needsUpdate = true;

  // 9. Eye Visibility Marker Textures (3 awareness states)
  const eyeClosedMap = createEyeMarkerTexture('closed');
  const eyeHalfMap = createEyeMarkerTexture('half');
  const eyeOpenMap = createEyeMarkerTexture('open');

  return {
    cobbleMap,
    cobbleBump,
    cobbleRoughness,
    stoneMap,
    roofMap,
    stainedGlassMap,
    roseWindowMap,
    contactShadowMap,
    visionConeMap,
    lampPoolMap,
    eyeClosedMap,
    eyeHalfMap,
    eyeOpenMap,
    dispose: () => {
      cobbleMap.dispose();
      cobbleBump.dispose();
      cobbleRoughness.dispose();
      stoneMap.dispose();
      roofMap.dispose();
      stainedGlassMap.dispose();
      roseWindowMap.dispose();
      contactShadowMap.dispose();
      visionConeMap.dispose();
      lampPoolMap.dispose();
      eyeClosedMap.dispose();
      eyeHalfMap.dispose();
      eyeOpenMap.dispose();
    },
  };
}
