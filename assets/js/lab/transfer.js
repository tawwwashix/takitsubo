// Cosmetic only: persistence completes before this animation starts.
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
    const width = Math.min(88, end.width, sourceRect.width), height = width * 7 / 6;
    const startX = sourceRect.left + sourceRect.width / 2 - width / 2;
    const sourceY = sourceRect.top - (sourceRect.documentPosition ? scrollY : 0);
    const startY = Math.max(-height, Math.min(innerHeight, sourceY + sourceRect.height / 2 - height / 2));
    const x = end.left + end.width / 2 - width / 2;
    const y = visible ? end.top + end.height / 2 - height / 2 : (end.bottom <= 0 ? -height * 2 : innerHeight + height);
    const dx = x - startX, dy = y - startY, scale = !dex && visible ? end.width / width : .65;
    const pose = (lift = 0, size = scale) => `translate(${dx}px,${dy - lift}px) scale(${size})`;
    flight = document.createElement('div'); flight.className = 'lab-transfer'; flight.setAttribute('aria-hidden', 'true');
    flight.style.cssText = `left:${startX}px;top:${startY}px;width:${width}px`;
    flight.append(createCartridge(ep, true)); root.append(flight);
    if (visible && !dex) { target = destination; target.classList.add('is-arriving'); }
    const frames = visible ? [
      {transform:'translate(0,0) scale(1)', opacity:1, offset:0, easing:'cubic-bezier(.2,.7,.3,1)'},
      {transform:pose(14), opacity:1, offset:350/1700, easing:'linear'},
      {transform:pose(21), opacity:1, offset:1350/1700, easing:'cubic-bezier(.7,0,1,1)'},
      {transform:pose(), opacity:1, filter:'brightness(1)', offset:1450/1700},
      {transform:pose(), opacity:1, filter:'brightness(1.5)', offset:1500/1700},
      {transform:pose(0, dex ? .2 : scale), opacity:dex ? 0 : 1, filter:'brightness(1)', offset:1}
    ] : [
      {transform:'translate(0,0) scale(1)', opacity:1},
      {transform:pose(), opacity:0}
    ];
    animation = flight.animate(frames, {duration:visible ? 1700 : 420, easing:'linear', fill:'forwards'});
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
