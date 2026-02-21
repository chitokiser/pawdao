// /suika/js/config.js

export const GAME = {
  mergeCount: 3,
  deadFrames: 35,
  spawnBelowDeadPx: 70,
  dropCooldownFrames: 10,
  physicsIterations: 6,
  maxSpeed: 16,
  // 합체 판정 여유(픽셀). 물리 충돌 해소 후 정확히 '접촉' 상태가 많아서
  // 0이면 합체가 안 되는 것처럼 보일 수 있음.
  mergeTouchPaddingPx: 2.5,
};

export const PHYS = {
  g: 0.42,
  air: 0.998,
  wallRest: 0.55,
  floorRest: 0.08,
  ballRest: 0.08,
  friction: 0.985,
};

// 10단계 (마지막이 수박)
// 파일이 존재하면 images/ 아래 파일을 사용하고, 없으면 SVG로 폴백합니다.
export const FRUIT_LEVELS = [
  { name: 'cherry',  r: 18, img: 'fruit_0.png' },
  { name: 'straw',   r: 22, img: 'fruit_1.png' },
  { name: 'orange',  r: 26, img: 'fruit_2.png' },
  { name: 'lemon',   r: 31, img: 'fruit_3.png' },
  { name: 'kiwi',    r: 36, img: 'fruit_4.png' },
  { name: 'blue',    r: 42, img: 'fruit_5.png' },
  { name: 'grape',   r: 50, img: 'fruit_6.png' },
  { name: 'peach',   r: 60, img: 'fruit_7.png' },
  { name: 'apple',   r: 72, img: 'fruit_8.png' },
  { name: 'water',   r: 86, img: 'fruit_9.png' },
];

// 사운드 파일 매핑 (sounds/ 폴더)
// 파일이 없으면 WebAudio(톤)로 폴백
// sounds/ 폴더에 mp3 또는 wav 둘 다 지원
// 예) drop.mp3 또는 drop.wav 중 아무거나 있으면 재생
export const SFX_BASE = {
  drop: 'drop',
  hit: 'hit',
  merge: 'merge',
  over: 'over',
};
