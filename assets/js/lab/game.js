const PARTY_KEY = "takitsubo:episode-lab:party:v1";
const DEX_KEY = "takitsubo:episode-lab:dex:v1";
const COLLECTION_KEY = "takitsubo:episode-lab:collection:v1";
// Compatibility import only. All current reads/writes use the lab's own key.
function savedCollection(storage) {
  const current = storage.getItem(COLLECTION_KEY);
  if (current !== null) return JSON.parse(current);
  const legacy = JSON.parse(storage.getItem("takitsubo:excavation:v1") || "[]");
  const imported = Array.isArray(legacy) ? legacy.filter(Number.isInteger) : [];
  // Do not remove the old record; rollback must not lose a user's collection.
  return imported;
}
const FALLBACK = "assets/img/artwork_320.jpg";
const CASE_COLORS = {
  gray: ["#b9bab8", "#e7e7df", "#747e7c", "#455452"],
  black: ["#414c55", "#71818a", "#202d37", "#d9e3df"],
  amber: ["#e9bc46", "#fff0a0", "#ac7932", "#685024"],
  coral: ["#dc8079", "#ffbcb1", "#9d4950", "#6d363e"],
  mint: ["#77baa0", "#bcebd1", "#3d8173", "#285f56"],
  blue: ["#759bc9", "#beddf4", "#446c9e", "#294d74"],
  violet: ["#b094c8", "#dfcaf0", "#78609c", "#51406a"],
  ivory: ["#e6d9ae", "#fff9df", "#a89c72", "#6d664b"]
};
// Frozen v1 mapping: do not change the mixer or palette order when episodes grow.
export function cartridgeTone(number) {
  let n = (number ^ 0x54b1f2a7) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  n = (n ^ (n >>> 16)) >>> 0;
  const bucket = n % 10000;
  return bucket < 7000 ? "gray" : bucket < 9000 ? "black" : ["amber", "coral", "mint", "blue", "violet", "ivory"][Math.floor(n / 10000) % 6];
}

