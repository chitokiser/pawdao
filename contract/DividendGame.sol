// /contracts/DividendGame.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function balanceOf(address account) external view returns (uint256);

  // 주의: ERC20 표준은 uint256 반환입니다 (기존 bool은 컴파일/연동에서 문제)
  function allowance(address owner, address spender) external view returns (uint256);
  function approve(address spender, uint256 amount) external returns (bool);
}

interface IPupBank {
  function totalfeeup(uint256 amount) external;
}

/*
요구사항 반영: deposit 시점에 ratio(분자/분모)를 리셋

핵심 변경점
- deposit(amount) 호출 시:
  - 유저의 numerator/denominator를 기본값(10000 / 10000*10000)으로 리셋
  - pendingGame 상태도 같이 해제(안전하게 꼬임 방지)
  - RatioReset 이벤트 추가
*/

contract DividendGame {
  IERC20 public immutable HEX;
  IPupBank public pupbank;
  address public owner;

  uint256 public constant DAY = 24 hours;

  // pendingGame 타임아웃 (기본 1시간)
  uint256 public pendingTimeout = 1 hours;

  uint256 public taxThreshold = 10e18;
  uint256 public taxPool;

  uint256 public constant BASE_NUM = 10000;
  uint256 public constant BASE_DEN = 10000 * 10000;

  struct UserInfo {
    uint256 deposited;
    uint256 totalPaid;     // 세전 누적 배당 (10배 캡 기준)
    uint256 lastClaimAt;
    bool champion;

    bool pendingGame;
    uint256 pendingAt;     // pending 시작 시각 (타임아웃 체크용)

    uint256 numerator;     // 개인 분자
    uint256 denominator;   // 개인 분모
  }

  mapping(address => UserInfo) public user;

  // family auth: 외부 호출자 권한
  mapping(address => uint256) public fa;

  uint256 private _locked;

  event OwnershipTransferred(address indexed prev, address indexed next);
  event Deposited(address indexed user, uint256 amount);
  event Claimed(address indexed user, uint256 gross, uint256 tax, uint256 net);
  event BecameChampion(address indexed user, uint256 deposited, uint256 totalPaid);

  event PendingAutoCleared(address indexed user);
  event GameJoined(address indexed user, uint256 newNumerator, uint256 newDenominator);
  event GameSaved(address indexed user, uint256 score, uint256 newNumerator);

  event OnChainGameApplied(address indexed caller, address indexed user, uint256 score, uint256 newNumerator);

  event TaxFlushed(uint256 amount, address pupbank);
  event PendingTimeoutChanged(uint256 seconds_);
  event TaxThresholdChanged(uint256 v);
  event PupBankChanged(address pupbank);

  // 추가: deposit 시 ratio 리셋 이벤트
  event RatioReset(address indexed user, uint256 numerator, uint256 denominator);

  modifier onlyOwner() {
    require(msg.sender == owner, "OWN: not owner");
    _;
  }

  modifier nonReentrant() {
    require(_locked == 0, "REENTRANT");
    _locked = 1;
    _;
    _locked = 0;
  }

  constructor(address hexToken, address pupbank_) {
    require(hexToken != address(0), "HEX: zero");
    owner = msg.sender;
    HEX = IERC20(hexToken);
    pupbank = IPupBank(pupbank_);
    emit OwnershipTransferred(address(0), msg.sender);
  }

  function transferOwnership(address next) external onlyOwner {
    require(next != address(0), "OWN: zero");
    emit OwnershipTransferred(owner, next);
    owner = next;
  }

  function setPupBank(address pupbank_) external onlyOwner {
    require(pupbank_ != address(0), "PUP: zero");
    pupbank = IPupBank(pupbank_);
    emit PupBankChanged(pupbank_);
  }

  function setTaxThreshold(uint256 v) external onlyOwner {
    taxThreshold = v;
    emit TaxThresholdChanged(v);
  }

  function setPendingTimeout(uint256 seconds_) external onlyOwner {
    require(seconds_ >= 60, "TIMEOUT: too small");
    pendingTimeout = seconds_;
    emit PendingTimeoutChanged(seconds_);
  }

  // 외부 호출자 권한 부여
  function setfa(address _fa) external onlyOwner {
    fa[_fa] = 10;
  }

  function delfa(address _fa) external onlyOwner {
    fa[_fa] = 0;
  }

  // 내부: 유저 기본 ratio 초기화(처음 1회)
  function _initUser(address a) internal {
    UserInfo storage u = user[a];
    if (u.denominator == 0) {
      u.numerator = BASE_NUM;
      u.denominator = BASE_DEN;
    }
  }

  // 내부: ratio 강제 리셋 (deposit 시 사용)
  function _resetRatio(address a) internal {
    UserInfo storage u = user[a];
    u.numerator = BASE_NUM;
    u.denominator = BASE_DEN;

    // deposit으로 상태가 바뀌는 순간 pending 꼬임 방지용으로 해제
    if (u.pendingGame) {
      u.pendingGame = false;
      u.pendingAt = 0;
      emit PendingAutoCleared(a);
    }

    emit RatioReset(a, u.numerator, u.denominator);
  }

  // 내부: pendingGame 타임아웃 자동 해제
  function _autoUnlock(address a) internal {
    UserInfo storage u = user[a];
    if (!u.pendingGame) return;

    if (u.pendingAt == 0) {
      u.pendingGame = false;
      emit PendingAutoCleared(a);
      return;
    }

    if (block.timestamp > u.pendingAt + pendingTimeout) {
      u.pendingGame = false;
      u.pendingAt = 0;
      emit PendingAutoCleared(a);
    }
  }

  // 1) deposit
  // 변경: deposit 시점에 ratio 리셋
  function deposit(uint256 amount) external nonReentrant {
    require(amount >= 1e18, "DEPOSIT: >= 1 HEX");
    require(HEX.transferFrom(msg.sender, address(this), amount), "DEPOSIT: transferFrom fail");

    _initUser(msg.sender);
    _autoUnlock(msg.sender);

    UserInfo storage u = user[msg.sender];
    require(!u.champion, "USER: champion");

    // 여기서 리셋
    _resetRatio(msg.sender);

    u.deposited += amount;
    if (u.lastClaimAt == 0) u.lastClaimAt = block.timestamp;

    emit Deposited(msg.sender, amount);
  }

  // 2) 배당파워
  function dividendPower(address a) public view returns (uint256) {
    UserInfo storage u = user[a];
    if (u.deposited == 0) return 0;
    if (u.denominator == 0) return 0;
    return (u.deposited * (u.numerator + 1)) / u.denominator;
  }

  // 3) claim (24h)
  function claim() external nonReentrant {
    _initUser(msg.sender);
    _autoUnlock(msg.sender);

    UserInfo storage u = user[msg.sender];
    require(u.deposited >= 1e18, "CLAIM: deposit first");
    require(!u.champion, "CLAIM: champion");
    require(block.timestamp >= u.lastClaimAt + DAY, "CLAIM: wait 24h");

    uint256 power = dividendPower(msg.sender);
    require(power > 0, "CLAIM: power=0");

    uint256 available = HEX.balanceOf(address(this));
    require(available > 0, "CLAIM: empty");

    uint256 maxPay = u.deposited * 10;

    if (u.totalPaid >= maxPay) {
      u.champion = true;
      emit BecameChampion(msg.sender, u.deposited, u.totalPaid);
      revert("CLAIM: reached 10x");
    }

    uint256 remaining = maxPay - u.totalPaid;

    uint256 gross = power;
    if (gross > available) gross = available;
    if (gross > remaining) gross = remaining;
    require(gross > 0, "CLAIM: gross=0");

    uint256 tax = gross / 10;
    uint256 net = gross - tax;

    u.totalPaid += gross;
    u.lastClaimAt = block.timestamp;

    taxPool += tax;

    require(HEX.transfer(msg.sender, net), "CLAIM: transfer fail");
    emit Claimed(msg.sender, gross, tax, net);

    if (u.totalPaid >= maxPay) {
      u.champion = true;
      emit BecameChampion(msg.sender, u.deposited, u.totalPaid);
    }

    _flushTaxIfNeeded();
  }

  // 6) joinGame: 개인 numerator/denominator 업데이트 + pending 시작
  function joinGame() external {
    _initUser(msg.sender);
    _autoUnlock(msg.sender);

    UserInfo storage u = user[msg.sender];
    require(u.deposited >= 1e18, "GAME: deposit first");
    require(!u.champion, "GAME: champion");
    require(!u.pendingGame, "GAME: pending");

    require(u.numerator >= 100, "GAME: numerator low");

    u.numerator -= 100;
    u.denominator += 100;

    u.pendingGame = true;
    u.pendingAt = block.timestamp;

    emit GameJoined(msg.sender, u.numerator, u.denominator);
  }

  // 7) saveGame: pending 상태에서만 점수 반영
  function saveGame(uint256 gameScore) external {
    _initUser(msg.sender);
    _autoUnlock(msg.sender);

    UserInfo storage u = user[msg.sender];
    require(u.pendingGame, "SAVE: not joined");

    require(gameScore <= 10000, "SAVE: score too big");

    u.numerator += gameScore;

    u.pendingGame = false;
    u.pendingAt = 0;

    emit GameSaved(msg.sender, gameScore, u.numerator);
  }

  // 외부 호출 온체인 게임 반영
  function onChainGame(address _user, uint256 score) external {
    require(fa[msg.sender] >= 5, "no family");
    require(_user != address(0), "USER: zero");

    _initUser(_user);
    _autoUnlock(_user);

    UserInfo storage u = user[_user];
    require(!u.champion, "USER: champion");

    require(score <= 100000, "SCORE: too big");

    u.numerator += score;

    emit OnChainGameApplied(msg.sender, _user, score, u.numerator);
  }

  function myPending() external view returns (bool pending, uint256 pendingAt, uint256 timeoutSeconds) {
    UserInfo storage u = user[msg.sender];
    return (u.pendingGame, u.pendingAt, pendingTimeout);
  }

  // 9) tax flush
  function _flushTaxIfNeeded() internal {
    if (taxPool <= taxThreshold) return;

    uint256 amount = taxPool;
    taxPool = 0;

    require(HEX.transfer(address(pupbank), amount), "TAX: transfer fail");
    pupbank.totalfeeup(amount);

    emit TaxFlushed(amount, address(pupbank));
  }

  function flushTax() external nonReentrant {
    _flushTaxIfNeeded();
  }

  function contractHexBalance() external view returns (uint256) {
    return HEX.balanceOf(address(this));
  }
}
