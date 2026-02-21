// /suika/js/assets.js

import { FRUIT_LEVELS } from './config.js';

function svgDataUri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function makeFallbackSvg(r, seed = 0) {
  const s = r * 2;
  const cx = r;
  const cy = r;

  const palettes = [
    ['#ff4d6d', '#cc2b3f', '#ffe1e7'],
    ['#ffa53a', '#cc7b22', '#fff0d2'],
    ['#06d6a0', '#049c74', '#d9fff3'],
    ['#4dabf7', '#2b6fb5', '#ddf0ff'],
    ['#9b5de5', '#6e33b7', '#f0e6ff'],
  ];

  const p = palettes[seed % palettes.length];
  const base = p[0];
  const shade = p[1];
  const highlight = p[2];

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <radialGradient id="g" cx="30%" cy="25%" r="75%">
        <stop offset="0%" stop-color="${highlight}"/>
        <stop offset="55%" stop-color="${base}"/>
        <stop offset="100%" stop-color="${shade}"/>
      </radialGradient>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="${0.10 * r}" stdDeviation="${0.12 * r}" flood-color="rgba(0,0,0,0.22)"/>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <circle cx="${cx}" cy="${cy}" r="${r * 0.98}" fill="url(#g)"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.98}" fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="${Math.max(1, r * 0.08)}"/>
      <circle cx="${cx - 0.28 * r}" cy="${cy - 0.32 * r}" r="${r * 0.18}" fill="rgba(255,255,255,0.35)"/>
      <g opacity="0.9">
        <circle cx="${cx - 0.22 * r}" cy="${cy + 0.05 * r}" r="${0.09 * r}" fill="rgba(0,0,0,0.36)"/>
        <circle cx="${cx + 0.22 * r}" cy="${cy + 0.05 * r}" r="${0.09 * r}" fill="rgba(0,0,0,0.36)"/>
        <path d="M ${cx - 0.16 * r} ${cy + 0.22 * r} C ${cx - 0.05 * r} ${cy + 0.30 * r}, ${cx + 0.05 * r} ${cy + 0.30 * r}, ${cx + 0.16 * r} ${cy + 0.22 * r}"
          stroke="rgba(0,0,0,0.30)" stroke-width="${Math.max(1, 0.07 * r)}" fill="none" stroke-linecap="round"/>
      </g>
    </g>
  </svg>`;

  const img = new Image();
  img.src = svgDataUri(svg);
  return img;
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, img });
    img.onerror = () => resolve({ ok: false, img: null });
    img.src = url;
  });
}

export async function loadFruitImages() {
  // 우선 images 폴더 로드 시도, 실패하면 폴백 SVG
  const images = [];
  for (let i = 0; i < FRUIT_LEVELS.length; i++) {
    const file = FRUIT_LEVELS[i].img;
    const url = `./images/${file}`;
    const res = await loadImage(url);
    if (res.ok) {
      images.push(res.img);
    } else {
      images.push(makeFallbackSvg(FRUIT_LEVELS[i].r, i));
    }
  }
  return images;
}
