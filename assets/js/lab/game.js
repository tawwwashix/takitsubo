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
  let inspected = null, partyShareControls, partySignature = null;
  let reorderMode=false, reorderSource=null, replacingFromRound=false;
  let party = [], ascending = false, showUnseen = true, itemNumber = null, replacing = null;
  const shareBase = new URL(root.dataset.sharePage);
  const shareHashtags = "#ゲームの滝壺 #滝壺エピソード研究所";
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
  <div class="lab-machine-tools"><div class="lab-dialogue"><div class="lab-doctor"><img src="assets/img/hyuuma.webp" alt="ひゅうま" width="48" height="48"></div><p id="labSpeech">そこに3つのエピソードがあるじゃろう！</p></div><button type="button" id="labMotion" class="lab-icon-button" aria-pressed="false" aria-label="動きを止める">動き ON</button></div>
  <section class="lab-scene" aria-label="カートリッジが浮かぶ研究所">
    <svg class="lab-room" viewBox="0 0 1000 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shape-rendering="crispEdges">
      <defs><pattern id="labWallTiles" width="100" height="76" patternUnits="userSpaceOnUse"><path fill="#dfefff" d="M0 0h100v76H0z"/><path fill="none" stroke="#bed9ef" stroke-width="2" d="M0 76V0h100"/></pattern></defs>
      <path fill="url(#labWallTiles)" d="M0 0h1000v340H0z"/><path fill="#a5cbe5" d="M0 285h1000v62H0z"/><path fill="#f4fbff" d="M0 278h1000v8H0z"/><path fill="#6799bd" d="M0 332h1000v14H0z"/>
      <path fill="#729c99" d="M54 52h220v178H54z"/><path fill="#fff9dc" d="M60 46h208v174H60z"/><path fill="#9fe3ef" d="M70 56h188v154H70z"/><path fill="#75afa4" d="M70 124 108 93l50 29 42-47 58 31v104H70z"/><path fill="#9bcd84" d="m70 161 49-22 37 20 62-36 40 25v62H70z"/><path fill="#bce9df" d="M179 87h23v95h-23zM166 183h49v7h-49zM152 195h78v6h-78z"/><path fill="#fff9dc" d="M161 56h6v154h-6zM70 128h188v6H70z"/>
      <path fill="#729c99" d="M762 74h186v159H762z"/><path fill="#f4e6bb" d="M753 64h186v159H753z"/><path fill="#668f94" d="M763 74h166v59H763zM763 145h166v65H763z"/><path fill="#d98e6f" d="M778 88h15v43h-15zM801 92h11v39h-11z"/><path fill="#d0b76e" d="M818 84h20v47h-20z"/><path fill="#87b9af" d="M850 98h55v33h-55z"/><path fill="#d9e2cc" d="M861 104h32v4h-32zM861 114h22v4h-22z"/><path fill="#8dd1c0" d="M782 170h24v31h-24zM788 153h12v17h-12z"/><path fill="#c2c7e7" d="M830 180h32v21h-32zM838 157h16v23h-16z"/><path fill="#e1b971" d="M883 156h30v45h-30z"/>
      <path fill="#80aba4" d="M353 38h294v94H353z"/><path fill="#f3faff" d="M358 33h284v92H358z"/><path fill="#427981" d="M369 44h262v70H369z"/><path fill="none" stroke="#aeeaff" stroke-width="4" d="M388 80h20l8-15 12 30 10-40 14 48 9-23h30m20 0h15l9-23 11 42 12-27 8 8h39"/>
      <path fill="#d0e5f4" d="M337 0h326v8H337z"/><path fill="#edf7ff" d="M361 8h278v7H361z"/><path fill="#83aca1" d="M28 272h84v60H28zM902 272h70v60h-70z"/><path fill="#8fa987" d="M41 246h59v27H41zM50 220h13v30H50zM77 232h15v23H77z"/>
    </svg>
    <svg class="lab-floor" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#badcec" d="M0 0h1000v180H0z"/>
      <g stroke="#e7f6ff" stroke-width="2" fill="none"><path d="M0 12h1000M0 34h1000M0 68h1000M0 116h1000M0 178h1000"/><path d="M400 0 0 180M440 0 200 180M480 0 400 180M520 0 600 180M560 0 800 180M600 0 1000 180M360 0-200 180M640 0 1200 180"/></g>
    </svg>
    <section id="labCards" class="lab-cards" aria-label="博士の3つの候補"></section>
  </section>
  <section class="lab-console" aria-label="博士とエピソードを選ぶ">
  <p id="labNotice" class="lab-notice" role="status" hidden></p>
  <div class="lab-inspection" id="labInspection">
    <div class="lab-detail-stack"><div id="labDetailSizes" aria-hidden="true" inert></div><div class="lab-detail-copy" aria-live="polite" aria-atomic="true"><p class="lab-number" id="labInspectNumber"></p><h2 id="labInspectTitle"></h2><p class="lab-tags" id="labInspectTags"></p></div><p id="labInspectPrompt">どのエピソードにする？</p></div>
    <a id="labOpen" class="lab-primary lab-open" aria-describedby="labOpenNote" aria-disabled="true" tabindex="-1">エピソードページへ →</a>
    <p id="labOpenNote" class="lab-navigation-note">エピソードの詳細ページに移動します</p>
    <div class="lab-save-actions"><button type="button" id="labRegister" class="lab-secondary" disabled>図鑑に登録</button><button type="button" id="labConfirm" class="lab-secondary" disabled>手持ちに加える</button></div>
  </div>
  </section>
  <nav class="lab-toolbar" aria-label="研究所のメニュー"><button type="button" id="labShuffle" class="lab-secondary">↻ 別の3択</button><button type="button" id="labDexToggle" class="lab-secondary" aria-haspopup="dialog"><span>図鑑</span><strong id="labCount"></strong></button></nav>
  </div>
  <section class="lab-case" aria-labelledby="labPartyHeading">
    <div class="lab-case-heading"><h2 id="labPartyHeading">手持ちエピソード</h2><div class="lab-case-tools"><span id="labPartyCount"></span><button type="button" id="labReorder" class="lab-icon-button" aria-pressed="false">並び替え</button></div></div><p id="labReorderHint" class="lab-footnote" hidden>交換する2本を順に選んでね。</p>
    <div id="labPartyGrid"></div><p id="labPartyStatus" class="lab-footnote" role="status" hidden></p><span id="labPartyAnnounce" class="lab-sr-only" role="status"></span><section id="labPartyShare" aria-label="手持ちエピソードをシェア" hidden></section>
  </section>

