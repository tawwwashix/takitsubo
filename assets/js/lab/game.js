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
  let disposed = false, imageVersion = 0, objectUrl = null, inspected = null;
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
  <header class="lab-heading"><a class="lab-exit" href="index.html" aria-label="研究所を出てホームへ">← EXIT</a><div><span class="lab-kicker">GAME NO TAKITSUBO</span><h1>エピソード研究所</h1></div><button type="button" id="labMotion" class="lab-icon-button" aria-pressed="false" aria-label="動きを止める">動き ON</button></header>
  <div class="lab-machine">
  <section class="lab-scene" aria-label="カートリッジが浮かぶ研究所">
    <svg class="lab-room" viewBox="0 0 1000 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shape-rendering="crispEdges">
      <defs><pattern id="labWallTiles" width="100" height="76" patternUnits="userSpaceOnUse"><path fill="#a8c9c2" d="M0 0h100v76H0z"/><path fill="none" stroke="#94b8b0" stroke-width="2" d="M0 76V0h100"/></pattern><pattern id="labFloorTiles" width="100" height="44" patternUnits="userSpaceOnUse"><path fill="#688e91" d="M0 0h100v44H0z"/><path fill="none" stroke="#83a6a5" stroke-width="2" d="M0 44V0h100"/></pattern></defs>
      <path fill="url(#labWallTiles)" d="M0 0h1000v340H0z"/><path fill="#638d8c" d="M0 285h1000v62H0z"/><path fill="#d0e1cb" d="M0 278h1000v8H0z"/><path fill="#355962" d="M0 332h1000v14H0z"/><path fill="url(#labFloorTiles)" d="M0 346h1000v124H0z"/>
      <path fill="#4f747a" d="M54 52h220v178H54z"/><path fill="#e0e8ca" d="M60 46h208v174H60z"/><path fill="#6db3b8" d="M70 56h188v154H70z"/><path fill="#385e70" d="M70 124 108 93l50 29 42-47 58 31v104H70z"/><path fill="#719481" d="m70 161 49-22 37 20 62-36 40 25v62H70z"/><path fill="#bce9df" d="M179 87h23v95h-23zM166 183h49v7h-49zM152 195h78v6h-78z"/><path fill="#e0e8ca" d="M161 56h6v154h-6zM70 128h188v6H70z"/>
      <path fill="#4f747a" d="M762 74h186v159H762z"/><path fill="#d4d8bb" d="M753 64h186v159H753z"/><path fill="#325661" d="M763 74h166v59H763zM763 145h166v65H763z"/><path fill="#d98e6f" d="M778 88h15v43h-15zM801 92h11v39h-11z"/><path fill="#d0b76e" d="M818 84h20v47h-20z"/><path fill="#87b9af" d="M850 98h55v33h-55z"/><path fill="#d9e2cc" d="M861 104h32v4h-32zM861 114h22v4h-22z"/><path fill="#8dd1c0" d="M782 170h24v31h-24zM788 153h12v17h-12z"/><path fill="#c2c7e7" d="M830 180h32v21h-32zM838 157h16v23h-16z"/><path fill="#e1b971" d="M883 156h30v45h-30z"/>
      <path fill="#466c74" d="M353 38h294v94H353z"/><path fill="#dae0c8" d="M358 33h284v92H358z"/><path fill="#23424f" d="M369 44h262v70H369z"/><path fill="none" stroke="#83cfbe" stroke-width="4" d="M388 80h20l8-15 12 30 10-40 14 48 9-23h30m20 0h15l9-23 11 42 12-27 8 8h39"/>
      <path fill="#d9dfc5" d="M337 0h326v8H337z"/><path fill="#eef1d8" d="M361 8h278v7H361z"/><path fill="#456b72" d="M28 272h84v60H28zM902 272h70v60h-70z"/><path fill="#8fa987" d="M41 246h59v27H41zM50 220h13v30H50zM77 232h15v23H77z"/>
    </svg>
    <div class="lab-scene-caption"><span>SELECT EPISODE</span><span>研究室 / 01</span></div>
    <section id="labCards" class="lab-cards" aria-label="博士の3つの候補"></section>
    <p class="lab-stage-hint" id="labStageHint">気になるカートリッジをタップして調べよう</p>
  </section>
  <section class="lab-console" aria-label="博士とエピソードを選ぶ">
  <div class="lab-dialogue"><div class="lab-doctor">${DOCTOR}<span>ポッドキャスト博士</span></div><div class="lab-speech"><span class="lab-speaker">はかせ</span><p id="labSpeech">そこに3つのエピソードがあるじゃろう！</p><p class="lab-sub">気になる一回を、今日の相棒に選ぶのじゃ。</p></div></div>
  <p id="labNotice" class="lab-notice" role="status" hidden></p>
  <div class="lab-inspection" id="labInspection"><div aria-live="polite" aria-atomic="true"><p class="lab-number" id="labInspectNumber"></p><h2 id="labInspectTitle"></h2><p class="lab-tags" id="labInspectTags"></p></div><button type="button" id="labConfirm" class="lab-primary">この回を相棒にする →</button></div>
  <section id="labResult" class="lab-result" hidden aria-label="選んだエピソード"><div><span class="lab-kicker">今日の相棒が決まった！</span><p id="labResultTitle"></p><span id="labSaved"></span></div><a id="labListen" class="lab-primary">このエピソードへ →</a></section>
  </section>
  <nav class="lab-toolbar" aria-label="研究所のメニュー"><button type="button" id="labShuffle" class="lab-secondary">↻ 別の3択</button><button type="button" id="labShareToggle" class="lab-secondary" aria-haspopup="dialog">この3択を渡す ↗</button><button type="button" id="labDexToggle" class="lab-secondary" aria-haspopup="dialog"><span>図鑑</span><strong id="labCount"></strong></button></nav>
  </div>
  <div class="lab-bottom"><span>3つの出会い。選ぶのは、あなた。</span><a href="excavate.html">砂浜の発掘へ ↗</a></div>
