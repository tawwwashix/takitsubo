// Cosmetic only: persistence completes before this animation starts.
export function installTransfer(root, page, createCartridge, enabled) {
  let flight = null, animation = null, target = null;
  function cancel() {
    animation?.cancel(); animation = null;
    flight?.remove(); flight = null;
    target?.classList.remove('is-arriving'); target = null;
  }
  function fly(ep, sourceRect, destination, dex = false) {
    cancel();
    if (!sourceRect || !destination || !enabled()) return;
    const end = destination.getBoundingClientRect();
    const visible = end.top >= 0 && end.bottom <= innerHeight && end.right > 0 && end.left < innerWidth;
    const width = Math.min(88, end.width, sourceRect.width);
    const height = width * 7 / 6;
    const startX = sourceRect.left + sourceRect.width / 2 - width / 2;
    const startY = Math.max(-height, Math.min(innerHeight, sourceRect.top + sourceRect.height / 2 - height / 2));
    const x = end.left + end.width / 2 - width / 2;
    const y = visible ? end.top + end.height / 2 - height / 2 : (end.top >= innerHeight ? innerHeight + height : -height * 2);
    flight = document.createElement('div'); flight.className = 'lab-transfer'; flight.setAttribute('aria-hidden', 'true');
    flight.style.cssText = `left:${startX}px;top:${startY}px;width:${width}px`;
    flight.append(createCartridge(ep, true)); root.append(flight);
    if (visible && !dex) { target = destination; target.classList.add('is-arriving'); }
    const dx = x - startX, dy = y - startY;
    const scale = !dex && visible ? end.width / width : .65;
    animation = flight.animate([
      {transform:'translate(0,0) scale(1)', opacity:1, offset:0},
      {transform:`translate(${dx}px,${dy - 22}px) scale(${scale})`, opacity:1, offset:.72},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`, opacity:1, offset:.88},
      {transform:`translate(${dx}px,${dy}px) scale(${dex ? .2 : scale})`, opacity:dex || !visible ? 0 : 1, offset:1}
    ], {duration:620, easing:'cubic-bezier(.22,.65,.35,1)', fill:'forwards'});
    const current = animation;
    current.finished.then(() => {
      if (animation !== current) return;
      cancel();
      if (visible && destination.isConnected) destination.animate(
        [{filter:'brightness(1.25)'}, {filter:'brightness(1)'}], {duration:180});
    }).catch(() => {});
  }
  // Fixed viewport endpoints become stale on scrolling/resizing or another action.
  page.listen(window, 'scroll', cancel, {passive:true, capture:true});
  page.listen(window, 'resize', cancel);
  page.listen(document, 'visibilitychange', cancel);
  page.onDispose(cancel);
  return {fly, cancel};
}
