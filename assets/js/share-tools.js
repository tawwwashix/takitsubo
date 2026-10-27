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
export function mountShareControls(host, {prefix, getBlob, getX, filename, signal, previewMode = 'always', makeLabel = 'シェア画像を作る', previewAlt, onAction = () => {}}) {
  host.classList.add('episode-share');
  host.innerHTML = `<style>
    .episode-share{margin:20px 0;color:var(--ink,#284e60);text-align:center}
    .episode-share[data-preview-mode="always"]{margin-bottom:0}
    .episode-share .sh-btn{min-height:44px;text-decoration:none}
    .episode-share .sh-btn:disabled{opacity:.6;cursor:wait}
    .episode-share .share-status{font-size:12px;line-height:1.8;margin:10px 0;color:var(--sub)}
    .episode-share .share-status:empty,.episode-share .share-entry:empty{display:none}
    .episode-share img{display:block;width:100%;max-width:540px;height:auto;margin:20px auto 0;border-radius:18px;box-shadow:var(--shadow-hover)}
    .episode-share[data-preview-mode="on-demand"] img{max-width:760px}
    .episode-share [hidden]{display:none!important}
  </style><div class="sh-actions share-entry" id="${prefix}Entry">
    <button type="button" class="sh-btn" id="${prefix}Make" aria-expanded="false" aria-controls="${prefix}ImagePanel">${makeLabel}</button>
  </div>
  <div id="${prefix}ImagePanel" hidden>
    <img id="${prefix}SharePreview" alt="${previewAlt || 'ふさわしいゲーム診断の結果画像'}" hidden>
    <p class="share-status" id="${prefix}ShareStatus" role="status"></p>
    <div id="${prefix}ImageActions" hidden>
      <div class="sh-actions">
        <button type="button" class="sh-btn save" id="${prefix}Save">📥 画像を保存</button>
        <button type="button" class="sh-btn copy" id="${prefix}CopyImage" aria-live="polite">📋 画像をコピー</button>
        <a class="sh-btn share" id="${prefix}X" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z"/></svg>Xでシェアする</a>
      </div><p class="sh-note">画像を保存/コピーしてから、Xのポストに添付すると盛り上がります！</p>
    </div>
  </div>`;
  host.dataset.previewMode = previewMode;
  const $ = suffix => host.querySelector('#' + prefix + suffix);
  let revision = 0, pending = null, url = null, expanded = previewMode === 'always';
  let disposed = false, generation = null, preparedBlob = null, copyTimer = null;
  const live = () => !disposed && !signal.aborted && host.isConnected;
  const status = text => { if(live()) $('ShareStatus').textContent = text; };
  async function image() {
    const version = revision;
    if (!live()) throw new DOMException('Disposed', 'AbortError');
    if (!pending) {
      generation = new AbortController();
      const generationSignal = generation.signal;
      pending = Promise.resolve().then(() => getBlob(generationSignal)).catch(e => { if(version === revision) pending = null; throw e; });
    }
    const blob = await pending;
    if (!live() || version !== revision) throw new DOMException('Selection changed', 'AbortError');
    if (!url) url = URL.createObjectURL(blob);
    const preview = $('SharePreview');
    if (preview.src !== url) preview.src = url;
    await preview.decode();
    if (!live() || version !== revision) throw new DOMException('Selection changed', 'AbortError');
    preview.hidden = false;
    preparedBlob = blob;
    return blob;
  }
  function failure(e) { if(e.name !== 'AbortError') status('画像を用意できなかった。もう一度試してね。'); }
  async function reveal() {
    if (!live()) return;
    const version = revision;
    expanded = true; $('ImagePanel').hidden = false;
    $('Make').disabled = true; $('Make').setAttribute('aria-expanded','true');
    status('画像を準備中…');
    try {
      await image();
      if (!live() || version !== revision) return;
      const restoreFocus = document.activeElement === $('Make');
      $('ImageActions').hidden = false; $('Make').hidden = true;
      $('Entry').hidden = true;
      if(restoreFocus) $('Save').focus({preventScroll:true});
      status('');
    } catch(e) {
      if (!live() || version !== revision) return;
      failure(e); $('Entry').hidden = false; $('Make').hidden = false; $('Make').textContent = '画像をもう一度作る';
    } finally { if(live() && version === revision) $('Make').disabled = false; }
  }
  $('Make').onclick = reveal;
  $('Save').onclick = async () => {
    onAction('save');
    status('画像を準備中…');
    try { await image(); const a = document.createElement('a'); a.href = url; a.download = filename(); a.click(); status('画像を保存したよ。'); } catch(e) { failure(e); }
  };
  $('CopyImage').onclick = async () => {
    onAction('copy');
    if (!window.isSecureContext) {
      status('このHTTPアドレスでは画像をコピーできないよ。HTTPSで開くか、同じPCならlocalhostで開いてね。「画像を保存」も使えるよ。'); return;
    }
    if (!navigator.clipboard?.write || !window.ClipboardItem) { status('このブラウザでは画像のコピーに対応していないため「画像を保存」を使ってね。'); return; }
    if (!preparedBlob) { status('画像の準備が終わってから、もう一度コピーしてね。'); return; }
    const version = revision, button = $('CopyImage');
    clearTimeout(copyTimer); copyTimer = null;
    button.disabled = true; button.textContent = 'コピー中…'; status('');
    try {
      // The preview is already encoded. Write its Blob during the click itself,
      // preserving user activation without regenerating or awaiting the image.
      await navigator.clipboard.write([new ClipboardItem({'image/png': preparedBlob})]);
      if (!live() || version !== revision) return;
      button.textContent = '✅ コピーしました！';
      copyTimer = setTimeout(() => {
        if(live() && version === revision) button.textContent = '📋 画像をコピー';
        copyTimer = null;
      }, 1800);
    } catch(e) {
      if (!live() || version !== revision) return;
      button.textContent = '📋 画像をコピー';
      if(e.name !== 'AbortError') status('画像をコピーできなかった。ブラウザのコピー許可を確認するか「画像を保存」を使ってね。');
    } finally { if(live() && version === revision) button.disabled = false; }
  };
  function releaseImage() {
    revision++;
    clearTimeout(copyTimer); copyTimer = null; preparedBlob = null;
    generation?.abort(); generation = null; pending = null;
    if(url) URL.revokeObjectURL(url);
    url = null;
  }
  function invalidate({reset = false} = {}) {
    if (!live()) return;
    releaseImage();
    if(reset && previewMode === 'on-demand') expanded = false;
    $('SharePreview').hidden = true; $('SharePreview').removeAttribute('src');
    status(''); $('X').href = getX();
    $('CopyImage').disabled = false; $('CopyImage').textContent = '📋 画像をコピー';
    $('ImageActions').hidden = true; $('ImagePanel').hidden = !expanded;
    $('Entry').hidden = previewMode === 'always';
    $('Make').hidden = previewMode === 'always'; $('Make').disabled = false;
    $('Make').textContent = makeLabel;
    $('Make').setAttribute('aria-expanded',String(expanded));
    if(expanded) reveal();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    releaseImage();
    $('SharePreview').removeAttribute('src');
    $('Make').onclick = $('Save').onclick = $('CopyImage').onclick = null;
    signal.removeEventListener('abort', dispose);
  }
  signal.addEventListener('abort', dispose, {once:true});
  invalidate(); return {invalidate, dispose};
}
