const COLLECTION_KEY = "takitsubo:excavation:v1";
const FALLBACK = "assets/img/artwork_320.jpg";
const DOCTOR = `<svg viewBox="0 0 104 112" role="img" aria-label="ヘッドホンと白衣のポッドキャスト博士" shape-rendering="crispEdges">
<path fill="#254746" d="M26 18h52v8h8v38h-8v8H26v-8h-8V26h8z"/>
<path fill="#f0cfa3" d="M30 25h44v39H30zM42 62h20v18H42z"/>
<path fill="#ede9ce" d="M22 23V11h13V5h17v8h18v-5h9v12h7v14H68v-8H50v8H35v-7h-9v13h-7V23z"/>
<path fill="#8db8a3" d="M13 31h10v27H13zM81 31h10v27H81z"/>
<path fill="#254746" d="M29 38h20v16H29zM57 38h20v16H57zM49 42h8v5h-8z"/>
<path fill="#e2f1de" d="M33 42h12v8H33zM61 42h12v8H61z"/>
<path fill="#c27a58" d="M47 58h13v4H47z"/>
<path fill="#fff9e7" stroke="#254746" stroke-width="3" d="m33 72 18 11 20-11 16 13 8 24H10l8-24z"/>
<path fill="#408b80" d="M45 82h15v27H45z"/>
<path fill="none" stroke="#254746" stroke-width="3" d="m31 76 8 19 10-11m24-8-8 19-10-11M72 94h10v9H72"/>
<path fill="#e6af52" d="M72 88h4v8h-4z"/><path fill="#f0cfa3" d="M13 99h14v10H13zM78 99h14v10H78z"/>
</svg>`;

export function readRound(search, byNumber) {
  const p = new URLSearchParams(search), raw = p.get("eps");
  if (raw === null) return { ids: null, pick: null, invalid: p.has("pick") };
  const parts = raw.split(",");
  const ids = parts.map(Number);
  if (parts.length !== 3 || !parts.every(n => /^[1-9]\d*$/.test(n)) || new Set(ids).size !== 3 || !ids.every(n => byNumber.has(n))) {
    return { ids: null, pick: null, invalid: true };
  }
  const rawPick = p.get("pick");
  const pick = rawPick && /^[1-9]\d*$/.test(rawPick) && ids.includes(Number(rawPick)) ? Number(rawPick) : null;
  return { ids, pick, invalid: p.has("pick") && pick === null };
}

