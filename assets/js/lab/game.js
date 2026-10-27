// All lab dependencies use the same content-derived version from build.py.
const version = new URL(import.meta.url).search;
const load = name => import(new URL(name + version, import.meta.url));
const [{createCartridge}, {installPartyReorder}, {createPartyShareImage}, {renderLab}, {createLabStorage, PARTY_KEY, COLLECTION_KEY}, {drawRound, readSharedParty}, {installTransfer}] = await Promise.all([
  load('./cartridge.js'), load('./party-reorder.js'), load('./party-share.js'),
  load('./view.js'), load('./storage.js'), load('./selection.js'), load('./transfer.js')
]);

// URLからの候補復元（以前共有した3択のリンクも維持）
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

// 画面の状態と操作を接続する。描画素材・保存・PNG・ドラッグは別モジュール
export async function mount(root, page) {
  const {wrapLines, mountShareControls} = await import(new URL(root.dataset.shareModule, location.href));
  const response = await fetch(root.dataset.source, { signal: page.signal });
  if (!response.ok) throw new Error("Episode data unavailable");
  const data = await response.json();
  if (page.signal.aborted) return;
  const episodes = data.episodes.filter(e => Number.isInteger(e.number) && e.number > 0 && typeof e.title === "string");
  const byNumber = new Map(episodes.map(e => [e.number, e]));
  if (byNumber.size < 3) throw new Error("Three episodes are required");
  const storage = createLabStorage(byNumber);
  const sharedParty = readSharedParty(location.search, byNumber);
  let sharedView = !!sharedParty.ids;
  let collection = new Set(), round = [], selected = null, senderPick = null;
  let inspected = null, partyShareControls, partySignature = null;
  let reorderMode=false, reorderSource=null, replacingFromRound=false;
  let party = [], ascending = false, showUnseen = true, itemNumber = null, replacing = null;
  const shareBase = new URL(root.dataset.sharePage);
  const shareHashtags = "#ゲームの滝壺 #滝壺エピソード研究所";
  const mergeCollection = () => storage.readCollection().forEach(n => collection.add(n));
  function readParty() {
    const saved = storage.readParty(collection);
    if (saved !== null) party = saved;
  }
  mergeCollection();
  readParty();
  ({ascending, showUnseen} = storage.readPreferences());
  renderLab(root);
  const $ = s => root.querySelector(s);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionEnabled = () => !motionPaused && !reducedMotion.matches && !document.hidden;
  const transfer = installTransfer(root, page, createCartridge, motionEnabled);
  let discoveryFlash = null;
  const cancelDiscoveryFlash = () => { discoveryFlash?.cancel(); discoveryFlash = null; };
  const clearFeedback = () => {
    cancelDiscoveryFlash();
    root.querySelectorAll('.is-registered,.is-updated').forEach(node => node.classList.remove('is-registered', 'is-updated'));
  };
  page.listen(reducedMotion, 'change', () => { transfer.cancel(); clearFeedback(); });
  page.listen(document, 'visibilitychange', cancelDiscoveryFlash);
  page.onDispose(cancelDiscoveryFlash);
  if (sharedParty.ids) {
    $('#labShared').hidden = false; $('#labExperience').hidden = true;
    sharedParty.ids.forEach(number => {
      const ep = byNumber.get(number), link = document.createElement('a');
      link.className = 'lab-owned'; link.href = `episodes/${number}.html`;
      link.setAttribute('aria-label', `#${number} ${ep.title}：エピソードの詳細ページに移動`);
      const title = document.createElement('span'); title.className = 'lab-dex-title'; title.textContent = ep.title;
      const meta = document.createElement('span'); meta.className = 'lab-card-meta'; meta.textContent = `#${number}`;
      link.append(createCartridge(ep, true), meta, title); $('#labSharedGrid').append(link);
    });
  }
  $('#labStartOwn').addEventListener('click', () => {
    sharedView = false; $('#labShared').hidden = true; $('#labExperience').hidden = false;
    newRound(); $('#labShuffle').focus({preventScroll:true});
  });
// 手持ち・図鑑の表示
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
    if (!numbers.length) { const p = document.createElement("p"); p.textContent = "気になる回を「図鑑に登録」すると、ここに記録されます。"; grid.append(p); }
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
    if (!storage.available) $("#labStorageNote").textContent = "保存を利用できないため、この画面内だけで記録しているよ。";
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
    $("#labPartyStatus").hidden=storage.available;
    if(!storage.available) $("#labPartyStatus").textContent="端末への保存を使えないため、この画面内だけで保持しているよ。";
  }
  function saveParty(message) {
    storage.saveParty(party);
    $("#labPartyAnnounce").textContent=message; updateParty(); updateCollection();
    if(itemNumber !== null && $("#labItem").open) refreshItem();
  }
  function refreshItem() {
    const ep=byNumber.get(itemNumber), held=party.includes(itemNumber);
    $("#labItemTitle").textContent=`#${itemNumber} ${ep.title}`;
    $("#labItemArt").replaceChildren(createCartridge(ep,true));
    $("#labItemTags").textContent=(ep.tags||[]).join(" / ");
    $("#labItemTags").hidden=!(ep.tags||[]).length;
    $("#labItemLink").href=`episodes/${itemNumber}.html`;
    $("#labItemAdd").disabled=held; $("#labItemAdd").textContent=held?"手持ちに登録済み":"手持ちに加える";
    $("#labItemRemove").hidden=!held;
  }
  function openItem(number) { transfer.cancel();itemNumber=number;refreshItem();$("#labItem").showModal();syncMotion(); }
  function syncAcquireButton() {
    $("#labSaveActions").inert=inspected===null;
    $("#labSaveActions").classList.toggle("is-visible",inspected!==null);
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
// 登録と交換（保存するのは行き先が確定してから）
  function acquire(number, fromRound, destination) {
    transfer.cancel();
    const source = fromRound ? $(`#labCards [data-number="${number}"] .lab-art`) : $('#labItemArt .lab-art');
    const sourceRect = source?.getBoundingClientRect();
    const sourcePosition = sourceRect ? {left:sourceRect.left, top:sourceRect.top + scrollY, width:sourceRect.width, height:sourceRect.height, documentPosition:true} : null;
    mergeCollection();readParty();
    const firstDiscovery=!collection.has(number);
    if(destination!=="dex" && !party.includes(number)) {
      if(destination===null) {if(party.length>=6) {addParty(number,fromRound);return;}party.push(number);}
      else {const index=party.indexOf(destination);if(index<0) {renderReplacements();return;}party[index]=number;}
    }
    collection.add(number);
    storage.saveCollection(collection);
    if(fromRound && round.some(ep=>ep.number===number)) {
      selected=number;
      history.replaceState({...history.state,labChoice:{eps:round.map(e=>e.number).join(","),pick:selected}},"");
      updateRoundUrl();
    }
    saveParty(destination==="dex"?`#${number}を図鑑に登録したよ。`:`#${number}を手持ちに加えたよ。`);
    renderCards();
    if(firstDiscovery && motionEnabled() && !root.classList.contains('lab-paused')) {
      const card=$(`#labCards [data-number="${number}"]`);
      card?.classList.add("is-registered");
      card?.addEventListener("animationend",()=>card.classList.remove("is-registered"),{once:true});
    }
    if(!fromRound && selected!==null) updateRoundUrl();
    if($("#labReplace").open) $("#labReplace").close();
    if (!fromRound) { if ($('#labItem').open) $('#labItem').close(); if ($('#labDex').open) $('#labDex').close(); }
    if (firstDiscovery && motionEnabled()) {
      cancelDiscoveryFlash();
      discoveryFlash = $('#labDexToggle').animate([{background:'#c2e5ff'}, {background:'transparent'}], {duration:220});
    }
    transfer.fly(byNumber.get(number), sourcePosition, destination === 'dex' ? $('#labDexToggle') : $(`#labPartyGrid [data-number="${number}"] .lab-art`), destination === 'dex');
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
    renderReplacements();$("#labReplace").showModal();syncMotion();
  }
// 3択・選択状態・履歴
  function roundUrl(includeSelection = true) {
    const url = new URL("lab.html", location.href);
    url.searchParams.set("eps", round.map(e => e.number).join(","));
    const pick = includeSelection ? selected ?? senderPick : null;
    if (pick !== null) url.searchParams.set("pick", pick);
    return url;
  }
  function updateRoundUrl() {
    if (sharedView) return;
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
      const badge = document.createElement("span"); badge.className = "lab-card-badge"; badge.textContent = collection.has(ep.number) ? "登録済み" : ""; button.querySelector('.lab-art').append(badge);

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
  function newRound(ids) {
    transfer.cancel();mergeCollection();
    if (ids) round = ids.map(n => byNumber.get(n));
    else {
      round = drawRound([...byNumber.values()], round, collection);
      senderPick = null;
    }
    selected = null; inspected = null;
    ["#labInspectNumber","#labInspectTitle","#labInspectTags"].forEach(id=>$(id).textContent="");
    $("#labInspectPrompt").hidden=false;
    $("#labOpen").removeAttribute("href");$("#labOpen").setAttribute("aria-disabled","true");$("#labOpen").tabIndex=-1;
    syncAcquireButton();
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
  $("#labItemAdd").addEventListener("click",()=>addParty(itemNumber));
  $("#labItemRemove").addEventListener("click",()=>{
    mergeCollection();readParty(); party=party.filter(n=>n!==itemNumber);
    saveParty(`#${itemNumber}を手持ちから外したよ。図鑑からいつでも戻せる。`);
    if(selected===itemNumber) updateRoundUrl();
    $("#labItemAdd").focus();
  });
// 手持ちの並び替え
  function updateReorder() {
    if(party.length<2) {reorderMode=false;reorderSource=null;}
    if(!party.includes(reorderSource)) reorderSource=null;
    $("#labReorder").disabled=party.length<2;
    $("#labReorder").setAttribute("aria-pressed",String(reorderMode));
    $("#labReorder").textContent=reorderMode?"完了":"並び替え";
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
    if(!motionEnabled() || root.classList.contains('lab-paused')) return;
    const slot=$(`#labPartyGrid [data-number="${number}"]`);if(!slot) return;
    slot.classList.add("is-updated");slot.addEventListener("animationend",()=>slot.classList.remove("is-updated"),{once:true});
  }
  function swapParty(source,target) {
    transfer.cancel();reorderSource=null;
    mergeCollection();readParty();const a=party.indexOf(source),b=party.indexOf(target);
    if(a<0 || b<0 || a===b) return;
    [party[a],party[b]]=[party[b],party[a]];
    saveParty(`#${source}を位置${b+1}へ、#${target}を位置${a+1}へ移動したよ。`);
    highlightParty(source);highlightParty(target);
  }
  const cancelReorder=installPartyReorder($("#labPartyGrid"),swapParty,page,()=>{transfer.cancel();reorderSource=null;updateReorder();});
  function saveDexPreferences() {
    ascending=$("#labDexOrder").value==="asc";showUnseen=$("#labDexUnseen").checked;
    storage.savePreferences({ascending, showUnseen});
    updateCollection();
  }
  $("#labDexOrder").addEventListener("change",saveDexPreferences);
  $("#labDexUnseen").addEventListener("change",saveDexPreferences);
// 動きの停止・ダイアログ・フォーカス
  let motionPaused = false, sceneVisible = true;
  const syncMotion = () => {
    const paused = motionPaused || document.hidden || !sceneVisible || !!root.querySelector("dialog[open]");
    root.classList.toggle("lab-paused", paused);
    if(paused) clearFeedback();
  };
  $("#labMotion").addEventListener("click", () => {
    transfer.cancel();cancelDiscoveryFlash();motionPaused = !motionPaused;
    $("#labMotion").textContent = motionPaused ? "アニメーション OFF" : "アニメーション ON";
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
    $("#" + trigger).addEventListener("click", () => { transfer.cancel();$("#" + target).showModal(); syncMotion(); });
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
// 別タブとの同期と共有画像
  page.listen(window,"storage", e => {
    if(e.key === COLLECTION_KEY || e.key === PARTY_KEY) {
      transfer.cancel();cancelReorder();reorderSource=null;mergeCollection(); readParty(); updateCollection(); updateParty(); renderCards();updateRoundUrl();
      if($("#labItem").open) refreshItem();
      if($("#labReplace").open) renderReplacements();
    }
  });
  partyShareControls=mountShareControls($("#labPartyShare"), {
    prefix:"labParty",signal:page.signal,previewMode:"on-demand",
    makeLabel:"手持ちのシェア画像を作る",previewAlt:"手持ちエピソードのシェア画像",
    getBlob:signal=>createPartyShareImage(party.map(n=>byNumber.get(n)),signal,wrapLines),
    getX:()=>{
      const url=new URL("https://twitter.com/intent/tweet");
      url.searchParams.set("text",`ゲームの滝壺から、気になるエピソードを${party.length}本選びました！\n選んだ回はこちらから👇\n${shareHashtags}`);
      const shared = new URL(shareBase); shared.searchParams.set('party', party.join(','));
      url.searchParams.set("url",shared.href);
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
  if (sharedParty.invalid) { $("#labNotice").hidden=false; $("#labNotice").textContent="このリンクの手持ちは読み取れなかったため、新しい3択を用意したよ。"; }
  if (!sharedParty.invalid && initial.invalid) { $("#labNotice").hidden = false; $("#labNotice").textContent = initial.ids ? "紹介した人の選択を読み取れなかったため、3枚の候補だけを表示したよ。" : "このリンクの3択は読み取れなかったため、新しい3択を用意したよ。"; }
}