function createCartridge(ep, miniature = false) {
  const art = document.createElement("span"); art.className = "lab-art" + (miniature ? " lab-miniature" : "");
  art.dataset.tone = cartridgeTone(ep.number);
  CASE_COLORS[art.dataset.tone].forEach((color, i) => art.style.setProperty(["--case-body", "--case-light", "--case-dark", "--case-ink"][i], color));
  const front = `<span class="lab-cart-front">
    <svg class="lab-cart-shell" viewBox="0 0 240 280" aria-hidden="true">
      <path fill="var(--case-body)" stroke="var(--case-dark)" stroke-width="3" d="M7 2h204l9 10v10h13q5 0 5 5v246q0 5-5 5H7q-5 0-5-5V7q0-5 5-5Z"/>
      <path fill="none" stroke="var(--case-light)" stroke-width="3" d="M7 272V7h202l8 9M223 26h10v244"/>
      <rect x="33" y="15" width="172" height="34" rx="12" fill="var(--case-dark)" opacity=".24"/>
      <path fill="none" stroke="var(--case-dark)" stroke-width="2" d="M46 15h146q13 0 13 13M33 37q0 12 13 12h146"/>
      <path fill="none" stroke="var(--case-light)" stroke-width="2" d="M35 37q0 11 12 11h143M9 23h20m-20 8h20m-20 8h20m-20 8h20M210 29h21m-21 8h21m-21 8h21m-21 8h21"/>
      <path fill="none" stroke="var(--case-dark)" stroke-width="2" d="M9 21h20m-20 8h20m-20 8h20m-20 8h20M210 27h21m-21 8h21m-21 8h21m-21 8h21"/>
      <text x="119" y="36" text-anchor="middle" fill="var(--case-light)" font-family="Arial,sans-serif" font-size="10.5" font-weight="bold" textLength="157" lengthAdjust="spacingAndGlyphs">GAME NO TAKITSUBO</text>
      <text x="119" y="35" text-anchor="middle" fill="var(--case-ink)" font-family="Arial,sans-serif" font-size="10.5" font-weight="bold" textLength="157" lengthAdjust="spacingAndGlyphs">GAME NO TAKITSUBO</text>
      <rect x="15" y="59" width="210" height="210" rx="6" fill="var(--case-dark)"/>
      <path fill="none" stroke="var(--case-light)" stroke-width="2" d="M18 264q0 5 5 5h195q7 0 7-7V65"/>
      <path fill="var(--case-dark)" d="M120 270q-8 7 0 7t0-7Z"/>
    </svg><span class="lab-cart-picture"></span></span>`;
  const sides = miniature ? "" : `<span class="lab-cart-back"></span><span class="lab-cart-side lab-cart-left"></span><span class="lab-cart-side lab-cart-right"></span><span class="lab-cart-top"></span><span class="lab-cart-step"></span><span class="lab-cart-step-top"></span><span class="lab-cart-bottom"></span>`;
  art.innerHTML = `<span class="lab-float"><span class="lab-cartridge">${sides}${front}</span></span>`;
  const img = document.createElement("img"); img.src = ep.image || FALLBACK; img.alt = ""; img.draggable = false;
  if (miniature) img.loading = "lazy";
  img.onerror = () => { img.onerror = null; img.src = FALLBACK; };
  art.querySelector(".lab-cart-picture").append(img);
  return art;
}
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
  const {wrapLines, mountShareControls} = await import(new URL(root.dataset.shareModule, location.href));
  const response = await fetch(root.dataset.source, { signal: page.signal });
  if (!response.ok) throw new Error("Episode data unavailable");
  const data = await response.json();
  if (page.signal.aborted) return;
  const episodes = data.episodes.filter(e => Number.isInteger(e.number) && e.number > 0 && typeof e.title === "string");
  const byNumber = new Map(episodes.map(e => [e.number, e]));
  if (byNumber.size < 3) throw new Error("Three episodes are required");
  let collection = new Set(), saveAvailable = true, round = [], selected = null, senderPick = null;
  let inspected = null, shareControls;
  let party = [], ascending = false, showUnseen = true, itemNumber = null, replacing = null;
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
  const shareBase = new URL("lab.html", location.href);
  const mergeCollection = () => {
    try {
      const saved = savedCollection(localStorage);
      if (Array.isArray(saved)) saved.forEach(n => { if (byNumber.has(n)) collection.add(n); });
      if (localStorage.getItem(COLLECTION_KEY) === null && collection.size) localStorage.setItem(COLLECTION_KEY, JSON.stringify([...collection]));
    } catch (_) { saveAvailable = false; }
  };
  mergeCollection();
  function readParty() {
    if (!saveAvailable) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PARTY_KEY) || "[]");
      party = Array.isArray(saved) ? [...new Set(saved.filter(n => Number.isInteger(n) && byNumber.has(n) && collection.has(n)))].slice(0,6) : [];
    } catch (_) { saveAvailable = false; }
  }
  readParty();
  try {
    const prefs = JSON.parse(localStorage.getItem(DEX_KEY) || "{}");
    ascending = prefs?.order === "asc"; showUnseen = prefs?.showUnseen !== false;
  } catch (_) { saveAvailable = false; }
  root.innerHTML = `
<div class="lab-wrap">

  <div class="lab-machine">
  <div class="lab-machine-tools"><button type="button" id="labMotion" class="lab-icon-button" aria-pressed="false" aria-label="動きを止める">動き ON</button></div>
  <section class="lab-scene" aria-label="カートリッジが浮かぶ研究所">
    <svg class="lab-room" viewBox="0 0 1000 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shape-rendering="crispEdges">
      <defs><pattern id="labWallTiles" width="100" height="76" patternUnits="userSpaceOnUse"><path fill="#dfefff" d="M0 0h100v76H0z"/><path fill="none" stroke="#bed9ef" stroke-width="2" d="M0 76V0h100"/></pattern><pattern id="labFloorTiles" width="100" height="44" patternUnits="userSpaceOnUse"><path fill="#badcec" d="M0 0h100v44H0z"/><path fill="none" stroke="#e7f6ff" stroke-width="2" d="M0 44V0h100"/></pattern></defs>
      <path fill="url(#labWallTiles)" d="M0 0h1000v340H0z"/><path fill="#a5cbe5" d="M0 285h1000v62H0z"/><path fill="#f4fbff" d="M0 278h1000v8H0z"/><path fill="#6799bd" d="M0 332h1000v14H0z"/><path fill="url(#labFloorTiles)" d="M0 346h1000v124H0z"/>
      <path fill="#729c99" d="M54 52h220v178H54z"/><path fill="#fff9dc" d="M60 46h208v174H60z"/><path fill="#9fe3ef" d="M70 56h188v154H70z"/><path fill="#75afa4" d="M70 124 108 93l50 29 42-47 58 31v104H70z"/><path fill="#9bcd84" d="m70 161 49-22 37 20 62-36 40 25v62H70z"/><path fill="#bce9df" d="M179 87h23v95h-23zM166 183h49v7h-49zM152 195h78v6h-78z"/><path fill="#fff9dc" d="M161 56h6v154h-6zM70 128h188v6H70z"/>
      <path fill="#729c99" d="M762 74h186v159H762z"/><path fill="#f4e6bb" d="M753 64h186v159H753z"/><path fill="#668f94" d="M763 74h166v59H763zM763 145h166v65H763z"/><path fill="#d98e6f" d="M778 88h15v43h-15zM801 92h11v39h-11z"/><path fill="#d0b76e" d="M818 84h20v47h-20z"/><path fill="#87b9af" d="M850 98h55v33h-55z"/><path fill="#d9e2cc" d="M861 104h32v4h-32zM861 114h22v4h-22z"/><path fill="#8dd1c0" d="M782 170h24v31h-24zM788 153h12v17h-12z"/><path fill="#c2c7e7" d="M830 180h32v21h-32zM838 157h16v23h-16z"/><path fill="#e1b971" d="M883 156h30v45h-30z"/>
      <path fill="#80aba4" d="M353 38h294v94H353z"/><path fill="#f3faff" d="M358 33h284v92H358z"/><path fill="#427981" d="M369 44h262v70H369z"/><path fill="none" stroke="#aeeaff" stroke-width="4" d="M388 80h20l8-15 12 30 10-40 14 48 9-23h30m20 0h15l9-23 11 42 12-27 8 8h39"/>
      <path fill="#d0e5f4" d="M337 0h326v8H337z"/><path fill="#edf7ff" d="M361 8h278v7H361z"/><path fill="#83aca1" d="M28 272h84v60H28zM902 272h70v60h-70z"/><path fill="#8fa987" d="M41 246h59v27H41zM50 220h13v30H50zM77 232h15v23H77z"/>
    </svg>
    <section id="labCards" class="lab-cards" aria-label="博士の3つの候補"></section>
  </section>
  <section class="lab-console" aria-label="博士とエピソードを選ぶ">
  <div class="lab-dialogue"><div class="lab-doctor">${DOCTOR}<span>ポッドキャスト博士</span></div><div class="lab-speech"><span class="lab-speaker">はかせ</span><p id="labSpeech">そこに3つのエピソードがあるじゃろう！</p><p class="lab-sub">気になる一回を、セットしてみるのじゃ。</p></div></div>
  <p id="labNotice" class="lab-notice" role="status" hidden></p>
  <div class="lab-inspection" id="labInspection" hidden><div aria-live="polite" aria-atomic="true"><p class="lab-number" id="labInspectNumber"></p><h2 id="labInspectTitle"></h2><p class="lab-tags" id="labInspectTags"></p></div><button type="button" id="labConfirm" class="lab-primary">この回をセット →</button></div>
  <section id="labResult" class="lab-result" hidden aria-label="選んだエピソード"><div><span class="lab-kicker">セット中</span><p id="labResultTitle"></p><span id="labSaved"></span></div><div class="lab-result-actions"><a id="labListen" class="lab-primary">このエピソードへ →</a><button type="button" id="labAddParty" class="lab-secondary">手持ちに加える</button></div></section>
  </section>
  <nav class="lab-toolbar" aria-label="研究所のメニュー"><button type="button" id="labShuffle" class="lab-secondary">↻ 別の3択</button><button type="button" id="labDexToggle" class="lab-secondary" aria-haspopup="dialog"><span>図鑑</span><strong id="labCount"></strong></button></nav>
  </div>
  <section id="labShare" aria-label="この3択をシェア"></section>
  <p class="lab-footnote" ${isLocal ? "" : "hidden"}>試作中のリンクはこのPC内での確認用。画像は保存して共有できる。</p>
  <section class="lab-case" aria-labelledby="labPartyHeading">
    <div class="lab-case-heading"><h2 id="labPartyHeading">カートリッジケース</h2><span id="labPartyCount"></span></div>
    <p class="lab-footnote">気に入った回を、6本まで。図鑑からも選べるよ。</p>
    <div id="labPartyGrid"></div><p id="labPartyStatus" class="lab-footnote" role="status"></p>
  </section>

</div>
<dialog id="labDex" aria-labelledby="labDexHeading"><div class="lab-modal-top"><h2 id="labDexHeading">わたしのエピソード図鑑</h2><button type="button" class="lab-close" data-close="labDex" aria-label="図鑑を閉じる">×</button></div><div class="lab-dex-controls"><label>並び順 <select id="labDexOrder"><option value="desc">第○回が大きい順</option><option value="asc">第○回が小さい順</option></select></label><label><input type="checkbox" id="labDexUnseen"> 未発見も表示</label><span id="labDexCount"></span></div><div id="labDexGrid"></div><p class="lab-footnote" id="labStorageNote">このブラウザに保存。聴いたかどうかは記録しない。</p></dialog>
`;
  root.insertAdjacentHTML("beforeend", `<dialog id="labItem" aria-labelledby="labItemTitle">
    <div class="lab-modal-top"><h2 id="labItemTitle"></h2><button type="button" class="lab-close" data-close="labItem" aria-label="カートリッジの詳細を閉じる">×</button></div>
    <div id="labItemArt"></div><p id="labItemTags" class="lab-footnote"></p>
    <div class="lab-item-actions"><a id="labItemLink" class="lab-primary">エピソードを開く →</a><button type="button" id="labItemAdd" class="lab-secondary">手持ちに加える</button><button type="button" id="labItemSet" class="lab-secondary">研究所にセット</button></div>
    <p class="lab-footnote">セットすると、この回とランダムな2本を研究所に並べるよ。</p>
    <button type="button" id="labItemRemove" class="lab-remove">手持ちから外す</button>
  </dialog><dialog id="labReplace" aria-labelledby="labReplaceTitle">
    <div class="lab-modal-top"><h2 id="labReplaceTitle">どの1本と入れ替える？</h2><button type="button" class="lab-close" data-close="labReplace" aria-label="入れ替えをやめる">×</button></div>
    <p id="labReplaceIncoming"></p><p class="lab-footnote">外した回も図鑑に残るよ。</p><div id="labReplaceGrid"></div>
  </dialog>`);
  const $ = s => root.querySelector(s);
  function cartridgeButton(number, action) {
    const ep = byNumber.get(number), button = document.createElement("button");
    button.type = "button"; button.className = "lab-owned"; button.dataset.number = number;
    button.setAttribute("aria-label", `第${number}回 ${ep.title}`);
    const title = document.createElement("span"); title.className = "lab-dex-title"; title.textContent = `第${number}回 ${ep.title}`;
    button.append(createCartridge(ep, true), title); button.addEventListener("click", action);
    return button;
  }
  function updateCollection() {
    $("#labCount").textContent = `${collection.size} / ${byNumber.size}`;
    $("#labDexCount").textContent = `発見 ${collection.size} / ${byNumber.size}`;
    $("#labDexOrder").value = ascending ? "asc" : "desc"; $("#labDexUnseen").checked = showUnseen;
    const grid = $("#labDexGrid"); grid.replaceChildren();
    const numbers = [...byNumber.keys()].filter(n => showUnseen || collection.has(n)).sort((a,b) => ascending ? a-b : b-a);
    if (!numbers.length) { const p = document.createElement("p"); p.textContent = "3択から一回をセットすると、ここに記録されるよ。"; grid.append(p); }
    numbers.forEach(number => {
      if(!collection.has(number)) {
        const tile = document.createElement("div"); tile.className = "lab-undiscovered"; tile.dataset.number = number;
        tile.setAttribute("aria-label", `第${number}回 未発見`);
        const silhouette = document.createElement("span"); silhouette.className = "lab-silhouette"; silhouette.setAttribute("aria-hidden","true");
        const label = document.createElement("span"); label.className = "lab-dex-title"; label.textContent = `第${number}回`;
        tile.append(silhouette,label); grid.append(tile); return;
      }
      const button = cartridgeButton(number, () => openItem(number));
      if(party.includes(number)) { const mark=document.createElement("span");mark.className="lab-party-mark";mark.textContent="手持ち";button.append(mark); }
      grid.append(button);
    });
    if (!saveAvailable) $("#labStorageNote").textContent = "保存を利用できないため、この画面内だけで記録しているよ。";
  }
  function updateParty() {
    $("#labPartyCount").textContent = `${party.length} / 6`;
    const grid = $("#labPartyGrid"); grid.replaceChildren();
    for(let i=0;i<6;i++) {
      if(party[i] !== undefined) { grid.append(cartridgeButton(party[i],()=>openItem(party[i]))); }
      else { const slot=document.createElement("div");slot.className="lab-empty-slot";slot.setAttribute("aria-label",`空き枠 ${i+1}`);slot.textContent=String(i+1).padStart(2,"0");grid.append(slot); }
    }
    $("#labAddParty").disabled = selected === null || party.includes(selected);
    $("#labAddParty").textContent = party.includes(selected) ? "手持ちに登録済み" : "手持ちに加える";
    if(!saveAvailable) $("#labPartyStatus").textContent="端末への保存を使えないため、この画面内だけで保持しているよ。";
  }
  function saveParty(message) {
    try { localStorage.setItem(PARTY_KEY, JSON.stringify(party)); } catch (_) { saveAvailable = false; }
    $("#labPartyStatus").textContent=message; updateParty(); updateCollection();
    if(itemNumber !== null && $("#labItem").open) refreshItem();
  }
  function refreshItem() {
    const ep=byNumber.get(itemNumber), held=party.includes(itemNumber);
    $("#labItemTitle").textContent=`第${itemNumber}回 ${ep.title}`;
    $("#labItemArt").replaceChildren(createCartridge(ep,true));
    $("#labItemTags").textContent=(ep.tags||[]).join(" / ");
    $("#labItemLink").href=`episodes/${itemNumber}.html`;
    $("#labItemAdd").disabled=held; $("#labItemAdd").textContent=held?"手持ちに登録済み":"手持ちに加える";
    $("#labItemRemove").hidden=!held;
  }
  function openItem(number) { itemNumber=number;refreshItem();$("#labItem").showModal();syncMotion(); }
  function renderReplacements() {
    const grid=$("#labReplaceGrid");grid.replaceChildren();
    if(party.includes(replacing)) {
      $("#labReplace").close(); replacing=null; return;
    }
    if(party.length < 6) {
      const add=document.createElement("button");add.type="button";add.className="lab-secondary";add.textContent="空き枠に加える";
      add.addEventListener("click",()=>{const number=replacing;$("#labReplace").close();replacing=null;addParty(number);});
      grid.append(add);
    }
    party.forEach(number=>grid.append(cartridgeButton(number,()=>{
      // Re-read before replacing so another tab cannot silently change the target slot.
      mergeCollection();readParty();
      const index=party.indexOf(number);
      if(index<0 || party.includes(replacing)) { renderReplacements(); return; }
      party[index]=replacing;
      saveParty(`第${replacing}回を手持ちに加えたよ。第${number}回は図鑑に残っている。`);
      $("#labReplace").close(); replacing=null;
    })));
  }
  function addParty(number) {
    if(!collection.has(number)) return;
    mergeCollection();readParty();
    if(party.includes(number)) { updateParty(); return; }
    if(party.length<6) { party.push(number);saveParty(`第${number}回を手持ちに加えたよ。`);return; }
    replacing=number;$("#labReplaceIncoming").textContent=`加える回：第${number}回 ${byNumber.get(number).title}`;
    renderReplacements();$("#labReplace").showModal();syncMotion();
  }
  function roundUrl(includeSelection = true) {
    const url = new URL(shareBase);
    url.searchParams.set("eps", round.map(e => e.number).join(","));
    const pick = includeSelection ? selected ?? senderPick : null;
    if (pick !== null) url.searchParams.set("pick", pick);
    return url;
  }
  let shareIntent = "";
  function updateShare(reset = false) {
    const url = roundUrl();
    history.replaceState(history.state, "", url);
    const chosen = selected ?? senderPick;
    const text = chosen === null ? "博士からこの3択！ あなたならどれ？" : selected === null ? `この3択、紹介した人は第${chosen}回を選んだ！ あなたならどれ？` : `この3択、私は第${chosen}回を選んだ！ あなたならどれ？`;
    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", `${text}\n${round.map(e => `第${e.number}回 ${Array.from(e.title).slice(0,28).join("")}${Array.from(e.title).length>28?"…":""}`).join("\n")}\n#ゲームの滝壺`);
    if (!isLocal) intent.searchParams.set("url", url.href);
    shareIntent = intent.href;
    shareControls?.invalidate({reset});
  }
  function renderCards() {
    const cards = $("#labCards"); cards.replaceChildren();
    round.forEach((ep, index) => {
      const card = document.createElement("article"); card.className = "lab-card" + (selected === ep.number ? " is-selected" : ""); card.dataset.number = ep.number;
      card.style.setProperty("--slot", index);
      const button = document.createElement("button"); button.type = "button"; button.className = "lab-choose";
      button.setAttribute("aria-label", `第${ep.number}回 ${ep.title}を調べる`);
      button.setAttribute("aria-controls", "labInspection");
      button.setAttribute("aria-pressed", String(ep.number === (selected ?? inspected)));
      const pedestal = document.createElement("span"); pedestal.className = "lab-pedestal"; pedestal.setAttribute("aria-hidden", "true");
      button.append(createCartridge(ep), pedestal);
      const title = document.createElement("span"); title.className = "lab-card-title"; title.textContent = ep.title; button.append(title);
      const badge = document.createElement("span"); badge.className = "lab-card-badge"; badge.textContent = selected === ep.number ? "✓ セット中" : collection.has(ep.number) ? "図鑑に登録済み" : ""; button.append(badge);

      button.addEventListener("click", () => inspect(ep));

      button.addEventListener("keydown", event => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault(); const next = (index + step + 3) % 3; inspect(round[next]); cards.querySelectorAll(".lab-choose")[next].focus({preventScroll:true});
      });
      card.append(button);
      if (senderPick === ep.number) { const mark = document.createElement("span"); mark.className = "lab-sender"; mark.textContent = "紹介した人の選択"; card.append(mark); }
      cards.append(card);
    });
    root.classList.toggle("has-selection", selected !== null);
    cards.dataset.active = String(round.findIndex(ep => ep.number === (selected ?? inspected)));
    if (selected === null) inspect(byNumber.get(inspected));
  }
  function inspect(ep) {
    if (!ep) return;
    inspected = ep.number;
    $("#labInspection").hidden = selected === ep.number;
    $("#labCards").dataset.active = String(round.findIndex(item => item.number === inspected));
    $("#labInspectNumber").textContent = `第${ep.number}回 · ${ep.date || ""}`;
    $("#labInspectTitle").textContent = ep.title;
    $("#labInspectTags").textContent = (ep.tags || []).slice(0,2).join(" / ") || "どんな話か、出会ってみよう。";
    $("#labConfirm").setAttribute("aria-label", `第${ep.number}回をセットする`);
    $("#labCards").querySelectorAll(".lab-card").forEach(card => {
      const active = Number(card.dataset.number) === inspected;
      card.classList.toggle("is-inspected", active);
      card.querySelector("button").setAttribute("aria-pressed", String(active));
    });
  }
  function choose(ep) {
    if (!ep) return;
    mergeCollection(); const isNew = !collection.has(ep.number); selected = ep.number; inspected = ep.number; collection.add(ep.number);
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify([...collection])); } catch (_) { saveAvailable = false; }
    $("#labSpeech").textContent = "ほう、その一回を選ぶのじゃな！";
    $(".lab-sub").textContent = "君は何に惹かれたのかのう。ほかの人にも聞いてみよう。";
    $("#labResult").hidden = false; $("#labResultTitle").textContent = `第${ep.number}回 ${ep.title}`;
    $("#labSaved").textContent = !saveAvailable ? "この画面の図鑑に記録したよ（端末への保存は利用できない）。" : isNew ? "新しい一枚を図鑑に登録したよ。" : "お気に入りとの再会も、いいものじゃ。";
    $("#labListen").href = `episodes/${ep.number}.html`;
    $("#labInspection").hidden = true;
    renderCards(); updateCollection(); updateParty(); updateShare();
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
    selected = null; inspected = null;
    $("#labResult").hidden = true;
    $("#labInspection").hidden = true;
    $("#labSpeech").textContent = "そこに3つのエピソードがあるじゃろう！";
    $(".lab-sub").textContent = "気になる一回を、セットしてみるのじゃ。";
    renderCards(); updateParty(); updateShare(true);
  }
  $("#labShuffle").addEventListener("click", () => {
    $("#labNotice").hidden = true; newRound();
    $("#labShuffle").focus({preventScroll:true});
  });
  $("#labConfirm").addEventListener("click", () => choose(byNumber.get(inspected)));
  $("#labAddParty").addEventListener("click",()=>addParty(selected));
  $("#labItemAdd").addEventListener("click",()=>addParty(itemNumber));
  $("#labItemRemove").addEventListener("click",()=>{
    mergeCollection();readParty(); party=party.filter(n=>n!==itemNumber);
    saveParty(`第${itemNumber}回を手持ちから外したよ。図鑑からいつでも戻せる。`);
    $("#labItemAdd").focus();
  });
  $("#labItemSet").addEventListener("click",()=>{
    const number=itemNumber;
    root.querySelectorAll("dialog[open]").forEach(d=>d.close());
    $("#labNotice").hidden = true;
    if(!round.some(ep=>ep.number===number)) {
      const pool=episodes.filter(ep=>ep.number!==number), ids=[number];
      while(ids.length<3) ids.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0].number);
      senderPick=null;newRound(ids);
    }
    choose(byNumber.get(number));$(".lab-scene").scrollIntoView({behavior:"instant",block:"start"});
  });
  function saveDexPreferences() {
    ascending=$("#labDexOrder").value==="asc";showUnseen=$("#labDexUnseen").checked;
    try { localStorage.setItem(DEX_KEY,JSON.stringify({order:ascending?"asc":"desc",showUnseen})); } catch (_) { saveAvailable=false; }
    updateCollection();
  }
  $("#labDexOrder").addEventListener("change",saveDexPreferences);
  $("#labDexUnseen").addEventListener("change",saveDexPreferences);
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
  // Resize/scroll can queue several transitions for the same scene in one batch.
  // The newest observation, not the first one, determines whether motion resumes.
  const sceneObserver = new IntersectionObserver(entries => { sceneVisible = entries.at(-1).isIntersecting; syncMotion(); });
  sceneObserver.observe($(".lab-scene"));
  for (const [trigger, target] of [["labDexToggle", "labDex"]]) {
    $("#" + trigger).addEventListener("click", () => { $("#" + target).showModal(); syncMotion(); });
  }
  root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $("#" + button.dataset.close).close()));
  root.querySelectorAll("dialog").forEach(modal => modal.addEventListener("close", syncMotion));
  // Updating a case/dex rebuilds its opener. Restore focus to an existing control.
  $("#labItem").addEventListener("close",()=>{
    if($("#labDex").open) ($(`#labDexGrid [data-number="${itemNumber}"]`) || $("#labDexOrder")).focus({preventScroll:true});
    else if(!root.querySelector("dialog[open]") && document.activeElement === document.body) ($(`#labPartyGrid [data-number="${itemNumber}"]`) || $("#labDexToggle")).focus({preventScroll:true});
  });
  $("#labReplace").addEventListener("close",()=>{
    if($("#labItem").open) $("#labItemSet").focus({preventScroll:true});
    else if(!root.querySelector("dialog[open]")) $("#labListen").focus({preventScroll:true});
  });
  page.listen(window,"storage", e => {
    if(e.key === COLLECTION_KEY || e.key === PARTY_KEY) {
      mergeCollection(); readParty(); updateCollection(); updateParty(); renderCards();
      if($("#labItem").open) refreshItem();
      if($("#labReplace").open) renderReplacements();
    }
  });
  shareControls = mountShareControls($("#labShare"), {
    prefix: "lab", signal: page.signal, previewMode: "on-demand",
    getBlob: () => createShareImage(round.slice(), selected ?? senderPick, page.signal, selected === null && senderPick !== null, wrapLines),
    getLink: () => roundUrl().href, getX: () => shareIntent,
    filename: () => `takitsubo-${round.map(e=>e.number).join("-")}${selected === null ? "" : `-pick-${selected}`}.png`
  });
  page.onDispose(() => { sceneObserver.disconnect(); root.querySelectorAll("dialog[open]").forEach(modal => modal.close()); });
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

