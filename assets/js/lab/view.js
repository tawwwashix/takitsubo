// Static markup only. Selection, saved data and events live in game.js.
export function renderLab(root) {
  root.innerHTML = `
<div class="lab-wrap">
  <section id="labShared" class="lab-case lab-shared" hidden aria-labelledby="labSharedHeading">
    <h2 id="labSharedHeading">シェアされた手持ちエピソード</h2>
    <p class="lab-footnote">選択すると詳細ページに移動します</p>
    <div id="labSharedGrid"></div>
    <button type="button" id="labStartOwn" class="lab-primary">自分も3択で探す →</button>
  </section>
  <div id="labExperience">

  <div class="lab-machine">
  <div class="lab-machine-tools"><div class="lab-dialogue"><div class="lab-doctor"><img src="assets/img/hyuuma.webp" alt="ひゅうま" width="48" height="48"></div><p id="labSpeech">そこに3つのエピソードがあるじゃろう！</p></div><button type="button" id="labDexToggle" class="lab-icon-button" aria-haspopup="dialog"><span>図鑑</span><strong id="labCount"></strong></button></div>
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
    <p id="labLoading" class="lab-loading" role="status">カートリッジを準備中…</p>
    <section id="labCards" class="lab-cards" aria-label="博士の3つの候補"></section>
    <div class="lab-save-actions" id="labSaveActions" inert><button type="button" id="labRegister" class="lab-secondary" disabled>図鑑に登録</button><button type="button" id="labConfirm" class="lab-secondary" disabled>手持ちに加える</button></div>
  </section>
  <section class="lab-console" aria-label="博士とエピソードを選ぶ">
  <p id="labNotice" class="lab-notice" role="status" hidden></p>
  <div class="lab-inspection" id="labInspection">
    <div class="lab-detail-stack"><div class="lab-detail-copy" aria-live="polite" aria-atomic="true"><div class="lab-detail-meta"><p class="lab-number" id="labInspectNumber"></p><p class="lab-tags" id="labInspectTags"></p></div><h2 id="labInspectTitle"></h2></div><p id="labInspectPrompt">どのエピソードにする？</p></div>
    <nav class="lab-navigation" aria-label="エピソードを開く・候補を変更"><a id="labOpen" class="lab-primary lab-open" aria-disabled="true" tabindex="-1">エピソードの詳細ページに移動 →</a><button type="button" id="labShuffle" class="lab-secondary">↻ 別の3択</button></nav>
  </div>
  </section>
  </div>
  <section class="lab-case" aria-labelledby="labPartyHeading">
    <div class="lab-case-heading"><h2 id="labPartyHeading">手持ちエピソード <span id="labReorderHint" class="lab-reorder-badge" hidden>並び替え中</span></h2><div class="lab-case-tools"><span id="labPartyCount"></span><button type="button" id="labReorder" class="lab-icon-button" aria-pressed="false">並び替え</button></div></div>
    <div id="labPartyGrid"></div><p id="labPartyStatus" class="lab-footnote" role="status" hidden></p><span id="labPartyAnnounce" class="lab-sr-only" role="status"></span><section id="labPartyShare" aria-label="手持ちエピソードをシェア" hidden></section>
  </section>

<div class="lab-settings"><button type="button" id="labMotion" class="lab-icon-button" aria-pressed="false" aria-label="動きを止める">アニメーション ON</button></div>
</div>
</div>
<dialog id="labDex" aria-labelledby="labDexHeading"><div class="lab-modal-top"><h2 id="labDexHeading">エピソード図鑑</h2><button type="button" class="lab-close" data-close="labDex" aria-label="図鑑を閉じる">×</button></div><p class="lab-footnote" id="labStorageNote">※このブラウザに保存されます</p><div class="lab-dex-controls"><label>並び順 <select id="labDexOrder"><option value="desc">新しい順</option><option value="asc">古い順</option></select></label><label><input type="checkbox" id="labDexUnseen"> 未発見も表示</label><span id="labDexCount"></span></div><div id="labDexGrid"></div></dialog>
`;
  root.insertAdjacentHTML("beforeend", `<dialog id="labItem" aria-labelledby="labItemTitle">
    <div class="lab-modal-top"><h2 id="labItemTitle"></h2><button type="button" class="lab-close" data-close="labItem" aria-label="カートリッジの詳細を閉じる">×</button></div>
    <p id="labItemTags" class="lab-footnote"></p><div id="labItemArt"></div>
    <div class="lab-item-actions"><a id="labItemLink" class="lab-primary lab-open">エピソードの詳細ページに移動 →</a><button type="button" id="labItemAdd" class="lab-secondary">手持ちに加える</button></div>
    <button type="button" id="labItemRemove" class="lab-remove">手持ちから外す</button>
  </dialog><dialog id="labReplace" aria-labelledby="labReplaceTitle">
    <div class="lab-modal-top"><h2 id="labReplaceTitle">手持ちがいっぱいだ！ どれと入れ替える？</h2><button type="button" class="lab-close" data-close="labReplace" aria-label="入れ替えをやめる">×</button></div>
    <p id="labReplaceIncoming"></p><div id="labReplaceGrid"></div>
  </dialog>`);
}
