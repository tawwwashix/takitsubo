// Keep the same image URLs as the episode catalogue so the browser can reuse them.
const FALLBACK = 'assets/img/artwork_320.jpg';
const UNAVAILABLE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#f4faff"/><text x="160" y="166" text-anchor="middle" fill="#496b80" font-size="20" font-family="sans-serif">画像を表示できません</text></svg>'
);

function decoded(img, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer, done = false;
    const finish = error => {
      if (done) return;
      done = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => { img.removeAttribute('src'); finish(new DOMException('Disposed', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, {once:true});
    timer = setTimeout(() => finish(new Error('Image preparation timed out')), timeoutMs);
    img.decode().then(() => finish(), finish);
  });
}

export async function prepareImage(img, signal) {
  // Own fallback handling while preparing; never reveal an undecoded image.
  img.onerror = null;
  img.decoding = 'async';
  for (const source of [null, FALLBACK, UNAVAILABLE]) {
    if (signal.aborted) throw new DOMException('Disposed', 'AbortError');
    if (source !== null) img.src = source;
    try {
      await decoded(img, signal, source === UNAVAILABLE ? 1000 : 6000);
      return;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
    }
  }
  // Even a browser unable to decode the inline fallback must finish loading.
  img.removeAttribute('src'); img.alt = '画像を表示できません';
}