async function createShareImage(episodes, chosen, signal, fromSender, wrapLines) {
  await document.fonts.ready;
  const images = await Promise.all(episodes.map(e => imageFor(e, signal)));
  const shells = await Promise.all(episodes.map(ep => {
    const art = createCartridge(ep, true), svg = art.querySelector("svg");
    let source = new XMLSerializer().serializeToString(svg);
    CASE_COLORS[cartridgeTone(ep.number)].forEach((color,i) => {
      source = source.replaceAll(`var(${["--case-body","--case-light","--case-dark","--case-ink"][i]})`, color);
    });
    return imageFor({image:"data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)}, signal);
  }));
  if(signal.aborted) throw new DOMException("Disposed", "AbortError");
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 800;
  const c = canvas.getContext("2d"), ink = "#254e70";
  c.fillStyle = "#e7f4ff"; c.fillRect(0,0,1200,800);
  c.strokeStyle = "#cee5f5"; c.lineWidth=1;
  for(let y=0;y<800;y+=32) { c.beginPath(); c.moveTo(0,y); c.lineTo(1200,y); c.stroke(); }
  c.fillStyle=ink;c.font='bold 40px "Noto Sans JP",sans-serif';c.fillText("この3択、あなたならどれ？",44,76);
  episodes.forEach((ep,i) => {
    const x=54+i*380, y=146, w=310, h=w*7/6;
    c.fillStyle="#92b2cc"; c.fillRect(x+8,y+16,w,h-8);
    if(shells[i]) c.drawImage(shells[i],x,y,w,h);
    const ix=x+w*.0875, iy=y+h*.2357, iw=w*.825;
    c.fillStyle="#fff";c.fillRect(ix,iy,iw,iw);
    const img=images[i];
    if(img) { const scale=Math.min(iw/img.naturalWidth,iw/img.naturalHeight);c.drawImage(img,ix+(iw-img.naturalWidth*scale)/2,iy+(iw-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale); }
    c.fillStyle=ink;c.font='bold 19px "Noto Sans JP",sans-serif';c.fillText(`第${ep.number}回`,x,y+h+37);
    c.font='bold 21px "Noto Sans JP",sans-serif';
    wrapLines(c,ep.title,320,4).forEach((line,j)=>c.fillText(line,x,y+h+73+j*30));
    if(ep.number===chosen) {
      c.fillStyle=ink;c.fillRect(x+12,103,w-24,32);c.fillStyle="#fff";c.textAlign="center";c.font='bold 18px "Noto Sans JP",sans-serif';
      c.fillText(fromSender?"✓ 紹介した人の選択":"✓ 私はこれ",x+w/2,126);c.textAlign="left";
    }
  });
  c.fillStyle=ink;c.fillRect(0,748,1200,52);c.fillStyle="#fff";c.font='bold 19px "Noto Sans JP",sans-serif';c.fillText("ゲームの滝壺 / エピソード研究所",44,782);
  c.textAlign="right";c.fillText("#ゲームの滝壺",1156,782);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed")),"image/png"));
}
