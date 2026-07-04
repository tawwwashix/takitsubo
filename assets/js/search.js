/* エピソード一覧: 検索 + タグ絞り込み */
(function () {
  var state = { q: "", tag: "all" };
  var listEl = document.getElementById("list");
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var input = document.getElementById("q");
  var episodes = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function jd(iso) { return iso.replace(/-/g, "."); }

  function norm(s) {
    // ひら→カタ変換 + 小文字化で「どらくえ」でもヒットさせる
    return s.toLowerCase().replace(/[\u3041-\u3096]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) + 0x60);
    });
  }

  function render() {
    var kw = norm(state.q.trim());
    var out = episodes.filter(function (e) {
      var okTag = state.tag === "all" || e.tags.indexOf(state.tag) !== -1;
      if (!okTag) return false;
      if (!kw) return true;
      var hay = norm(e.title + " #" + e.number + " " + e.tags.join(" ") + " " + (e.games || []).join(" "));
      return hay.indexOf(kw) !== -1;
    });
    countEl.textContent = "全" + episodes.length + "回中 " + out.length + "件";
    emptyEl.style.display = out.length ? "none" : "block";
    listEl.innerHTML = out.map(function (e) {
      var tags = e.tags.slice(0, 2).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      var art = e.image
        ? '<img class="ep-card-img" src="../' + esc(e.image) + '" alt="" loading="lazy">'
        : '<span class="ep-card-img ep-card-num">#' + e.number + "</span>";
      return '<a class="ep-card" href="' + e.number + '.html">' + art +
        '<span class="ep-card-body"><span class="ep-title">' + esc(e.title) + "</span>" +
        '<span class="ep-meta"><span class="ep-hash">#' + e.number + "</span>" + jd(e.date) + tags + "</span></span></a>";
    }).join("");
  }

  input.addEventListener("input", function (ev) { state.q = ev.target.value; render(); });
  document.querySelectorAll(".filter-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      state.tag = b.dataset.tag;
      render();
    });
  });

  // URLパラメータ ?q= で初期検索(個別ページのゲームタグから遷移)
  var params = new URLSearchParams(location.search);
  if (params.get("q")) { state.q = params.get("q"); input.value = state.q; }

  fetch("../data/episodes.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      episodes = d.episodes.slice().reverse(); // 新しい順
      render();
    })
    .catch(function () {
      listEl.innerHTML = '<p style="color:var(--faint);text-align:center;">エピソードの読み込みに失敗しました。ページを再読み込みしてください。</p>';
    });
})();
