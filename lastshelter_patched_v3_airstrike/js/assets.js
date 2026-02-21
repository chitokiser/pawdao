/* js/assets.js — image & sound loading */

const IMG = {};
const IMG_SRC = {
  stage:       "./images/stage.png",
  hero:        "./images/i.png",
  zombie1:     "./images/zombi.png",
  zombie2:     "./images/zombi2.png",
  boss:        "./images/boss.png",
  cardAllies:  "./images/allies_item.png",
  cardFireRate:"./images/fireRate_item.png",
  vp:          "./images/소실점표시.png",
};

function loadImages() {
  const keys = Object.keys(IMG_SRC);
  let loaded = 0;
  return new Promise((resolve) => {
    keys.forEach((k) => {
      const im = new Image();
      im.src = IMG_SRC[k];
      const done = () => { IMG[k] = im; if (++loaded === keys.length) resolve(); };
      im.onload  = done;
      im.onerror = done;
    });
  });
}

// ─── Sounds ──────────────────────────────────────────────────────────────────
const SOUND_SRC = {
  boom:   "./sound/boom.mp3",
  get:    "./sound/get.mp3",
  gun:    "./sound/gun2.mp3",
  mg:     "./sound/machine-gun.mp3",
  zombie: "./sound/zombie-sound.mp3",
  boss:   "./sound/zombie-boss.mp3",
  call:   "./sound/zombie-call.mp3",
};

function applyVolumes(SND) {
  try {
    if (SND.die)    SND.die.volume    = 0.18;
    if (SND.zombie) SND.zombie.volume = 0.12;
    if (SND.boss)   SND.boss.volume   = 0.14;
    if (SND.gun)    { SND.gun.volume  = 0.95; SND.gun.loop  = true; }
    if (SND.mg)     { SND.mg.volume   = 0.85; SND.mg.loop   = true; }
    if (SND.boom)   SND.boom.volume   = 0.9;
    if (SND.get)    SND.get.volume    = 0.9;
    if (SND.call)   SND.call.volume   = 0.75;
  } catch (e) {}
}

function loadSounds() {
  const keys = Object.keys(SOUND_SRC);
  let loaded = 0;
  const SND = {};
  return new Promise((resolve) => {
    keys.forEach((k) => {
      const a = new Audio();
      a.src = SOUND_SRC[k];
      a.preload = "auto";
      const done = () => {
        SND[k] = a;
        if (++loaded === keys.length) {
          applyVolumes(SND);
          state.sounds = SND;
          resolve(SND);
        }
      };
      a.addEventListener("canplaythrough", done, { once: true });
      a.addEventListener("error",          done, { once: true });
    });
  });
}