</div>
<dialog id="labDex" aria-labelledby="labDexHeading"><div class="lab-modal-top"><h2 id="labDexHeading">エピソード図鑑</h2><button type="button" class="lab-close" data-close="labDex" aria-label="図鑑を閉じる">×</button></div><p class="lab-footnote" id="labStorageNote">※このブラウザに保存されます</p><div class="lab-dex-controls"><label>並び順 <select id="labDexOrder"><option value="desc">新しい順</option><option value="asc">古い順</option></select></label><label><input type="checkbox" id="labDexUnseen"> 未発見も表示</label><span id="labDexCount"></span></div><div id="labDexGrid"></div></dialog>
`;
  root.insertAdjacentHTML("beforeend", `<dialog id="labItem" aria-labelledby="labItemTitle">
    <div class="lab-modal-top"><h2 id="labItemTitle"></h2><button type="button" class="lab-close" data-close="labItem" aria-label="カートリッジの詳細を閉じる">×</button></div>
    <div id="labItemArt"></div><p id="labItemTags" class="lab-footnote"></p>
    <div class="lab-item-actions"><a id="labItemLink" class="lab-primary lab-open" aria-describedby="labItemLinkNote">エピソードページへ →</a><p id="labItemLinkNote" class="lab-navigation-note">エピソードの詳細ページに移動します</p><button type="button" id="labItemAdd" class="lab-secondary">手持ちに加える</button></div>
    <button type="button" id="labItemRemove" class="lab-remove">手持ちから外す</button>
  </dialog><dialog id="labReplace" aria-labelledby="labReplaceTitle">
    <div class="lab-modal-top"><h2 id="labReplaceTitle">手持ちがいっぱいだ！</h2><button type="button" class="lab-close" data-close="labReplace" aria-label="入れ替えをやめる">×</button></div>
    <p id="labReplaceIncoming"></p><button type="button" id="labSendDex" class="lab-secondary">図鑑に登録する</button><p class="lab-footnote">手持ちに加えるなら、入れ替える1本を選んでね。外した回も図鑑に残るよ。</p><div id="labReplaceGrid"></div>
  </dialog>`);
  const $ = s => root.querySelector(s);
  function cartridgeButton(number, action) {
    const ep = byNumber.get(number), button = document.createElement("button");
    button.type = "button"; button.className = "lab-owned"; button.dataset.number = number;
    button.setAttribute("aria-label", `#${number} ${ep.title}`);
    const title = document.createElement("span"); title.className = "lab-dex-title"; title.textContent = ep.title;
    const meta=document.createElement("span");meta.className="lab-card-meta";meta.textContent=`#${number}`;
    button.append(createCartridge(ep, true), meta, title); button.addEventListener("click", action);
    return button;
  }
  function updateCollection() {
    $("#labCount").textContent = `${collection.size} / ${byNumber.size}`;
    $("#labDexCount").textContent = `発見 ${collection.size} / ${byNumber.size}`;
    $("#labDexOrder").value = ascending ? "asc" : "desc"; $("#labDexUnseen").checked = showUnseen;
    const grid = $("#labDexGrid"); grid.replaceChildren();
    const numbers = [...byNumber.keys()].filter(n => showUnseen || collection.has(n)).sort((a,b) => ascending ? a-b : b-a);
    if (!numbers.length) { const p = document.createElement("p"); p.textContent = "気になる回を「図鑑に登録」すると、ここに記録されるよ。"; grid.append(p); }
    numbers.forEach(number => {
      if(!collection.has(number)) {
        const tile = document.createElement("div"); tile.className = "lab-undiscovered"; tile.dataset.number = number;
        tile.setAttribute("aria-label", `#${number} 未発見`);
        const silhouette = document.createElement("span"); silhouette.className = "lab-silhouette"; silhouette.setAttribute("aria-hidden","true");
        const label = document.createElement("span"); label.className = "lab-dex-title"; label.textContent = `#${number}`;
        tile.append(silhouette,label); grid.append(tile); return;
      }
      const button = cartridgeButton(number, () => openItem(number));
      if(party.includes(number)) { const mark=document.createElement("span");mark.className="lab-party-mark";mark.textContent="手持ち";button.querySelector(".lab-card-meta").append(mark); }
      grid.append(button);
    });
    if (!saveAvailable) $("#labStorageNote").textContent = "保存を利用できないため、この画面内だけで記録しているよ。";
  }
  function updateParty() {
    $("#labPartyCount").textContent = `${party.length} / 6`;
    const grid = $("#labPartyGrid"); grid.replaceChildren();
    for(let i=0;i<6;i++) {
      if(party[i] !== undefined) {
        const number=party[i],button=cartridgeButton(number,()=>{
          if(!reorderMode) {openItem(number);return;}
          if(reorderSource===null) reorderSource=number;
          else if(reorderSource===number) reorderSource=null;
          else {
            const source=reorderSource;reorderSource=null;swapParty(source,number);
            $(`#labPartyGrid [data-number="${source}"]`)?.focus({preventScroll:true});
          }
          updateReorder();
        });grid.append(button);
      }
      else { const slot=document.createElement("div");slot.className="lab-empty-slot";slot.setAttribute("aria-label",`空き枠 ${i+1}`);slot.textContent=String(i+1).padStart(2,"0");grid.append(slot); }
    }
    updateReorder();syncAcquireButton();
    $("#labPartyShare").hidden=party.length===0;
    const signature=party.join(",");
    // Editing the party closes the old image. Generate again only on an explicit click.
    if(signature!==partySignature) {partySignature=signature;partyShareControls?.invalidate({reset:true});}
    $("#labPartyStatus").hidden=saveAvailable;
    if(!saveAvailable) $("#labPartyStatus").textContent="端末への保存を使えないため、この画面内だけで保持しているよ。";
  }
  function saveParty(message) {
    try { localStorage.setItem(PARTY_KEY, JSON.stringify(party)); } catch (_) { saveAvailable = false; }
    $("#labPartyAnnounce").textContent=message; updateParty(); updateCollection();
    if(itemNumber !== null && $("#labItem").open) refreshItem();
  }
  function refreshItem() {
    const ep=byNumber.get(itemNumber), held=party.includes(itemNumber);
    $("#labItemTitle").textContent=`#${itemNumber} ${ep.title}`;
    $("#labItemArt").replaceChildren(createCartridge(ep,true));
    $("#labItemTags").textContent=(ep.tags||[]).join(" / ");
    $("#labItemLink").href=`episodes/${itemNumber}.html`;
    $("#labItemAdd").disabled=held; $("#labItemAdd").textContent=held?"手持ちに登録済み":"手持ちに加える";
    $("#labItemRemove").hidden=!held;
  }
  function openItem(number) { itemNumber=number;refreshItem();$("#labItem").showModal();syncMotion(); }
  function syncAcquireButton() {
    const held=party.includes(inspected),button=$("#labConfirm");
    button.disabled=inspected===null || held;
    button.textContent=held?"手持ちに登録済み":"手持ちに加える";
    button.setAttribute("aria-disabled",String(button.disabled));
    const registered=collection.has(inspected),register=$("#labRegister");
    register.disabled=inspected===null || registered;
    register.textContent=registered?"✓ 図鑑に登録済み":"図鑑に登録";
  }
  // Commit discovery only after the user chooses a destination. Closing the
  // full-party dialog leaves the incoming episode and shared choice untouched.
  function acquire(number, fromRound, destination) {
    mergeCollection();readParty();
    const firstDiscovery=!collection.has(number);
    if(destination!=="dex" && !party.includes(number)) {
      if(destination===null) {if(party.length>=6) {addParty(number,fromRound);return;}party.push(number);}
      else {const index=party.indexOf(destination);if(index<0) {renderReplacements();return;}party[index]=number;}
    }
    collection.add(number);
    try {localStorage.setItem(COLLECTION_KEY,JSON.stringify([...collection]));}catch(_){saveAvailable=false;}
    if(fromRound && round.some(ep=>ep.number===number)) {
      selected=number;
      history.replaceState({...history.state,labChoice:{eps:round.map(e=>e.number).join(","),pick:selected}},"");
      updateRoundUrl();
    }
    saveParty(destination==="dex"?`#${number}を図鑑に登録したよ。`:`#${number}を手持ちに加えたよ。`);
    renderCards();highlightParty(number);
    if(firstDiscovery) {
      const card=$(`#labCards [data-number="${number}"]`);
      card?.classList.add("is-registered");
      card?.addEventListener("animationend",()=>card.classList.remove("is-registered"),{once:true});
    }
    if(!fromRound && selected!==null) updateRoundUrl();
    if($("#labReplace").open) $("#labReplace").close();
  }
  function renderReplacements() {
    const grid=$("#labReplaceGrid");grid.replaceChildren();
    if(party.includes(replacing)) {
      $("#labReplace").close(); replacing=null; return;
    }
    if(party.length < 6) {
      const add=document.createElement("button");add.type="button";add.className="lab-secondary";add.textContent="空き枠に加える";
      add.addEventListener("click",()=>{acquire(replacing,replacingFromRound,null);});
      grid.append(add);
    }
    party.forEach(number=>grid.append(cartridgeButton(number,()=>{
      // Re-read before replacing so another tab cannot silently change the target slot.
      mergeCollection();readParty();
      const index=party.indexOf(number);
      if(index<0 || party.includes(replacing)) { renderReplacements(); return; }
      acquire(replacing,replacingFromRound,number);
    })));
  }
  function addParty(number,fromRound=false) {
    if(!byNumber.has(number) || (!fromRound && !collection.has(number))) return;
    mergeCollection();readParty();
    if(party.includes(number)) {updateParty();return;}
    if(party.length<6) {acquire(number,fromRound,null);return;}
    replacing=number;replacingFromRound=fromRound;
    $("#labReplaceIncoming").textContent=`#${number} ${byNumber.get(number).title}`;
    $("#labSendDex").textContent=collection.has(number)?"図鑑に残す":"図鑑に登録する";
    renderReplacements();$("#labReplace").showModal();syncMotion();
  }
  function roundUrl(includeSelection = true) {
    const url = new URL("lab.html", location.href);
    url.searchParams.set("eps", round.map(e => e.number).join(","));
    const pick = includeSelection ? selected ?? senderPick : null;
    if (pick !== null) url.searchParams.set("pick", pick);
    return url;
  }
  function updateRoundUrl() {
    const url = roundUrl();
    history.replaceState(history.state, "", url);
  }
  function renderCards() {
    const cards = $("#labCards"); cards.replaceChildren();
    round.forEach((ep, index) => {
      const card = document.createElement("article"); card.className = "lab-card"; card.dataset.number = ep.number;
      card.style.setProperty("--slot", index);
      const button = document.createElement("button"); button.type = "button"; button.className = "lab-choose";
      button.setAttribute("aria-label", `#${ep.number} ${ep.title}を調べる`);
      button.setAttribute("aria-controls", "labInspection");
      button.setAttribute("aria-pressed", String(ep.number === inspected));
      const shadow = document.createElement("span"); shadow.className = "lab-shadow"; shadow.setAttribute("aria-hidden", "true");
      button.append(createCartridge(ep), shadow);
      const badge = document.createElement("span"); badge.className = "lab-card-badge"; badge.textContent = collection.has(ep.number) ? "図鑑に登録済み" : ""; button.append(badge);

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
    cards.dataset.active = String(round.findIndex(ep => ep.number === inspected));
    inspect(byNumber.get(inspected));
  }
  function inspect(ep) {
    if (!ep) return;
    inspected = ep.number;
    $("#labInspectPrompt").hidden=true;
    $("#labCards").dataset.active = String(round.findIndex(item => item.number === inspected));
    $("#labInspectNumber").textContent = `#${ep.number} · ${ep.date || ""}`;
    $("#labInspectTitle").textContent = ep.title;
    $("#labInspectTags").textContent = (ep.tags || []).slice(0,2).join(" / ");
    syncAcquireButton();
    $("#labOpen").href=`episodes/${ep.number}.html`;
    $("#labOpen").setAttribute("aria-disabled","false");$("#labOpen").tabIndex=0;
    $("#labCards").querySelectorAll(".lab-card").forEach(card => {
      const active = Number(card.dataset.number) === inspected;
      card.classList.toggle("is-inspected", active);
      card.querySelector("button").setAttribute("aria-pressed", String(active));
    });
  }
  function sizeDetails() {
    const sizes=$("#labDetailSizes");sizes.replaceChildren();
    round.forEach(ep=>{
      const copy=document.createElement("div");copy.className="lab-detail-copy";
      const number=document.createElement("p");number.className="lab-number";number.textContent=`#${ep.number} · ${ep.date || ""}`;
      const title=document.createElement("h2");title.textContent=ep.title;
      const tags=document.createElement("p");tags.className="lab-tags";tags.textContent=(ep.tags||[]).slice(0,2).join(" / ");
      copy.append(number,title,tags);sizes.append(copy);
    });
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
    ["#labInspectNumber","#labInspectTitle","#labInspectTags"].forEach(id=>$(id).textContent="");
    $("#labInspectPrompt").hidden=false;
    $("#labOpen").removeAttribute("href");$("#labOpen").setAttribute("aria-disabled","true");$("#labOpen").tabIndex=-1;
    syncAcquireButton();
    sizeDetails();
    renderCards(); updateParty(); updateRoundUrl();
  }
  $("#labShuffle").addEventListener("click", () => {
    $("#labNotice").hidden = true; newRound();
    $("#labShuffle").focus({preventScroll:true});
  });
  $("#labConfirm").addEventListener("click",()=>addParty(inspected,true));
  $("#labRegister").addEventListener("click",()=>{
    if(inspected!==null && !collection.has(inspected)) acquire(inspected,true,"dex");
  });
  $("#labOpen").addEventListener("click",e=>{if(inspected===null)e.preventDefault();});
  $("#labSendDex").addEventListener("click",()=>{if(replacing!==null)acquire(replacing,replacingFromRound,"dex");});
  $("#labItemAdd").addEventListener("click",()=>addParty(itemNumber));
  $("#labItemRemove").addEventListener("click",()=>{
    mergeCollection();readParty(); party=party.filter(n=>n!==itemNumber);
    saveParty(`#${itemNumber}を手持ちから外したよ。図鑑からいつでも戻せる。`);
    if(selected===itemNumber) updateRoundUrl();
    $("#labItemAdd").focus();
  });
  function updateReorder() {
    if(party.length<2) {reorderMode=false;reorderSource=null;}
    if(!party.includes(reorderSource)) reorderSource=null;
    $("#labReorder").disabled=party.length<2;
    $("#labReorder").setAttribute("aria-pressed",String(reorderMode));
    $("#labReorder").textContent=reorderMode?"並び替えを終える":"並び替え";
    $("#labReorderHint").hidden=!reorderMode;
    $("#labPartyGrid").dataset.reordering=String(reorderMode);
    $("#labPartyGrid").querySelectorAll("button").forEach(button=>{
      const active=Number(button.dataset.number)===reorderSource;
      button.classList.toggle("is-reorder-source",active);
      if(reorderMode) button.setAttribute("aria-pressed",String(active));else button.removeAttribute("aria-pressed");
    });
  }
  $("#labReorder").addEventListener("click",()=>{cancelReorder();reorderMode=!reorderMode;reorderSource=null;updateReorder();});
  page.listen($("#labPartyGrid"),"keydown",e=>{if(e.key==="Escape" && reorderMode){reorderMode=false;reorderSource=null;updateReorder();$("#labReorder").focus();}});
  function highlightParty(number) {
    const slot=$(`#labPartyGrid [data-number="${number}"]`);if(!slot) return;
    slot.classList.add("is-updated");slot.addEventListener("animationend",()=>slot.classList.remove("is-updated"),{once:true});
  }
  function swapParty(source,target) {
    mergeCollection();readParty();const a=party.indexOf(source),b=party.indexOf(target);
    if(a<0 || b<0 || a===b) return;
    [party[a],party[b]]=[party[b],party[a]];
    saveParty(`#${source}を位置${b+1}へ、#${target}を位置${a+1}へ移動したよ。`);
    highlightParty(source);highlightParty(target);
  }
  const cancelReorder=installPartyReorder($("#labPartyGrid"),swapParty,page);
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
  root.querySelectorAll("dialog").forEach(modal => {
    let backdropPress = null, backdropTap = false;
    const outside = event => {
      const r = modal.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    };
    modal.addEventListener("pointerdown", event => {
      backdropTap = false;
      backdropPress = event.isPrimary && event.button === 0 && event.target === modal && outside(event)
        ? {id:event.pointerId,x:event.clientX,y:event.clientY} : null;
    });
    modal.addEventListener("pointerup", event => {
      backdropTap = !!backdropPress && event.pointerId === backdropPress.id && outside(event)
        && Math.hypot(event.clientX-backdropPress.x,event.clientY-backdropPress.y) <= 8;
      backdropPress = null;
    });
    modal.addEventListener("pointercancel", () => { backdropPress = null; backdropTap = false; });
    // Close on click, not pointerup, so the same gesture cannot activate the dialog underneath.
    modal.addEventListener("click", event => {
      if(backdropTap && event.target === modal && outside(event)) {
        event.preventDefault(); event.stopPropagation(); modal.close();
      }
      backdropTap = false;
    });
    modal.addEventListener("close", () => { backdropPress = null; backdropTap = false; syncMotion(); });
  });
  // Updating a case/dex rebuilds its opener. Restore focus to an existing control.
  $("#labItem").addEventListener("close",()=>{
    if($("#labDex").open) ($(`#labDexGrid [data-number="${itemNumber}"]`) || $("#labDexOrder")).focus({preventScroll:true});
    else if(!root.querySelector("dialog[open]") && document.activeElement === document.body) ($(`#labPartyGrid [data-number="${itemNumber}"]`) || $("#labDexToggle")).focus({preventScroll:true});
  });
  $("#labReplace").addEventListener("close",()=>{
    if($("#labItem").open) ($("#labItemAdd").disabled ? $("#labItemLink") : $("#labItemAdd")).focus({preventScroll:true});
    else if(!root.querySelector("dialog[open]")) ($("#labConfirm").disabled ? $("#labOpen") : $("#labConfirm")).focus({preventScroll:true});
    replacing=null;replacingFromRound=false;
  });
  page.listen(window,"storage", e => {
    if(e.key === COLLECTION_KEY || e.key === PARTY_KEY) {
      cancelReorder();reorderSource=null;mergeCollection(); readParty(); updateCollection(); updateParty(); renderCards();updateRoundUrl();
      if($("#labItem").open) refreshItem();
      if($("#labReplace").open) renderReplacements();
    }
  });
  partyShareControls=mountShareControls($("#labPartyShare"), {
    prefix:"labParty",signal:page.signal,previewMode:"on-demand",
    makeLabel:"手持ちのシェア画像を作る",previewAlt:"手持ちエピソードのシェア画像",
    getBlob:()=>createPartyShareImage(party.map(n=>byNumber.get(n)),page.signal,wrapLines),
    getX:()=>{
      const url=new URL("https://twitter.com/intent/tweet");
      url.searchParams.set("text",`ゲームの滝壺、私の手持ちはこの${party.length}本！\nあなたの推し回は？\n${shareHashtags}`);
      url.searchParams.set("url",shareBase.href);
      return url.href;
    },
    filename:()=>`takitsubo-party-${party.join("-")}.png`
  });
  page.onDispose(() => { sceneObserver.disconnect(); root.querySelectorAll("dialog[open]").forEach(modal => modal.close()); });
  syncMotion();
  const initial = readRound(location.search, byNumber), ownChoice=history.state?.labChoice;
  senderPick = initial.pick; newRound(initial.ids); updateCollection();
  if(initial.pick!==null && ownChoice?.eps===initial.ids?.join(",") && ownChoice.pick===initial.pick) {
    selected=initial.pick;senderPick=null;renderCards();updateRoundUrl();
  }
  if (initial.invalid) { $("#labNotice").hidden = false; $("#labNotice").textContent = initial.ids ? "紹介した人の選択を読み取れなかったため、3枚の候補だけを表示したよ。" : "このリンクの3択は読み取れなかったため、新しい3択を用意したよ。"; }
}

// Touch starts as ordinary scrolling. Only a stationary long press arms a drag;
// a non-passive touchmove then owns that gesture without disabling page scrolling.
function installPartyReorder(grid, swap, page) {
  let pending=null, timer=null, ghost=null, target=null, suppressUntil=0;
  const listen=(node,type,handler,options={})=>node.addEventListener(type,handler,{...options,signal:page.signal});
  function cancel() {
    clearTimeout(timer);timer=null;ghost?.remove();ghost=null;
    grid.querySelectorAll(".is-drag-source,.is-drop-target").forEach(el=>el.classList.remove("is-drag-source","is-drop-target"));
    pending=null;target=null;
  }
  function point(x,y) {
    if(!ghost) return;
    ghost.style.left=`${x-ghost.offsetWidth/2}px`;ghost.style.top=`${y-45}px`;
    const over=document.elementFromPoint(x,y)?.closest("#labPartyGrid button[data-number]");
    target=over && over!==pending.button ? over : null;
    grid.querySelectorAll(".lab-owned").forEach(el=>el.classList.toggle("is-drop-target",el===target));
  }
  function start() {
    if(!pending || !pending.button.isConnected) { cancel();return; }
    ghost=document.createElement("div");ghost.className="lab-drag-ghost";ghost.setAttribute("aria-hidden","true");
    ghost.style.width=`${Math.min(130,pending.button.getBoundingClientRect().width)}px`;
    ghost.append(pending.button.querySelector(".lab-art").cloneNode(true));grid.parentElement.append(ghost);
    pending.button.classList.add("is-drag-source");point(pending.x,pending.y);
  }
  function prepare(event,x,y,kind,id) {
    if(grid.dataset.reordering==="true") return;
    const button=event.target.closest("button[data-number]");
    if(!button || !grid.contains(button) || grid.querySelectorAll("button[data-number]").length<2) return;
    cancel();pending={button,x,y,kind,id};
    if(kind==="touch") timer=setTimeout(start,350);
  }
  function move(x,y) {
    if(!pending) return;
    const distance=Math.hypot(x-pending.x,y-pending.y);
    if(!ghost && distance>8) {
      if(pending.kind==="touch") { cancel();return; }
      start();
    }
    point(x,y);
  }
  function finish() {
    if(!pending) return;
    const source=Number(pending.button.dataset.number),destination=target ? Number(target.dataset.number):null;
    const dragging=!!ghost;
    cancel();
    if(dragging) {
      suppressUntil=performance.now()+500;
      if(destination!==null) swap(source,destination);
      grid.querySelector(`[data-number="${source}"]`)?.focus({preventScroll:true});
    }
  }
  listen(grid,"pointerdown",e=>{if(e.pointerType!=="touch" && e.button===0) prepare(e,e.clientX,e.clientY,"pointer",e.pointerId);});
  listen(window,"pointermove",e=>{if(pending?.kind==="pointer" && pending.id===e.pointerId) move(e.clientX,e.clientY);});
  listen(window,"pointerup",e=>{if(pending?.kind==="pointer" && pending.id===e.pointerId) finish();});
  listen(window,"pointercancel",()=>{if(pending?.kind==="pointer") cancel();});
  listen(grid,"touchstart",e=>{
    if(e.touches.length!==1) {cancel();return;}
    const t=e.touches[0];prepare(e,t.clientX,t.clientY,"touch",t.identifier);
  },{passive:true});
  listen(window,"touchmove",e=>{
    if(pending?.kind!=="touch") return;
    if(e.touches.length!==1) {cancel();return;}
    const t=[...e.touches].find(t=>t.identifier===pending.id);if(!t) return;
    if(ghost) e.preventDefault();move(t.clientX,t.clientY);
  },{passive:false});
  listen(window,"touchend",e=>{if(pending?.kind==="touch") {if(ghost) e.preventDefault();finish();}},{passive:false});
  listen(window,"touchcancel",cancel);
  listen(grid,"click",e=>{if(performance.now()<suppressUntil && e.detail!==0) {e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
  listen(grid,"contextmenu",e=>{if(pending?.kind==="touch") e.preventDefault();});
  listen(grid,"dragstart",e=>e.preventDefault());
  listen(window,"blur",cancel);
  listen(window,"scroll",()=>{if(pending) cancel();},{capture:true,passive:true});
  listen(document,"keydown",e=>{if(e.key==="Escape" && pending) {suppressUntil=performance.now()+500;cancel();}});
  page.onDispose(cancel);
  return cancel;
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

async function createPartyShareImage(episodes, signal, wrapLines) {
  await document.fonts.ready;
  const images = await Promise.all(episodes.map(e => imageFor(e, signal)));
  const logo = await imageFor({image:"assets/img/mainlogo.webp"}, signal);
  const shells = await Promise.all(episodes.map(ep => {
    const art = createCartridge(ep, true), svg = art.querySelector("svg");
    let source = new XMLSerializer().serializeToString(svg);
    CASE_COLORS[cartridgeTone(ep.number)].forEach((color,i) => {
      source = source.replaceAll(`var(${["--case-body","--case-light","--case-dark","--case-ink"][i]})`, color);
    });
    return imageFor({image:"data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)}, signal);
  }));
  if(signal.aborted) throw new DOMException("Disposed", "AbortError");
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1100;
  const height=canvas.height;
  const c = canvas.getContext("2d"), ink = "#254e70";
  const sky=c.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,"#2086d3");sky.addColorStop(160/height,"#69b1e5");sky.addColorStop(270/height,"#d7edff");sky.addColorStop(.75,"#dce8fb");sky.addColorStop(1,"#9ec7e5");
  c.fillStyle=sky;c.fillRect(0,0,1200,height);
  c.fillStyle="rgba(255,255,255,.1)";
  for(const x of [180,650,1080]) {c.beginPath();c.moveTo(x,0);c.lineTo(x+90,0);c.lineTo(x-100,height);c.lineTo(x-210,height);c.closePath();c.fill();}
  c.fillStyle="rgba(255,255,255,.36)";
  for(const [x,y,r] of [[27,240,8],[1168,280,10],[420,190,5],[805,570,6],[30,690,6],[1140,680,5],[1010,45,7]]) {c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  c.save();c.shadowColor="rgba(8,40,80,.3)";c.shadowBlur=14;c.shadowOffsetY=4;
  if(logo) c.drawImage(logo,30,14,138,138);
  c.fillStyle="#fff";c.font='900 44px "Noto Sans JP",sans-serif';c.fillText("エピソード研究所",190,79);
  const underlineWidth=c.measureText("エピソード").width;c.restore();
  c.fillStyle="#ee735c";c.beginPath();c.roundRect(190,94,underlineWidth,6,3);c.fill();
  c.fillStyle="#fff";c.font='bold 30px "Noto Sans JP",sans-serif';c.fillText("手持ちエピソード",190,140);
  {c.font='bold 24px "Noto Sans JP",sans-serif';c.textAlign="right";c.fillText(`${episodes.length} / 6`,1156,151);c.textAlign="left";}
  {
    c.save();c.strokeStyle="#aac8dc";c.lineWidth=2;c.setLineDash([9,7]);
    for(let i=episodes.length;i<6;i++) {
      const x=84+(i%3)*380,y=198+Math.floor(i/3)*440;
      c.beginPath();c.roundRect(x,y,240,280,10);c.stroke();
    }
    c.restore();
  }
  episodes.forEach((ep,i) => {
    const x=84+(i%3)*380, y=198+Math.floor(i/3)*440, w=240, h=w*7/6;
    c.fillStyle="#92b2cc"; c.fillRect(x+8,y+16,w,h-8);
    if(shells[i]) c.drawImage(shells[i],x,y,w,h);
    const ix=x+w*.0875, iy=y+h*.2357, iw=w*.825;
    c.fillStyle="#fff";c.fillRect(ix,iy,iw,iw);
    const img=images[i];
    if(img) { const scale=Math.min(iw/img.naturalWidth,iw/img.naturalHeight);c.drawImage(img,ix+(iw-img.naturalWidth*scale)/2,iy+(iw-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale); }
    c.fillStyle=ink;c.font='bold 19px "Noto Sans JP",sans-serif';c.fillText(`#${ep.number}`,x,y+h+37);
    c.font='bold 21px "Noto Sans JP",sans-serif';
    wrapLines(c,ep.title,320,2).forEach((line,j)=>c.fillText(line,x,y+h+73+j*30));

  });
  c.fillStyle=ink;c.fillRect(0,height-52,1200,52);c.fillStyle="#fff";c.font='bold 22px "Noto Sans JP",sans-serif';
  c.textAlign="center";c.fillText("#ゲームの滝壺 #滝壺エピソード研究所",600,height-18);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed")),"image/png"));
}