export async function mount(root, page) {
  const response = await fetch(root.dataset.source, { signal: page.signal });
  if (!response.ok) throw new Error("Episode data unavailable");
  const data = await response.json();
  if (page.signal.aborted) return;
  const episodes = data.episodes.filter(e => Number.isInteger(e.number) && e.number > 0 && typeof e.title === "string");
  const byNumber = new Map(episodes.map(e => [e.number, e]));
  if (byNumber.size < 3) throw new Error("Three episodes are required");
  let collection = new Set(), saveAvailable = true, round = [], selected = null, senderPick = null;
  let disposed = false, imageVersion = 0, objectUrl = null;
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
  const shareBase = new URL("lab.html", location.href);
  const mergeCollection = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLECTION_KEY) || "[]");
      if (Array.isArray(saved)) saved.forEach(n => { if (byNumber.has(n)) collection.add(n); });
    } catch (_) { saveAvailable = false; }
  };
  mergeCollection();
  root.innerHTML = `
<div class="lab-wrap">
  <div class="lab-topline"><span><i></i> TAKITSUBO / EPISODE LAB.</span><a href="excavate.html">砂浜の発掘へ ↗</a></div>
  <header class="lab-heading"><div><p class="lab-kicker">ゲームの滝壺</p><h1>エピソード研究所<span>今日の相棒は、どの一回？</span></h1></div><button type="button" id="labDexToggle" aria-expanded="false" aria-controls="labDex"><span>わたしの図鑑</span><strong id="labCount"></strong></button></header>
  <section class="lab-dialogue" aria-label="博士からのお誘い"><div class="lab-doctor">${DOCTOR}<span>ポッドキャスト博士</span></div><div class="lab-speech"><span class="lab-speaker">はかせ</span><p id="labSpeech">そこに3つの<br class="lab-mobile-break">エピソードがあるじゃろう！</p><p class="lab-sub">気になる一回を、今日の相棒に選ぶのじゃ。</p></div></section>
  <p id="labNotice" class="lab-notice" role="status" hidden></p>
  <div class="lab-tray-label"><span>CHOOSE YOUR EPISODE</span><span>3つの出会い。選ぶのは、あなた。</span></div>
  <section id="labCards" class="lab-cards" aria-label="博士の3つの候補"></section>
  <section id="labResult" class="lab-result" hidden aria-label="選んだエピソード"><div><span class="lab-kicker">今日の相棒が決まった！</span><p id="labResultTitle"></p><span id="labSaved"></span></div><a id="labListen" class="lab-primary">このエピソードへ →</a></section>
  <div class="lab-toolbar"><button type="button" id="labShuffle" class="lab-primary">↻ 別の3択に出会う</button><span>何度でも、待たずに選び直せる。</span></div>
  <section class="lab-share" aria-label="この3択をシェア"><div><h2>この3択、あなたならどれ？</h2><p>同じ3枚を渡して、選び比べてみよう。</p></div><div class="lab-share-actions"><button type="button" id="labCopy" class="lab-secondary">3択リンクをコピー</button><button type="button" id="labImage" class="lab-secondary">シェア画像を作る</button><a id="labX" class="lab-secondary" target="_blank" rel="noopener">Xでこの3択を紹介 ↗</a></div><p id="labLocal" class="lab-footnote" ${isLocal ? "" : "hidden"}>試作中：リンクはこのPC内での確認用。保存した画像は共有できる。公開後はリンクから同じ3択を渡せる。</p><p id="labShareStatus" role="status" class="lab-footnote"></p><input id="labCopyFallback" readonly aria-label="コピーする3択リンク" hidden></section>
  <section id="labDex" class="lab-dex" hidden><div class="lab-dex-heading"><h2>わたしのエピソード図鑑</h2><span>発掘で見つけた回も、ここに。</span></div><div id="labDexGrid"></div><p class="lab-footnote" id="labStorageNote">このブラウザに保存。聴いたかどうかは記録しない。</p></section>
  <p class="lab-bottom">偶然の出会いを、次に聴くきっかけに。<span>GAME NO TAKITSUBO</span></p>
</div>
<dialog id="labShareDialog" aria-labelledby="labShareHeading"><div class="lab-modal-top"><h2 id="labShareHeading">この3択を、持っていこう。</h2><button type="button" id="labCloseImage" aria-label="閉じる">×</button></div><p id="labImageStatus" role="status">画像を準備中…</p><img id="labSharePreview" alt="3つのエピソードと選んだ回を並べたシェア画像" hidden><a id="labDownload" class="lab-primary" hidden>画像を保存する</a><p class="lab-footnote">Xに画像を載せる場合は、保存してから投稿画面で添付してね。</p></dialog>`;
  const $ = s => root.querySelector(s);
  const safeImage = (img, ep) => {
    img.alt = ep.title; img.src = ep.image || FALLBACK;
    img.onerror = () => { img.onerror = null; img.src = FALLBACK; };
  };
  function updateCollection() {
    $("#labCount").textContent = `${collection.size} / ${byNumber.size}`;
    const grid = $("#labDexGrid"); grid.replaceChildren();
    if (!collection.size) { const p = document.createElement("p"); p.textContent = "最初の相棒を選ぶと、ここに記録されるよ。"; grid.append(p); }
    [...collection].sort((a,b) => b-a).forEach(number => {
      const ep = byNumber.get(number), a = document.createElement("a"); a.href = `episodes/${number}.html`;
      const img = document.createElement("img"); safeImage(img, ep); img.loading = "lazy"; img.alt = "";
      const title = document.createElement("span"); title.textContent = `第${number}回 ${ep.title}`;
      a.append(img, title); grid.append(a);
    });
    if (!saveAvailable) $("#labStorageNote").textContent = "保存を利用できないため、この画面内だけで図鑑を記録しているよ。";
  }
  function roundUrl(includeSelection = true) {
    const url = new URL(shareBase);
    url.searchParams.set("eps", round.map(e => e.number).join(","));
    const pick = includeSelection ? selected ?? senderPick : null;
    if (pick !== null) url.searchParams.set("pick", pick);
    return url;
  }
  function updateShare() {
    const url = roundUrl();
    history.replaceState(history.state, "", url);
    const chosen = selected ?? senderPick;
    const text = chosen === null ? "博士からこの3択！ あなたならどれ？" : selected === null ? `この3択、紹介した人は第${chosen}回を選んだ！ あなたならどれ？` : `この3択、私は第${chosen}回を選んだ！ あなたならどれ？`;
    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", `${text}\n${round.map(e => `第${e.number}回 ${Array.from(e.title).slice(0,28).join("")}${Array.from(e.title).length>28?"…":""}`).join("\n")}\n#ゲームの滝壺`);
    if (!isLocal) intent.searchParams.set("url", url.href);
    $("#labX").href = intent.href;
    $("#labShareStatus").textContent = ""; $("#labCopyFallback").hidden = true;
  }
  function renderCards() {
    const cards = $("#labCards"); cards.replaceChildren();
    round.forEach((ep, index) => {
      const card = document.createElement("article"); card.className = "lab-card" + (selected === ep.number ? " is-selected" : ""); card.dataset.number = ep.number;
      const meta = document.createElement("div"); meta.className = "lab-card-meta";
      const slot = document.createElement("span"); slot.textContent = `0${index+1}`;
      const badge = document.createElement("span"); badge.textContent = selected === ep.number ? "今日の相棒" : collection.has(ep.number) ? "図鑑に登録済み" : "まだ見ぬ一回";
      meta.append(slot, badge);
      const art = document.createElement("div"); art.className = "lab-art";
      const img = document.createElement("img"); safeImage(img, ep); art.append(img);
      if (senderPick === ep.number) { const mark = document.createElement("span"); mark.className = "lab-sender"; mark.textContent = "紹介した人の選択"; art.append(mark); }
      const detail = document.createElement("div"); detail.className = "lab-card-detail";
      const num = document.createElement("p"); num.className = "lab-number"; num.textContent = `第${ep.number}回 · ${ep.date || ""}`;
      const title = document.createElement("h2"); title.textContent = ep.title;
      const tags = document.createElement("p"); tags.className = "lab-tags"; tags.textContent = (ep.tags || []).slice(0,2).join(" / ") || "どんな話か、出会ってみよう。";
      const button = document.createElement("button"); button.type = "button"; button.className = "lab-choose"; button.textContent = selected === ep.number ? "✓ この回に決めた！" : "この回を相棒にする →";
      button.disabled = selected !== null; button.addEventListener("click", () => choose(ep));
      detail.append(num, title, tags, button); card.append(meta, art, detail); cards.append(card);
    });
  }
  function choose(ep) {
    if (selected !== null) return;
    mergeCollection(); const isNew = !collection.has(ep.number); selected = ep.number; collection.add(ep.number);
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify([...collection])); } catch (_) { saveAvailable = false; }
    $("#labSpeech").textContent = "ほう、その一回を選ぶのじゃな！";
    $(".lab-sub").textContent = "君は何に惹かれたのかのう。ほかの人にも聞いてみよう。";
    $("#labResult").hidden = false; $("#labResultTitle").textContent = `第${ep.number}回 ${ep.title}`;
    $("#labSaved").textContent = !saveAvailable ? "この画面の図鑑に記録したよ（端末への保存は利用できない）。" : isNew ? "新しい一枚を図鑑に登録したよ。" : "お気に入りとの再会も、いいものじゃ。";
    $("#labListen").href = `episodes/${ep.number}.html`;
    renderCards(); updateCollection(); updateShare();
    $("#labListen").focus({preventScroll:true});
    $("#labResult").scrollIntoView({behavior:"instant", block:"nearest"});
  }
  function newRound(ids) {
    if (ids) round = ids.map(n => byNumber.get(n));
    else {
      const last = new Set(round.map(e => e.number));
      let pool = [...byNumber.values()].filter(e => !last.has(e.number));
      if (pool.length < 3) pool = [...byNumber.values()];
      round = [];
      while (round.length < 3) round.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
      senderPick = null;
    }
    selected = null; imageVersion++;
    $("#labResult").hidden = true;
    $("#labSpeech").textContent = "そこに3つのエピソードがあるじゃろう！";
    $(".lab-sub").textContent = "気になる一回を、今日の相棒に選ぶのじゃ。";
    renderCards(); updateShare();
  }
  $("#labShuffle").addEventListener("click", () => {
    $("#labNotice").hidden = true; newRound();
    $("#labCards").scrollIntoView({behavior:"instant", block:"start"});
    $(".lab-choose").focus({preventScroll:true});
  });
  $("#labDexToggle").addEventListener("click", () => {
    const dex = $("#labDex"); dex.hidden = !dex.hidden; $("#labDexToggle").setAttribute("aria-expanded", !dex.hidden);
    if (!dex.hidden) dex.scrollIntoView({behavior:"instant",block:"start"});
  });
  $("#labCopy").addEventListener("click", async () => {
    const value = roundUrl().href;
    try {
      await navigator.clipboard.writeText(value);
      if (!disposed) $("#labShareStatus").textContent = "同じ3枚・同じ並びのリンクをコピーしたよ。";
    } catch (_) {
      if (disposed) return;
      const input = $("#labCopyFallback"); input.hidden = false; input.value = value; input.focus(); input.select();
      $("#labShareStatus").textContent = "自動コピーを使えないため、この欄のリンクをコピーしてね。";
    }
  });
  page.listen(window,"storage", e => { if (e.key === COLLECTION_KEY) { mergeCollection(); updateCollection(); renderCards(); } });
  const dialog = $("#labShareDialog");
  const closeImage = () => { imageVersion++; dialog.close(); $("#labImage").focus(); };
  $("#labCloseImage").addEventListener("click",closeImage);
  dialog.addEventListener("cancel",()=>{imageVersion++;});
  $("#labImage").addEventListener("click", async () => {
    const version = ++imageVersion, snapshot = round.slice(), choice = selected ?? senderPick;
    dialog.showModal(); $("#labSharePreview").hidden = true; $("#labDownload").hidden = true;
    $("#labImageStatus").textContent = "画像を準備中…";
    try {
      const blob = await createShareImage(snapshot, choice, page.signal, selected === null && senderPick !== null);
      if (disposed || version !== imageVersion) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(blob);
      $("#labSharePreview").src = objectUrl; $("#labSharePreview").hidden = false;
      const download = $("#labDownload"); download.href = objectUrl; download.download = `takitsubo-${snapshot.map(e=>e.number).join("-")}${choice===null?"":`-pick-${choice}`}.png`; download.hidden = false;
      $("#labImageStatus").textContent = "3択を1枚の画像にしたよ。";
    } catch (_) { if (!disposed && version === imageVersion) $("#labImageStatus").textContent = "画像を作れなかった。閉じてもう一度試してね。リンクでも同じ3択を渡せるよ。"; }
  });
  page.onDispose(() => { disposed = true; imageVersion++; if (dialog.open) dialog.close(); if (objectUrl) URL.revokeObjectURL(objectUrl); });
  const initial = readRound(location.search, byNumber); senderPick = initial.pick; newRound(initial.ids); updateCollection();
  if (initial.invalid) { $("#labNotice").hidden = false; $("#labNotice").textContent = initial.ids ? "紹介した人の選択を読み取れなかったため、3枚の候補だけを表示したよ。" : "このリンクの3択は読み取れなかったため、新しい3択を用意したよ。"; }
}

