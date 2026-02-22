/* js/state.js — TUNE constants, game state, reset, getRoadBounds */

const TUNE = {
  heroSize:      55,
  allySize:      48,
  zombieSizeMin:  43,
  zombieSizeMax:  55,
  bossSize:      260,

  heroHitMul:   0.26,
  allyHitMul:   0.24,
  zombieHitMul: 0.26,
  bossHitMul:   0.28,

  stageScrollSpeed: 120,
  parallaxXMul:     0.18,
  parallaxYMul:     0.06,

  smokeSpawnPerSec: 6,

  pickupSize: 46,
  pickupHitR: 18,
};

const state = {
  running: false,
  paused:  false,
  time:    0,
  stage:   1,
  wave:    0,

  roadW: 420,

  leaderX: 0,
  leaderY: 0,
  targetX: 0,
  targetY: 0,

  moveSpeed: 420,

  allies:      1,
  baseDmg:    10,
  fireRate:    6,
  bulletSpeed: 720,
  spread:      0.06,

  bullets:   [],
  zombies:   [],
  particles: [],
  smokes:    [],

  gate: null,
  gateCooldown: 0,

  boss: null,
  bossEveryWaves: 5,

  stageScroll: 0,
  smokeAcc:    0,

  // airstrike
  airCharges: 0,
  airDropCd:  0,
  pickups:    [],
  airAnim:    null,
  flashT:     0,
  muzzleFlashes: [],

  // freeze
  freezeCharges: 0,
  freezeT:       0,
  freezeDropCd:  0,

  // claymore
  claymoreCharges: 0,

  iframes: 0,        // 무적 시간(초) — 접촉 사망 후 5초

  isFiring: false,   // 스페이스바 / 발사버튼 누르는 동안 true

  score:     0,      // 누적 점수 (좀비 처치 + 보스 보너스)
  killCount: 0,      // 누적 처치 수

  dieSoundCd: 0,

  // camera shake
  shakeT:    0,
  shakeTMax: 0,
  shakeMag:  0,

  sounds:      null,
  assetsReady: false,
};

function reset() {
  // stop gun sound
  try {
    const s = state.sounds && (state.sounds.gun || state.sounds.mg);
    if (s && !s.paused) s.pause();
  } catch (e) {}

  state.running = false;
  state.paused  = false;
  state.time    = 0;
  state.stage   = 1;
  state.wave    = 0;

  state.leaderX = 0;
  state.leaderY = 0;
  state.targetX = 0;
  state.targetY = 0;

  state.moveSpeed  = 420;
  state.allies     = 1;
  state.baseDmg    = 10;
  state.fireRate   = 6;
  state.bulletSpeed= 720;
  state.spread     = 0.06;

  state.bullets.length   = 0;
  state.zombies.length   = 0;
  state.particles.length = 0;
  state.smokes.length    = 0;
  state.muzzleFlashes.length = 0;

  state.gate         = null;
  state.gateCooldown = 10.0;
  state.boss         = null;

  state.stageScroll = 0;
  state.smokeAcc    = 0;

  state.airCharges = 3;  // 시작 기본 지급
  state.airDropCd  = 0;
  state.pickups.length = 0;
  state.airAnim    = null;
  state.flashT     = 0;

  state.freezeCharges   = 3;  // 시작 기본 지급
  state.freezeT         = 0;
  state.freezeDropCd    = 0;
  state.claymoreCharges = 3;  // 시작 기본 지급

  state.iframes    = 0;
  state.isFiring   = false;
  state.score      = 0;
  state.killCount  = 0;
  state.dieSoundCd = 0;
  state.shakeT     = 0;
  state.shakeTMax  = 0;
  state.shakeMag   = 0;

  uiStage.textContent  = state.stage;
  uiAllies.textContent = state.allies;
  uiDps.textContent    = Math.round(state.allies * state.baseDmg * state.fireRate);
  if (uiAir)      uiAir.textContent      = state.airCharges;
  if (uiFreeze)   uiFreeze.textContent   = state.freezeCharges;
  if (uiClaymore) uiClaymore.textContent = state.claymoreCharges;
}

function getRoadBounds() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  const roadW = Math.min(state.roadW, w - 24);
  const left  = (w - roadW) / 2;
  const right = left + roadW;
  const top    = h * 0.45;
  const bottom = h * 0.88;

  return { w, h, roadW, left, right, top, bottom };
}
