// \baccarat\game.js (전체 교체)
let balance = 0; // 시작 전 0, START 누르면 100
let started = false;
let dealing = false;

let bets = { player: 0, banker: 0, tie: 0, ppair: 0, bpair: 0 };
let deck = [];

const balanceEl = document.getElementById('balance');
const resultEl = document.getElementById('result');

const soundBet = document.getElementById('sound-bet');
const soundWin = document.getElementById('sound-win');
const soundLose = document.getElementById('sound-lose');
const soundWind = document.getElementById('sound-wind');
const soundClick = document.getElementById('sound-click');

const btnStart = document.getElementById('start');
const btnDeal = document.getElementById('deal');
const btnReset = document.getElementById('reset');
const btnEnd = document.getElementById('end');

const shoeSlotEl = document.getElementById('shoeSlot');
const fxLayer = document.getElementById('fxLayer');
const scaleWrap = document.getElementById('scaleWrap');
const stage = document.getElementById('stage');

const playerHandEl = document.getElementById('player-hand');
const bankerHandEl = document.getElementById('banker-hand');

function getReturnUrl(){
  const u = new URL(location.href);
  return u.searchParams.get("return") || "../../mypage.html";
}

/* 스테이지를 화면에 맞춰 전체 축소(scale) */
function fitStageToViewport(){
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const pad = 12; // viewport padding (css와 맞추기)
  const targetW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-w')) || 390;
  const targetH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-h')) || 720;

  const maxW = vw - pad * 2;
  const maxH = vh - pad * 2;

  const s = Math.min(maxW / targetW, maxH / targetH, 1);
  scaleWrap.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitStageToViewport);
window.addEventListener('orientationchange', ()=>setTimeout(fitStageToViewport, 50));

function setUIEnabled(){
  document.querySelectorAll('.bet, .chip').forEach(el=>{
    el.style.pointerEvents = started ? 'auto' : 'none';
    el.style.opacity = started ? '1' : '.35';
  });
  btnDeal.disabled = !started;
  btnReset.disabled = !started;
  btnEnd.disabled = !started;
}

function lockBetDuringDeal(lock){
  dealing = lock;
  document.querySelectorAll('.bet, .chip').forEach(el=>{
    el.style.pointerEvents = (started && !dealing) ? 'auto' : 'none';
    el.style.opacity = (started && !dealing) ? '1' : '.70';
  });
  btnDeal.disabled = (!started || dealing);
  btnReset.disabled = (!started || dealing);
  btnEnd.disabled = (!started || dealing);
}

function resetRoundUI(){
  bets = { player: 0, banker: 0, tie: 0, ppair: 0, bpair: 0 };
  document.querySelectorAll('.chip-stack').forEach(stack=>stack.innerHTML = '');
  document.querySelectorAll('.bet').forEach(b=>b.classList.remove('active'));

  buildHandSlots(playerHandEl);
  buildHandSlots(bankerHandEl);

  resultEl.textContent = '';
}

/* hand 슬롯 3개를 항상 유지 */
function buildHandSlots(handEl){
  handEl.innerHTML = '';
  for(let i=0;i<3;i++){
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    slot.dataset.slotIndex = String(i);
    handEl.appendChild(slot);
  }
}

function getHandSlot(handEl, index){
  const slots = handEl.querySelectorAll('.card-slot');
  return slots[index] || null;
}

