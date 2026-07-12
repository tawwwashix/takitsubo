/* 滝壺データベース: 索引ページのクライアントサイド絞り込み
   - タイトル・読みがな・略称(aliases.json由来)を対象にインクリメンタル検索
   - ひらがな入力はカタカナに変換して照合(「しれん」→シレン)
   - URLの ?q= で初期絞り込み(診断結果ページなどからのリンク用) */
(function () {
  "use strict";

  var input = document.getElementById("gmQ");
  if (!input) return;
  var countEl = document.getElementById("gmCount");
  var items = Array.prototype.slice.call(document.querySelectorAll(".gm-item"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".gm-section"));
  var letterNav = document.querySelector(".gm-letter-nav");
  var topBlock = document.querySelector(".gm-top");

  function norm(s) {
    s = String(s);
    if (s.normalize) s = s.normalize("NFKC");
    return s.toLowerCase()
      .replace(/[ぁ-ゖ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) + 0x60); })
      .replace(/[\s　]/g, "");
  }

  function apply(q) {
    var key = norm(q);
    var shown = 0;
    items.forEach(function (el) {
      var hit = !key || (el.getAttribute("data-s") || "").indexOf(key) !== -1;
      el.hidden = !hit;
      if (hit) shown++;
    });
    sections.forEach(function (sec) {
      sec.hidden = !sec.querySelector(".gm-item:not([hidden])");
    });
    // 絞り込み中は「よく語られている」と五十音ナビを畳む
    var filtering = key.length > 0;
    if (topBlock) topBlock.closest(".section").hidden = filtering;
    if (letterNav) letterNav.hidden = filtering;
    countEl.textContent = filtering ? shown + "件ヒット" : "";
  }

  input.addEventListener("input", function () { apply(input.value); });

  var q = new URLSearchParams(location.search).get("q");
  if (q) {
    input.value = q;
    apply(q);
    input.scrollIntoView({ block: "center" });
  }
})();
