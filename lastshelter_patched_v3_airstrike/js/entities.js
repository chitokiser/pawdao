/* js/entities.js — wave/boss spawn, gate, ally formation */

// ─── Wave spawn ───────────────────────────────────────────────────────────────
function spawnWave() {
  state.wave += 1;

  const { left, right, top } = getRoadBounds();

  // stage1 wave1: 13~20 (절반)
  const baseMin     = 13;
  const baseMax     = 20;
  const stageGrowth = (state.stage - 1) * 6;
  const waveGrowth  = (state.wave  - 1) * 2;

  const minCount = baseMin + stageGrowth + waveGrowth;
  const maxCount = baseMax + stageGrowth + waveGrowth;
  const count    = Math.floor(rand(minCount, maxCount));

  const hpBase   = 90;
  const hpGrowth = 30;
  const hp       = hpBase + (state.stage - 1) * hpGrowth;
  const speedMul = 0.85;

  for (let i = 0; i < count; i++) {
    const baseSize = rand(TUNE.zombieSizeMin, TUNE.zombieSizeMax);
    const targetX  = rand(left + 16, right - 16);
    const cx       = (left + right) / 2;
    // 소실점 근처에서 스폰 → 작게 시작해 점점 커지면서 접근
    const y        = rand(top - 490, top - 420);
    const baseSpeed= rand(46, 86) + state.stage * 3;
    const spd      = baseSpeed * speedMul;

    state.zombies.push({
      x: cx, targetX, y,
      baseSize,
      size:  baseSize,
      scale: 1,
      hitR:  baseSize * TUNE.zombieHitMul,
      hp:    hp + rand(-3, 6),
      maxHp: hp,
      spd,
      type: Math.random() < 0.5 ? 1 : 2,
      swaySeed: rand(0, 9999),
    });
  }

  if (state.wave % state.bossEveryWaves === 0) {
    spawnBoss();
  }
}

// ─── Boss spawn ───────────────────────────────────────────────────────────────
function spawnBoss() {
  const { left, right, top } = getRoadBounds();
  const maxHp    = Math.round((11000 + (state.stage - 1) * 4500) / 3);
  const baseSize = TUNE.bossSize;

  state.boss = {
    x: (left + right) / 2,
    y: top - 500,
    baseSize,
    size:  baseSize * 0.04,
    scale: 0.04,
    hitR:  baseSize * 0.04 * TUNE.bossHitMul,
    hp: maxHp, maxHp,
    spd: 22 + state.stage * 2,
    stompT: 0,
    walkT:  0,
  };

  // 보스 등장 사운드 (zombie-boss.mp3)
  try {
    const s = state.sounds && state.sounds.boss;
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
  } catch (e) {}
  showToast("boss 등장");
}

// ─── Gate / card ──────────────────────────────────────────────────────────────
function makeGateOptions() {
  const opts = [
    { key: "add2",   label: "+2 allies",        icon: "cardAllies",  apply() { state.allies += 2; } },
    { key: "add5",   label: "+5 allies",        icon: "cardAllies",  apply() { state.allies += 5; } },
    { key: "rate",   label: "fire rate +20%",   icon: "cardFireRate",apply() { state.fireRate *= 1.2; } },
    { key: "dmg",    label: "damage +25%",      icon: null,          apply() { state.baseDmg *= 1.25; } },
    { key: "speed",  label: "bullet speed +15%",icon: null,          apply() { state.bulletSpeed *= 1.15; } },
    { key: "spread", label: "spread -15%",      icon: null,          apply() { state.spread *= 0.85; } },
    { key: "turret", label: "turret burst",     icon: null,          apply() { burstTurret(); } },
    { key: "nuke",   label: "airstrike +1",     icon: null,          apply() { grantAirstrike(1); } },
  ];

  function pickWeighted() {
    const roll = Math.random();
    if (roll < 0.55) return opts[Math.floor(Math.random() * 4)];
    if (roll < 0.88) return opts[4 + Math.floor(Math.random() * 2)];
    return opts[6 + Math.floor(Math.random() * 2)];
  }

  let a = pickWeighted();
  let b = pickWeighted();
  while (b.key === a.key) b = pickWeighted();
  return [a, b];
}

function spawnGate() {
  const { top } = getRoadBounds();
  const [optL, optR] = makeGateOptions();
  const cardHp = 50 + state.stage * 10;

  state.gate = {
    y: top - 490,   // 소실점 근처에서 시작
    baseW: 120, baseH: 44,
    speed: 70 + state.stage * 5,
    scale: 0.04,
    effW: 0, effH: 0,
    leftOpt:  optL, leftHp:  cardHp, leftMaxHp:  cardHp, leftDead:  false, leftX:  0, leftY:  0,
    rightOpt: optR, rightHp: cardHp, rightMaxHp: cardHp, rightDead: false, rightX: 0, rightY: 0,
  };
}

// ─── Ally formation ───────────────────────────────────────────────────────────
function getAllyPositions() {
  const { w, roadW, top, bottom } = getRoadBounds();

  const maxX    = roadW * 0.42;
  const leaderX = clamp(state.leaderX, -maxX, maxX);
  const leaderY = clamp(state.leaderY, top, bottom);

  const spacingX = 18;
  const spacingY = 18;

  const res = [];
  let remain = state.allies;
  let row = 0;
  while (remain > 0 && row < 6) {
    const cap  = 5 + row * 2;
    const take = Math.min(remain, cap);
    for (let i = 0; i < take; i++) {
      const offset = (i - (take - 1) / 2) * spacingX;
      res.push({ x: w / 2 + (leaderX + offset), y: leaderY + row * spacingY });
    }
    remain -= take;
    row += 1;
  }
  return res;
}
