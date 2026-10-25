// Cosmetic only: persistence completes before this animation starts.
// 調整用: 時間はミリ秒、距離・幅はpx。全体時間と各段階の時刻は自動計算する。
const TRANSFER_MOTION = {
  travelMs: 350,       // 登録先の少し上まで移動する時間
  holdMs: 600,         // 溜めながらゆっくり浮上する時間
  insertMs: 100,       // 下へ差し込む時間
  flashMs: 50,         // 差し込み後、光が最大になるまでの時間
  settleMs: 200,       // 光を戻す／図鑑へ消える時間
  offscreenMs: 420,    // 登録先が画面外にある場合の移動時間
  arrivalLiftPx: 14,   // 到着時、登録先より上に浮かせる距離
  holdRisePx: 7,       // 溜め中にさらに浮上する距離
  maxWidthPx: 88,      // 飛び出すコピーの最大幅
  compactScale: .65,  // 図鑑・画面外へ向かうコピーの到着時倍率
  vanishScale: .2,    // 図鑑へ消える直前の倍率
  flashBrightness: 1.5, // 発光の明るさ（1が通常）
  travelEasing: 'cubic-bezier(.2,.7,.3,1)',
  insertEasing: 'cubic-bezier(.7,0,1,1)'
};

export function installTransfer(root, page, createCartridge, enabled) {
  let flight = null, animation = null, target = null, frame = null;
  function cancel() {
    cancelAnimationFrame(frame); frame = null;
    animation?.cancel(); animation = null;
    flight?.remove(); flight = null;
    target?.classList.remove('is-arriving'); target = null;
  }
  function start(ep, sourceRect, destination, dex) {
    frame = null;
    if (!sourceRect || !destination?.isConnected || !enabled()) return;
    const end = destination.getBoundingClientRect();
    if (!end.width || !sourceRect.width) return;
    // Partial visibility is not an above-screen destination.
    const visible = end.bottom > 0 && end.top < innerHeight && end.right > 0 && end.left < innerWidth;
    const motion = TRANSFER_MOTION;
    const width = Math.min(motion.maxWidthPx, end.width, sourceRect.width), height = width * 7 / 6;
    const startX = sourceRect.left + sourceRect.width / 2 - width / 2;
    const sourceY = sourceRect.top - (sourceRect.documentPosition ? scrollY : 0);
    const startY = Math.max(-height, Math.min(innerHeight, sourceY + sourceRect.height / 2 - height / 2));
    const x = end.left + end.width / 2 - width / 2;
    const y = visible ? end.top + end.height / 2 - height / 2 : (end.bottom <= 0 ? -height * 2 : innerHeight + height);
    const dx = x - startX, dy = y - startY, scale = !dex && visible ? end.width / width : motion.compactScale;
    const pose = (lift = 0, size = scale) => `translate(${dx}px,${dy - lift}px) scale(${size})`;
    flight = document.createElement('div'); flight.className = 'lab-transfer'; flight.setAttribute('aria-hidden', 'true');
    flight.style.cssText = `left:${startX}px;top:${startY}px;width:${width}px`;
    flight.append(createCartridge(ep, true)); root.append(flight);
    if (visible && !dex) { target = destination; target.classList.add('is-arriving'); }
    const arrivedAt = motion.travelMs;
    const heldAt = arrivedAt + motion.holdMs;
    const insertedAt = heldAt + motion.insertMs;
    const flashedAt = insertedAt + motion.flashMs;
    const totalMs = flashedAt + motion.settleMs;
    const frames = visible ? [
      {transform:'translate(0,0) scale(1)', opacity:1, offset:0, easing:motion.travelEasing},
      {transform:pose(motion.arrivalLiftPx), opacity:1, offset:arrivedAt/totalMs, easing:'linear'},
      {transform:pose(motion.arrivalLiftPx + motion.holdRisePx), opacity:1, offset:heldAt/totalMs, easing:motion.insertEasing},
      {transform:pose(), opacity:1, filter:'brightness(1)', offset:insertedAt/totalMs},
      {transform:pose(), opacity:1, filter:`brightness(${motion.flashBrightness})`, offset:flashedAt/totalMs},
      {transform:pose(0, dex ? motion.vanishScale : scale), opacity:dex ? 0 : 1, filter:'brightness(1)', offset:1}
    ] : [
      {transform:'translate(0,0) scale(1)', opacity:1},
      {transform:pose(), opacity:0}
    ];
    animation = flight.animate(frames, {duration:visible ? totalMs : motion.offscreenMs, easing:'linear', fill:'forwards'});
    const current = animation;
    current.finished.then(() => { if (animation === current) cancel(); }).catch(() => {});
  }
  function fly(ep, sourceRect, destination, dex = false) {
    cancel();
    if (!enabled()) return;
    // Dialog closing/focus restoration settles before measuring the destination.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => start(ep, sourceRect, destination, dex));
    });
  }
  // Closing a dialog can scroll before start; only active flights are stale.
  page.listen(window, 'scroll', () => { if (animation) cancel(); }, {passive:true, capture:true});
  page.listen(window, 'resize', cancel);
  page.listen(document, 'visibilitychange', cancel);
  page.onDispose(cancel);
  return {fly, cancel};
}