function imageFor(ep, signal) {
  return new Promise(resolve => {
    const img = new Image(); let done = false;
    const finish = value => { if(done) return; done=true;clearTimeout(timer);signal.removeEventListener("abort",abort);img.onload=img.onerror=null;resolve(value); };
    const abort = () => { img.src="";finish(null); };
    const timer = setTimeout(abort,6000);
    img.onload = () => finish(img); img.onerror = () => finish(null);
    signal.addEventListener("abort",abort,{once:true});
    if(signal.aborted) abort(); else img.src = ep.image || FALLBACK;
  });
}

async function createShareImage(episodes, chosen, signal, fromSender = false) {
  const doctorSource = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(DOCTOR.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
  const allImages = await Promise.all([...episodes.map(e=>imageFor(e,signal)), imageFor({image:doctorSource},signal)]);
  const images = allImages.slice(0,3), doctor = allImages[3];
  if (signal.aborted) throw new Error("Disposed");
  const canvas = document.createElement("canvas"); canvas.width=1200;canvas.height=800;
  const c=canvas.getContext("2d"), ink="#214641", paper="#f5f1df", colors=["#d4745d","#4c9d91","#c9a544"];
  c.fillStyle=paper;c.fillRect(0,0,1200,800);
  c.fillStyle="#dde5d6";for(let x=0;x<1200;x+=24)for(let y=0;y<800;y+=24)c.fillRect(x,y,2,2);
  c.fillStyle=ink;c.fillRect(0,0,1200,13);c.fillRect(0,754,1200,46);
  c.font='bold 19px "Noto Sans JP", sans-serif';c.fillText("ゲームの滝壺  /  エピソード研究所",44,52);
  c.font='bold 42px "Noto Sans JP", sans-serif';c.fillText(chosen===null?"この3択、あなたならどれ？":fromSender?"この3択、紹介した人の選択は…":"この3択、私はこれにした！",44,118);
  c.font='18px "Noto Sans JP", sans-serif';c.fillText("そこに3つのエピソードがあるじゃろう！",44,156);
  if (doctor) {c.fillStyle="#dce5d0";c.fillRect(1040,29,116,140);c.strokeStyle=ink;c.lineWidth=2;c.strokeRect(1040,29,116,140);c.imageSmoothingEnabled=false;c.drawImage(doctor,1046,34,104,112);c.fillStyle=ink;c.font='bold 12px "Noto Sans JP", sans-serif';c.fillText("ポッドキャスト博士",1044,162);c.imageSmoothingEnabled=true;}
  function wrap(text,x,y,maxWidth,lineHeight,limit) {
    const chars=Array.from(text);let line="",row=0;
    for(let i=0;i<chars.length;i++) {
      if(c.measureText(line+chars[i]).width>maxWidth && line) {
        if(row===limit-1) {while(c.measureText(line+"…").width>maxWidth)line=line.slice(0,-1);c.fillText(line+"…",x,y+row*lineHeight);return;}
        c.fillText(line,x,y+row*lineHeight);row++;line="";
      }
      line+=chars[i];
    }
    c.fillText(line,x,y+row*lineHeight);
  }
  episodes.forEach((ep,i)=>{
    const x=44+i*378,y=191,w=356;
    c.fillStyle="#d9d9c5";c.fillRect(x+6,y+6,w,500);c.fillStyle="#fffdf2";c.fillRect(x,y,w,500);
    c.fillStyle=colors[i];c.fillRect(x,y,w,9);
    c.strokeStyle=ep.number===chosen?ink:"#c8d0be";c.lineWidth=ep.number===chosen?6:2;c.strokeRect(x,y,w,500);
    c.fillStyle=ink;c.font='bold 19px sans-serif';c.fillText(`0${i+1}   第${ep.number}回`,x+18,y+40);
    c.fillStyle="#e6e9db";c.fillRect(x+18,y+57,320,320);
    const img=images[i];
    if(img){const scale=Math.min(320/img.naturalWidth,320/img.naturalHeight);const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;c.drawImage(img,x+18+(320-iw)/2,y+57+(320-ih)/2,iw,ih);}
    else {c.fillStyle=ink;c.font="bold 46px sans-serif";c.fillText(`#${ep.number}`,x+95,y+235);}
    c.fillStyle=ink;c.font='bold 21px "Noto Sans JP", sans-serif';wrap(ep.title,x+18,y+411,320,28,3);
    if(ep.number===chosen){c.fillStyle=ink;c.fillRect(x+154,y+30,192,37);c.fillStyle="#fff9df";c.font='bold 18px "Noto Sans JP", sans-serif';c.fillText(fromSender?"✓ 紹介した人の選択":"✓ 私の選んだ相棒",x+165,y+55);}
  });
  c.fillStyle=ink;c.font='18px "Noto Sans JP", sans-serif';c.fillText("3つの出会い。選ぶのは、あなた。",44,731);
  c.fillStyle=paper;c.font='bold 18px "Noto Sans JP", sans-serif';c.fillText("#ゲームの滝壺",44,785);c.textAlign="right";c.fillText("TAKITSUBO EPISODE LAB.",1156,785);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed")),"image/png"));
}