</div>
<dialog id="labToolsDialog" aria-labelledby="labToolsHeading"><div class="lab-modal-top"><h2 id="labToolsHeading">この3択、あなたならどれ？</h2><button type="button" class="lab-close" data-close="labToolsDialog" aria-label="共有メニューを閉じる">×</button></div><p>同じ3枚を渡して、選び比べてみよう。</p><div class="lab-share-actions"><button type="button" id="labCopy" class="lab-secondary">3択リンクをコピー</button><button type="button" id="labImage" class="lab-secondary">シェア画像を作る</button><a id="labX" class="lab-secondary" target="_blank" rel="noopener">Xでこの3択を紹介 ↗</a></div><p id="labLocal" class="lab-footnote" ${isLocal ? "" : "hidden"}>試作中：リンクはこのPC内での確認用。保存した画像は共有できる。公開後はリンクから同じ3択を渡せる。</p><p id="labShareStatus" role="status" class="lab-footnote"></p><input id="labCopyFallback" readonly aria-label="コピーする3択リンク" hidden></dialog>
<dialog id="labDex" aria-labelledby="labDexHeading"><div class="lab-modal-top"><h2 id="labDexHeading">わたしのエピソード図鑑</h2><button type="button" class="lab-close" data-close="labDex" aria-label="図鑑を閉じる">×</button></div><p class="lab-footnote">発掘で見つけた回も、ここに。</p><div id="labDexGrid"></div><p class="lab-footnote" id="labStorageNote">このブラウザに保存。聴いたかどうかは記録しない。</p></dialog>
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
      card.style.setProperty("--slot", index);
      const button = document.createElement("button"); button.type = "button"; button.className = "lab-choose";
      button.setAttribute("aria-label", `第${ep.number}回 ${ep.title}を調べる`);
      button.setAttribute("aria-controls", "labInspection");
      button.innerHTML = `<span class="lab-art"><span class="lab-float"><span class="lab-cartridge"><span class="lab-cart-back"></span><span class="lab-cart-side lab-cart-left"></span><span class="lab-cart-side lab-cart-right"></span><span class="lab-cart-top"></span><span class="lab-cart-bottom"></span><span class="lab-cart-front"><span class="lab-cart-label">TAKITSUBO</span><span class="lab-cart-picture"></span><span class="lab-cart-grip">▼</span></span></span></span></span><span class="lab-pedestal" aria-hidden="true"><span>0${index+1}</span></span><span class="lab-card-number">第${ep.number}回</span>`;
      const img = document.createElement("img"); safeImage(img, ep); img.alt = ""; img.draggable = false;
      button.querySelector(".lab-cart-picture").append(img);
      const title = document.createElement("span"); title.className = "lab-card-title"; title.textContent = ep.title; button.append(title);
      const badge = document.createElement("span"); badge.className = "lab-card-badge"; badge.textContent = selected === ep.number ? "✓ 今日の相棒" : collection.has(ep.number) ? "図鑑に登録済み" : "まだ見ぬ一回"; button.append(badge);
      button.disabled = selected !== null;
      button.addEventListener("click", () => inspect(ep));
      button.addEventListener("focus", () => inspect(ep));
      button.addEventListener("keydown", event => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault(); cards.querySelectorAll(".lab-choose")[(index + step + 3) % 3].focus();
      });
      card.append(button);
      if (senderPick === ep.number) { const mark = document.createElement("span"); mark.className = "lab-sender"; mark.textContent = "紹介した人の選択"; card.append(mark); }
      cards.append(card);
    });
    root.classList.toggle("has-selection", selected !== null);
    if (selected === null) inspect(byNumber.get(inspected));
  }
  function inspect(ep) {
    if (!ep || selected !== null) return;
    inspected = ep.number;
    $("#labInspectNumber").textContent = `第${ep.number}回 · ${ep.date || ""}`;
    $("#labInspectTitle").textContent = ep.title;
    $("#labInspectTags").textContent = (ep.tags || []).slice(0,2).join(" / ") || "どんな話か、出会ってみよう。";
    $("#labConfirm").setAttribute("aria-label", `第${ep.number}回を相棒にする`);
    $("#labCards").querySelectorAll(".lab-card").forEach(card => {
      const active = Number(card.dataset.number) === inspected;
      card.classList.toggle("is-inspected", active);
      card.querySelector("button").setAttribute("aria-pressed", String(active));
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
    $("#labInspection").hidden = true;
    $("#labStageHint").textContent = "相棒を図鑑に登録した！ 次の3択にも、すぐ出会える。";
    renderCards(); updateCollection(); updateShare();
    $("#labListen").focus({preventScroll:true});
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
    selected = null; inspected = round[1].number; imageVersion++;
    $("#labResult").hidden = true;
    $("#labInspection").hidden = false;
    $("#labStageHint").textContent = "気になるカートリッジをタップして調べよう";
    $("#labSpeech").textContent = "そこに3つのエピソードがあるじゃろう！";
    $(".lab-sub").textContent = "気になる一回を、今日の相棒に選ぶのじゃ。";
    renderCards(); updateShare();
  }
  $("#labShuffle").addEventListener("click", () => {
    $("#labNotice").hidden = true; newRound();
    $(".lab-card.is-inspected .lab-choose").focus({preventScroll:true});
  });
  $("#labConfirm").addEventListener("click", () => choose(byNumber.get(inspected)));
  let motionPaused = false, sceneVisible = true;
  const syncMotion = () => root.classList.toggle("lab-paused", motionPaused || document.hidden || !sceneVisible || !!root.querySelector("dialog[open]"));
  $("#labMotion").addEventListener("click", () => {
    motionPaused = !motionPaused;
    $("#labMotion").textContent = motionPaused ? "動き OFF" : "動き ON";
    $("#labMotion").setAttribute("aria-pressed", String(motionPaused));
    $("#labMotion").setAttribute("aria-label", motionPaused ? "動きを再開する" : "動きを止める");
    syncMotion();
  });
  page.listen(document, "visibilitychange", syncMotion);
  const sceneObserver = new IntersectionObserver(entries => { sceneVisible = entries[0].isIntersecting; syncMotion(); });
  sceneObserver.observe($(".lab-scene"));
  for (const [trigger, target] of [["labDexToggle", "labDex"], ["labShareToggle", "labToolsDialog"]]) {
    $("#" + trigger).addEventListener("click", () => { $("#" + target).showModal(); syncMotion(); });
  }
  root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $("#" + button.dataset.close).close()));
  root.querySelectorAll("dialog").forEach(modal => modal.addEventListener("close", syncMotion));
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
    dialog.showModal(); syncMotion(); $("#labSharePreview").hidden = true; $("#labDownload").hidden = true;
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
  page.onDispose(() => { disposed = true; imageVersion++; sceneObserver.disconnect(); root.querySelectorAll("dialog[open]").forEach(modal => modal.close()); if (objectUrl) URL.revokeObjectURL(objectUrl); });
  syncMotion();
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
