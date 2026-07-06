/* エピソード一覧: 検索 + タグ絞り込み + 並び替え */
(function () {
  var state = { q: "", tag: "all", sort: "relevance" };
  var listEl = document.getElementById("list");
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var input = document.getElementById("q");
  var clearBtn = document.getElementById("qClear");
  var sortEl = document.getElementById("sort");
  var episodes = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function jd(iso) { return iso.replace(/-/g, "."); }

  function norm(s) {
    // ひら→カタ変換 + 小文字化で「どらくえ」でもヒットさせる
    return s.toLowerCase().replace(/[ぁ-ゖ]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) + 0x60);
    });
  }

  // キーワードがどこに一致したか(小さいほど関連度が高い)
  // 0=タイトル/番号, 1=タグ, 2=登場ゲーム, 99=不一致
  function matchRank(e, kw) {
    if (norm(e.title + " #" + e.number).indexOf(kw) !== -1) return 0;
    if (norm(e.tags.join(" ")).indexOf(kw) !== -1) return 1;
    if (norm((e.games || []).join(" ")).indexOf(kw) !== -1) return 2;
    return 99;
  }

  // 登場ゲームで一致した回は、どのゲームで当たったかをカードに表示する
  function matchedGames(e, kw) {
    return (e.games || []).filter(function (g) { return norm(g).indexOf(kw) !== -1; });
  }

  // 検索状態をURLに反映(共有・ブックマーク可能に)。履歴は汚さない
  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.tag !== "all") p.set("tag", state.tag);
    if (state.sort !== "relevance") p.set("sort", state.sort);
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function render() {
    var kw = norm(state.q.trim());
    clearBtn.hidden = state.q.length === 0;
    syncUrl();

    var out = episodes.filter(function (e) {
      var okTag = state.tag === "all" || e.tags.indexOf(state.tag) !== -1;
      if (!okTag) return false;
      if (!kw) return true;
      return matchRank(e, kw) !== 99;
    });

    // 並び替え
    var byNew = function (a, b) { return b.number - a.number; };
    if (state.sort === "old") {
      out.sort(function (a, b) { return a.number - b.number; });
    } else if (state.sort === "new" || !kw) {
      out.sort(byNew); // キーワード未入力の関連度順は「新しい順」と同義
    } else {
      // 関連度順: 一致場所(タイトル→タグ→ゲーム)を最優先、同順位内は新しい回順
      out.sort(function (a, b) {
        var ra = matchRank(a, kw), rb = matchRank(b, kw);
        return ra !== rb ? ra - rb : byNew(a, b);
      });
    }

    countEl.textContent = "全" + episodes.length + "回中 " + out.length + "件";
    emptyEl.style.display = out.length ? "none" : "block";
    listEl.innerHTML = out.map(function (e) {
      var tags = e.tags.slice(0, 2).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      var art = e.image
        ? '<img class="ep-card-img" src="../' + esc(e.image) + '" alt="" loading="lazy" width="800" height="800">'
        : '<span class="ep-card-img ep-card-num">#' + e.number + "</span>";
      // タイトルに無い語でヒットした回は、当たったゲーム名を明示して分かりやすく
      var reason = "";
      if (kw && matchRank(e, kw) === 2) {
        var gs = matchedGames(e, kw).slice(0, 2).map(function (g) {
          return '<span class="mg">' + esc(g) + "</span>";
        }).join("");
        reason = '<span class="ep-match">🎮 この回で話題に: ' + gs + "</span>";
      }
      return '<a class="ep-card" href="' + e.number + '.html">' + art +
        '<span class="ep-card-body"><span class="ep-title">' + esc(e.title) + "</span>" +
        '<span class="ep-meta"><span class="ep-hash">#' + e.number + "</span>" + jd(e.date) + tags + "</span>" +
        reason + "</span></a>";
    }).join("");
  }

  input.addEventListener("input", function (ev) { state.q = ev.target.value; render(); });
  clearBtn.addEventListener("click", function () {
    state.q = ""; input.value = ""; input.focus(); render();
  });
  sortEl.addEventListener("change", function (ev) { state.sort = ev.target.value; render(); });
  document.querySelectorAll(".filter-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      state.tag = b.dataset.tag;
      render();
    });
  });

  // 「/」キーで検索欄にフォーカス(入力中は除く)
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      ev.preventDefault();
      input.focus();
    }
  });

  // URLパラメータで初期状態を復元(?q= / ?tag= / ?sort=)
  var params = new URLSearchParams(location.search);
  if (params.get("q")) { state.q = params.get("q"); input.value = state.q; }
  if (params.get("sort") && ["relevance", "new", "old"].indexOf(params.get("sort")) !== -1) {
    state.sort = params.get("sort");
    sortEl.value = state.sort;
  }
  if (params.get("tag")) {
    var tagBtn = [].slice.call(document.querySelectorAll(".filter-btn"))
      .filter(function (b) { return b.dataset.tag === params.get("tag"); })[0];
    if (tagBtn) {
      document.querySelectorAll(".filter-btn").forEach(function (x) { x.classList.remove("on"); });
      tagBtn.classList.add("on");
      state.tag = params.get("tag");
    }
  }

  fetch("../data/search.json" + (window.__searchVer ? "?v=" + window.__searchVer : ""))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      episodes = d.episodes.slice().reverse(); // 新しい順
      render();
    })
    .catch(function () {
      listEl.innerHTML = '<p style="color:var(--faint);text-align:center;">エピソードの読み込みに失敗しました。ページを再読み込みしてください。</p>';
    });
})();
