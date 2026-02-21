// /suika/js/physics.js

import { PHYS, GAME } from './config.js';

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function bucket(canvas) {
  const topUI = 44;
  const padTop = 10;
  const margin = 18;
  const left = margin;
  const right = canvas.width - margin;
  const top = topUI + padTop;
  const bottom = canvas.height - margin;
  const radius = 28;
  return { left, right, top, bottom, radius };
}

export function deadY(canvas) {
  const b = bucket(canvas);
  return b.top + 34;
}

export function resolveBallBall(a, b, audio, vibrate) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minD = a.r + b.r;
  if (dist === 0 || dist >= minD) return false;

  const nx = dx / dist;
  const ny = dy / dist;

  const overlap = minD - dist;
  const total = a.m + b.m;
  const moveA = overlap * (b.m / total);
  const moveB = overlap * (a.m / total);

  a.x -= nx * moveA;
  a.y -= ny * moveA;
  b.x += nx * moveB;
  b.y += ny * moveB;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const rel = rvx * nx + rvy * ny;
  if (rel > 0) return true;

  const e = PHYS.ballRest;
  const j = (-(1 + e) * rel) / (1 / a.m + 1 / b.m);

  const ix = j * nx;
  const iy = j * ny;

  a.vx -= ix / a.m;
  a.vy -= iy / a.m;
  b.vx += ix / b.m;
  b.vy += iy / b.m;

  if (audio) audio.play('hit');
  if (vibrate) vibrate(6);
  return true;
}

function collideWithCircle(ball, cx, cy, cr, restitution, audio, vibrate) {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const dist = Math.hypot(dx, dy);
  const minD = ball.r + cr;
  if (dist === 0 || dist >= minD) return false;

  const nx = dx / dist;
  const ny = dy / dist;

  const overlap = minD - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
    ball.vx *= 0.98;
    ball.vy *= 0.98;
    ball.av *= 0.98;
    if (audio) audio.play('hit');
    if (vibrate) vibrate(6);
  }
  return true;
}

export function resolveBucket(canvas, ball, audio, vibrate) {
  const b = bucket(canvas);

  const wallTop = b.top;
  const wallBottom = b.bottom - b.radius;

  if (ball.y > wallTop && ball.y < wallBottom) {
    if (ball.x - ball.r < b.left) {
      ball.x = b.left + ball.r;
      if (ball.vx < 0) ball.vx = -ball.vx * PHYS.wallRest;
    }
    if (ball.x + ball.r > b.right) {
      ball.x = b.right - ball.r;
      if (ball.vx > 0) ball.vx = -ball.vx * PHYS.wallRest;
    }
  }

  const floorY = b.bottom;
  const floorLeft = b.left + b.radius;
  const floorRight = b.right - b.radius;

  if (ball.x > floorLeft && ball.x < floorRight) {
    if (ball.y + ball.r > floorY) {
      ball.y = floorY - ball.r;
      if (ball.vy > 0) ball.vy = -ball.vy * PHYS.floorRest;
      ball.vx *= PHYS.friction;
      ball.av *= PHYS.friction;
    }
  }

  const lcX = b.left + b.radius;
  const lcY = b.bottom - b.radius;
  const rcX = b.right - b.radius;
  const rcY = b.bottom - b.radius;

  collideWithCircle(ball, lcX, lcY, b.radius, 0.25, audio, vibrate);
  collideWithCircle(ball, rcX, rcY, b.radius, 0.25, audio, vibrate);
}

export function isOverlapping(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  // 물리 충돌 해소 후 정확히 '닿아있는' 상태(dist ≈ r+r)가 많음.
  // 그래서 약간의 여유를 줘서 3개 합체가 자연스럽게 발생하도록 함.
  const pad = GAME.mergeTouchPaddingPx ?? 2.5;
  return dist > 0 && dist <= (a.r + b.r + pad);
}
