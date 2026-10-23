// Canvas text does not inherit the browser's Japanese line-breaking rules.
const NO_START = /^[、。，．！？!?：；）)］\]｝}」』】〉》ー々ぁぃぅぇぉっゃゅょァィゥェォッャュョ]/u;
const NO_END = /[（(［\[｛{「『【〈《]$/u;
export function wrapLines(ctx, text, width, limit = Infinity) {
  const chars = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('ja', {granularity:'grapheme'}).segment(text)].map(x => x.segment)
    : Array.from(text);
  const lines = []; let start = 0;
  while (start < chars.length && lines.length < limit) {
    let end = start + 1;
    while (end < chars.length && ctx.measureText(chars.slice(start, end + 1).join('')).width <= width) end++;
    if (end < chars.length) {
      while (end > start + 1 && (NO_START.test(chars[end]) || NO_END.test(chars[end - 1]))) end--;
    }
    let line = chars.slice(start, end).join('');
    if (lines.length === limit - 1 && end < chars.length) {
      let tail = Array.from(line);
      while (tail.length && (ctx.measureText(tail.join('') + '…').width > width || NO_END.test(tail.at(-1)))) tail.pop();
      line = tail.join('') + '…';
    }
    lines.push(line); start = end;
  }
  return lines;
}

// Shared interaction, wording and fallbacks for the diagnosis and episode lab.
export function mountShareControls(host, {prefix, getBlob, getLink, getX, filename, signal}) {
  host.classList.add('episode-share');
  host.innerHTML = `<style>
    .episode-share{margin:20px 0;color:var(--ink,#284e60)}
    .episode-share .share-buttons{display:flex;flex-wrap:wrap;gap:8px}
    .episode-share .share-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border:1px solid #8fb5d0;border-radius:6px;background:#f4faff;color:#254e70;font:inherit;font-size:13px;font-weight:700;text-decoration:none;cursor:pointer}
    .episode-share .share-action:hover{background:#e2f2ff}
    .episode-share .share-note,.episode-share .share-status{font-size:12px;line-height:1.6;margin:8px 0;color:#466680}
    .episode-share details{margin-top:10px}.episode-share summary{cursor:pointer;font-size:12px;padding:8px 0}
    .episode-share img{display:block;width:100%;max-width:620px;margin:12px auto}.episode-share input{width:100%;padding:10px}
    .episode-share [hidden]{display:none!important}
    @media(max-width:600px){.episode-share .share-buttons{display:grid;grid-template-columns:1fr 1fr}.episode-share .share-action{padding:9px 6px;font-size:12px}}
  </style><div class="share-buttons">
    <button type="button" class="share-action" id="${prefix}Save">画像を保存</button>
    <button type="button" class="share-action" id="${prefix}CopyImage">画像をコピー</button>
    <a class="share-action" id="${prefix}X" target="_blank" rel="noopener">Xでシェア</a>
    ${getLink ? `<button type="button" class="share-action" id="${prefix}Copy">同じ3択のリンクをコピー</button>` : ''}
  </div><p class="share-note">Xには、保存またはコピーした画像を投稿画面で添付してね。</p>
  <p class="share-status" id="${prefix}ShareStatus" role="status"></p>
  <input id="${prefix}CopyFallback" aria-label="コピーするリンク" readonly hidden>
  <details><summary>シェア画像を確認</summary><img id="${prefix}SharePreview" alt="シェア画像のプレビュー" hidden></details>`;
  const $ = suffix => host.querySelector('#' + prefix + suffix);
  let revision = 0, pending = null, url = null;
  const live = () => !signal.aborted && host.isConnected;
  const status = text => { if(live()) $('ShareStatus').textContent = text; };
  async function image() {
    const version = revision;
    if (!pending) pending = Promise.resolve().then(getBlob).catch(e => { if(version === revision) pending = null; throw e; });
    const blob = await pending;
    if (!live() || version !== revision) throw new DOMException('Selection changed', 'AbortError');
    if (!url) url = URL.createObjectURL(blob);
    $('SharePreview').src = url; $('SharePreview').hidden = false;
    return blob;
  }
  function failure(e) { if(e.name !== 'AbortError') status('画像を用意できなかった。もう一度試してね。'); }
  $('Save').onclick = async () => {
    status('画像を準備中…');
    try { await image(); const a = document.createElement('a'); a.href = url; a.download = filename(); a.click(); status('画像を保存したよ。'); } catch(e) { failure(e); }
  };
  $('CopyImage').onclick = async () => {
    if (!navigator.clipboard?.write || !window.ClipboardItem) { status('画像のコピーを使えないため「画像を保存」を使ってね。'); return; }
    status('画像を準備中…');
    try {
      // Promise-valued ClipboardItem keeps the original user gesture on Safari.
      await navigator.clipboard.write([new ClipboardItem({'image/png': image()})]);
      status('画像をコピーしたよ。');
    } catch(e) { if(e.name !== 'AbortError') status('画像のコピーを使えないため「画像を保存」を使ってね。'); }
  };
  if(getLink) $('Copy').onclick = async () => {
    const value = getLink(), version = revision;
    try { await navigator.clipboard.writeText(value); if(version === revision) status('同じ3枚・同じ並びのリンクをコピーしたよ。'); }
    catch (_) { if(!live() || version !== revision) return; $('CopyFallback').hidden = false; $('CopyFallback').value = value; $('CopyFallback').focus(); $('CopyFallback').select(); status('この欄のリンクをコピーしてね。'); }
  };
  host.querySelector('details').ontoggle = () => { if(host.querySelector('details').open) image().catch(failure); };
  function invalidate() {
    revision++; pending = null; if(url) URL.revokeObjectURL(url); url = null;
    $('SharePreview').hidden = true; $('SharePreview').removeAttribute('src');
    $('CopyFallback').hidden = true; status(''); $('X').href = getX();
    if(host.querySelector('details').open) image().catch(failure);
  }
  signal.addEventListener('abort', () => { revision++; if(url) URL.revokeObjectURL(url); }, {once:true});
  invalidate(); return {invalidate};
}
