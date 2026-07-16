/* 滝壺データベース: 索引ページのクライアントサイド絞り込み
   - タイトル・読みがな・略称(aliases.json由来)を対象にインクリメンタル検索
   - ひらがな入力はカタカナに変換して照合(「しれん」→シレン)
   - 「メインで語られた」「3分ゲーム紹介」の絞り込みボタン(検索と併用可)
   - 状態はURLに反映(?q=検索語&f=lv3|s3)。共有・ブックマーク・診断からのリンクに対応 */
(function () {
  "use strict";

  var input = document.getElementById("gmQ");
  if (!input) return;
  var clearBtn = document.getElementById("gmClear");
  var countEl = document.getElementById("gmCount");
  var emptyEl = document.getElementById("gmEmpty");
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll(".filter-btn[data-flv]"));
  var flv = "all"; // all / lv3(メイン) / s3(3分ゲーム紹介)
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
      var hitQ = !key || (el.getAttribute("data-s") || "").indexOf(key) !== -1;
      var hitF = flv === "all" || el.getAttribute("data-" + flv) === "1";
      var hit = hitQ && hitF;
      el.hidden = !hit;
      if (hit) shown++;
    });
    sections.forEach(function (sec) {
      sec.hidden = !sec.querySelector(".gm-item:not([hidden])");
    });
    // 絞り込み中は「よく語られている」と五十音ナビを畳む
    var filtering = key.length > 0 || flv !== "all";
    if (topBlock) topBlock.closest(".section").hidden = filtering;
    if (letterNav) letterNav.hidden = filtering;
    countEl.textContent = filtering ? shown + "件ヒット" : "";
    if (emptyEl) emptyEl.hidden = !(filtering && shown === 0);
    if (clearBtn) clearBtn.hidden = input.value.length === 0;
    syncUrl();
  }

  // 検索語と絞り込みをURLに反映(履歴は汚さない)
  function syncUrl() {
    var parts = [];
    if (input.value.trim()) parts.push("q=" + encodeURIComponent(input.value.trim()));
    if (flv !== "all") parts.push("f=" + flv);
    history.replaceState(null, "", location.pathname + (parts.length ? "?" + parts.join("&") : ""));
  }

  input.addEventListener("input", function () { apply(input.value); });
  if (clearBtn) clearBtn.addEventListener("click", function () {
    input.value = "";
    apply("");
    input.focus();
  });
  filterBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-flv");
      flv = (v === flv) ? "all" : v; // 同じボタンをもう一度押すと解除
      filterBtns.forEach(function (x) {
        x.classList.toggle("on", x.getAttribute("data-flv") === flv);
      });
      apply(input.value);
    });
  });

  var params = new URLSearchParams(location.search);
  var q = params.get("q");
  var f = params.get("f");
  if (f === "lv3" || f === "s3") {
    flv = f;
    filterBtns.forEach(function (x) {
      x.classList.toggle("on", x.getAttribute("data-flv") === flv);
    });
  }
  if (q) input.value = q;
  if (q || flv !== "all") {
    apply(input.value);
    input.scrollIntoView({ block: "center" });
  }
})();
