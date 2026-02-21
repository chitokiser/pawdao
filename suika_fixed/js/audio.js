// /suika/js/audio.js

import { SFX_BASE } from './config.js';

export function createAudio() {
  // 파일 기반 오디오 우선. 없으면 WebAudio 톤 폴백.
  const pools = new Map();
  const cool = new Map();

  let audioCtx = null;
  let audioUnlocked = false;
  let useFiles = true;

  function unlock() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // WebAudio 준비
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioCtx = null;
    }

    // 파일 오디오도 첫 제스처에서 play() 가능하도록 0볼륨 프라이밍
    for (const [key, pool] of pools.entries()) {
      for (const a of pool) {
        try {
          a.volume = 0;
          const p = a.play();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              a.pause();
              a.currentTime = 0;
              a.volume = 1;
            }).catch(() => {
              // 브라우저 정책이면 WebAudio로 폴백
              useFiles = false;
            });
          } else {
            a.pause();
            a.currentTime = 0;
            a.volume = 1;
          }
        } catch {
          useFiles = false;
        }
      }
    }
  }

  function tone(freq = 440, dur = 0.06, type = 'sine', gain = 0.04) {
    if (!audioUnlocked || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }

  const fallback = {
    drop() { tone(280, 0.05, 'triangle', 0.045); },
    hit() { tone(180, 0.03, 'square', 0.022); },
    merge() {
      tone(520, 0.07, 'sine', 0.05);
      setTimeout(() => tone(720, 0.06, 'sine', 0.045), 45);
    },
    over() { tone(140, 0.18, 'sawtooth', 0.06); },
  };

  function buildPool(key, base, size = 6) {
    const list = [];
    for (let i = 0; i < size; i++) {
      // mp3 우선, 실패 시 wav로 자동 전환
      const a = new Audio(`./sounds/${base}.mp3`);
      a.preload = 'auto';
      a.volume = 0.9;

      a.addEventListener('error', () => {
        // mp3가 없거나 로드 실패 → wav 시도
        try {
          if (!a.__fallbackTried) {
            a.__fallbackTried = true;
            a.src = `./sounds/${base}.wav`;
            a.load();
          } else {
            // wav도 실패 → 파일 모드 포기
            useFiles = false;
          }
        } catch {
          useFiles = false;
        }
      }, { once: false });

      list.push(a);
    }
    pools.set(key, list);
  }

  // 파일 풀 구성
  for (const [k, base] of Object.entries(SFX_BASE)) {
    buildPool(k, base);
  }

  function playFile(key) {
    const pool = pools.get(key);
    if (!pool) return;

    // 너무 많은 겹침으로 깨지는 것 방지: cooldown
    const now = performance.now();
    const cd = cool.get(key) ?? 0;
    if (now < cd) return;

    // hit는 충돌이 너무 많아져서 깨지기 쉬움 → 더 강한 쿨다운
    const next = key === 'hit' ? 30 : 15;
    cool.set(key, now + next);

    // 사용 가능한 오디오 찾기
    let a = pool.find((x) => x.paused || x.ended);
    if (!a) a = pool[0];

    try {
      a.currentTime = 0;
      a.play();
    } catch {
      useFiles = false;
    }
  }

  function play(key) {
    if (!audioUnlocked) return;
    if (useFiles) {
      playFile(key);
      return;
    }
    const f = fallback[key];
    if (f) f();
  }

  return { unlock, play };
}