/* 덱 초기화 */
function initDeck() {
  const suits = ['H','D','C','S'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  deck = [];
  for(let d=0; d<6; d++){
    for(let s of suits){
      for(let v of values){
        deck.push({suit:s, value:v});
      }
    }
  }
  shuffle(deck);
}

/* 셔플 */
function shuffle(array) {
  for(let i=array.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/* 카드 값 계산 */
function getCardValue(card) {
  if(['J','Q','K','10'].includes(card.value)) return 0;
  if(card.value === 'A') return 1;
  return parseInt(card.value);
}
function calcTotal(hand){
  return hand.reduce((sum, card) => (sum + getCardValue(card)) % 10, 0);
}

/* 잔액 애니메이션 */
function animateBalance(newValue){
  const current = parseInt(balanceEl.textContent || "0");
  const diff = newValue - current;
  const step = diff / 20;
  let i = 0;
  function update(){
    if(i < 20){
      balanceEl.textContent = String(Math.round(current + step * i));
      i++;
      requestAnimationFrame(update);
    } else {
      balanceEl.textContent = String(newValue);
    }
  }
  update();
}

/* 칩 스택 추가 */
function addChipToStack(area, value){
  const stack = area.querySelector('.chip-stack');
  const chipImg = document.createElement('img');
  chipImg.className = 'stack-chip';

  let chipSrc;
  if(value === 10) chipSrc = "./images/chip_10.png";
  if(value === 50) chipSrc = "./images/chip_50.png";
  if(value === 100) chipSrc = "./images/chip_100.png";
  if(value === 500) chipSrc = "./images/chip_500.png";

  chipImg.src = chipSrc;
  const count = stack.childElementCount;
  chipImg.style.bottom = `${count * 4}px`;
  stack.appendChild(chipImg);
}

/* 카드 매핑 */
function mapCard(card){
  const valueMap = { A:'ace',2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',J:'jack',Q:'queen',K:'king' };
  const suitMap = { H:'hearts', D:'diamonds', C:'clubs', S:'spades' };
  return `${valueMap[card.value]}_of_${suitMap[card.suit]}.png`;
}

/* 플립 카드 생성 (flipDelay로 컨트롤) */
function createFlippableCard(card, flipDelayMs = 180) {
  const container = document.createElement('div');
  container.className = 'card-container';

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  const front = document.createElement('img');
  front.className = 'card-front';
  front.src = `https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/png/${mapCard(card)}`;
  front.style.background = '#fff';

  const back = document.createElement('div');
  back.className = 'card-back';
  back.style.background = '#fff';

  inner.appendChild(front);
  inner.appendChild(back);
  container.appendChild(inner);

  setTimeout(()=> inner.classList.add('flip'), flipDelayMs);
  return container;
}

function wait(ms){
  return new Promise(res=>setTimeout(res, ms));
}

/* 바카라 3장 룰 */
function baccaratDrawRule(player, banker){
  let pTotal = calcTotal(player);
  let bTotal = calcTotal(banker);

  if(pTotal >= 8 || bTotal >= 8) return { player, banker };

  if(pTotal <= 5) player.push(deck.pop());
  pTotal = calcTotal(player);

  if(player.length === 2){
    if(bTotal <= 5) banker.push(deck.pop());
  } else {
    const thirdCard = getCardValue(player[2]);
    if(bTotal <= 2) banker.push(deck.pop());
    else if(bTotal === 3 && thirdCard !== 8) banker.push(deck.pop());
    else if(bTotal === 4 && [2,3,4,5,6,7].includes(thirdCard)) banker.push(deck.pop());
    else if(bTotal === 5 && [4,5,6,7].includes(thirdCard)) banker.push(deck.pop());
    else if(bTotal === 6 && [6,7].includes(thirdCard)) banker.push(deck.pop());
  }

  return { player, banker };
}

/* 승패 라벨 */
function showWinLabel(text) {
  const label = document.createElement('div');
  label.className = 'win-label';
  label.textContent = text;
  stage.appendChild(label);
  setTimeout(() => label.remove(), 1500);
}

/* 승패 판정 */
function checkResult(playerHand, bankerHand){
  const playerTotal = calcTotal(playerHand);
  const bankerTotal = calcTotal(bankerHand);
  let result = '';

  if(playerTotal > bankerTotal) result = 'PLAYER WIN!';
  else if(bankerTotal > playerTotal) result = 'BANKER WIN!';
  else result = 'TIE!';

  showWinLabel(result);

  const playerPair = (playerHand.length >= 2 && getCardValue(playerHand[0]) === getCardValue(playerHand[1]));
  const bankerPair = (bankerHand.length >= 2 && getCardValue(bankerHand[0]) === getCardValue(bankerHand[1]));

  if(result.includes('PLAYER')) balance += bets.player * 2;
  if(result.includes('BANKER')) balance += bets.banker * 1.95;
  if(result.includes('TIE')) balance += bets.tie * 8;
  if(playerPair) balance += bets.ppair * 11;
  if(bankerPair) balance += bets.bpair * 11;

  animateBalance(Math.floor(balance));
  resultEl.textContent = result + (playerPair ? ' + P 페어!' : '') + (bankerPair ? ' + B 페어!' : '');

  const won =
    (result.includes('PLAYER') && bets.player > 0) ||
    (result.includes('BANKER') && bets.banker > 0) ||
    (result.includes('TIE') && bets.tie > 0) ||
    (playerPair && bets.ppair > 0) ||
    (bankerPair && bets.bpair > 0);

  if(won) soundWin.play().catch(()=>{});
  else soundLose.play().catch(()=>{});

  bets = { player: 0, banker: 0, tie: 0, ppair: 0, bpair: 0 };
  document.querySelectorAll('.chip-stack').forEach(stack=>stack.innerHTML = '');
  document.querySelectorAll('.bet').forEach(b=>b.classList.remove('active'));

  lockBetDuringDeal(false);
}

/* 슈박스 → 슬롯으로 카드 날리기 */
async function flyFromShoeToSlot(slotEl, cardObj){
  const start = shoeSlotEl.getBoundingClientRect();
  const end = slotEl.getBoundingClientRect();

  const sX = start.left + start.width * 0.5;
  const sY = start.top + start.height * 0.5;

  const eX = end.left + end.width * 0.5;
  const eY = end.top + end.height * 0.5;

  const fly = document.createElement('div');
  fly.className = 'fly-card';

  // 시작 위치(중심 기준으로 카드 크기 반영)
  fly.style.left = `${sX - end.width * 0.5}px`;
  fly.style.top  = `${sY - end.height * 0.5}px`;

  // 크기를 목표 슬롯 크기로 맞춤(모든 scale 상태에서도 잘 맞게)
  fly.style.width  = `${end.width}px`;
  fly.style.height = `${end.height}px`;

  fxLayer.appendChild(fly);

  // 첫 프레임 이후 이동
  await wait(16);

  const dx = (eX - sX);
  const dy = (eY - sY);

  fly.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${(Math.random()*10-5).toFixed(2)}deg)`;
  fly.style.opacity = '1';

  // 이동 완료 대기
  await new Promise(res=>{
    fly.addEventListener('transitionend', ()=>res(), { once:true });
  });

  fly.remove();

  // 도착 후 슬롯에 플립 카드 삽입
  slotEl.innerHTML = '';
  slotEl.appendChild(createFlippableCard(cardObj, 160));
}

/* START */
btnStart.addEventListener('click', ()=>{
  if(started) return;
  started = true;
  balance = 100;
  animateBalance(balance);
  resultEl.textContent = '게임 시작! 베팅 후 DEAL을 누르세요.';
  resetRoundUI();
  initDeck();
  setUIEnabled();
});

/* Deal: 딜러 느낌(번갈아 빠르게) + 슈박스에서 날아옴 */
btnDeal.addEventListener('click', async ()=>{
  if(!started){
    alert("START를 먼저 누르세요!");
    return;
  }
  if(dealing) return;

  if(Object.values(bets).every(v=>v===0)){
    alert("베팅 후 진행하세요!");
    return;
  }

  lockBetDuringDeal(true);
  resultEl.textContent = 'DEALING...';

  soundWind.currentTime = 0;
  soundWind.play().catch(()=>{});

  // 슬롯 재구성
  buildHandSlots(playerHandEl);
  buildHandSlots(bankerHandEl);

  const playerHand = [deck.pop(), deck.pop()];
  const bankerHand = [deck.pop(), deck.pop()];

  // 1장씩 번갈아(체감상 동시에)
  await flyFromShoeToSlot(getHandSlot(playerHandEl, 0), playerHand[0]);
  await wait(90);
  await flyFromShoeToSlot(getHandSlot(bankerHandEl, 0), bankerHand[0]);
  await wait(90);

  await flyFromShoeToSlot(getHandSlot(playerHandEl, 1), playerHand[1]);
  await wait(90);
  await flyFromShoeToSlot(getHandSlot(bankerHandEl, 1), bankerHand[1]);
  await wait(160);

  // 3장 룰 적용 후 추가 카드도 같은 방식
  const { player, banker } = baccaratDrawRule(playerHand, bankerHand);

  if(player.length === 3){
    await wait(140);
    await flyFromShoeToSlot(getHandSlot(playerHandEl, 2), player[2]);
  }
  if(banker.length === 3){
    await wait(140);
    await flyFromShoeToSlot(getHandSlot(bankerHandEl, 2), banker[2]);
  }

  await wait(650);
  checkResult(player, banker);
});

/* 칩 클릭 */
document.querySelectorAll('.chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    if(!started){
      alert("START를 먼저 누르세요!");
      return;
    }
    if(dealing) return;

    const activeBet = document.querySelector('.bet.active');
    if(!activeBet){
      alert("배팅 영역을 먼저 선택하세요!");
      return;
    }
    const value = parseInt(chip.dataset.value);
    const betKey = activeBet.id.replace('-bet','');

    if(balance >= value){
      balance -= value;
      bets[betKey] += value;
      animateBalance(balance);
      addChipToStack(activeBet, value);
      soundBet.currentTime = 0;
      soundBet.play().catch(()=>{});
    } else {
      alert("점수가 부족합니다!");
    }
  });
});

/* 배팅 영역 클릭 */
document.querySelectorAll('.bet').forEach(area=>{
  area.addEventListener('click', ()=>{
    if(!started){
      alert("START를 먼저 누르세요!");
      return;
    }
    if(dealing) return;

    soundClick.currentTime = 0;
    soundClick.play().catch(()=>{});

    document.querySelectorAll('.bet').forEach(b=>b.classList.remove('active'));
    area.classList.add('active');
  });
});

/* RESET */
btnReset.addEventListener('click', ()=>{
  if(!started){
    alert("START를 먼저 누르세요!");
    return;
  }
  if(dealing) return;

  balance = 100;
  animateBalance(balance);
  resetRoundUI();
  initDeck();
  resultEl.textContent = '리셋 완료. 베팅 후 DEAL을 누르세요.';
});

/* END */
btnEnd.addEventListener('click', async ()=>{
  if(!started){
    alert("START를 먼저 누르세요!");
    return;
  }
  if(dealing) return;

  const score = Math.floor(balance);
  try{
    const qs = new URLSearchParams(location.search);
    const gameId = qs.get("game") || "baccarat";
    const nonce = qs.get("nonce") || "";
    const ret = getReturnUrl();

    const address = window.ethereum?.selectedAddress;
    if(!nonce) throw new Error("nonce 없음: offchain에서 joinGame부터 하세요");
    if(!address) throw new Error("지갑 주소 없음: Rabby/MetaMask 연결을 확인하세요");

    const payload = `PAW_OFFCHAIN|${gameId}|${address}|${nonce}|${score}`;
    const sig = await window.ethereum.request({
      method: "personal_sign",
      params: [payload, address],
    });

    // localStorage 백업(디버그용)
    localStorage.setItem("paw_score_baccarat", String(score));
    localStorage.setItem("paw_sig_baccarat", sig);
    localStorage.setItem("paw_payload_baccarat", payload);

    const url = new URL(ret, location.href);
    url.searchParams.set("game", gameId);
    url.searchParams.set("score", String(score));
    url.searchParams.set("sig", sig);
    url.searchParams.set("payload", payload);
    location.href = url.toString();
  }catch(e){
    // 최소 동작: 점수만 저장하고 복귀
    localStorage.setItem("paw_score_baccarat", String(score));
    alert(e?.message || "END 저장 실패");
    location.href = getReturnUrl();
  }
});

/* 초기 */
buildHandSlots(playerHandEl);
buildHandSlots(bankerHandEl);
setUIEnabled();
initDeck();
animateBalance(balance);
fitStageToViewport();
