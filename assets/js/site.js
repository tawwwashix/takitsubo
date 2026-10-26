window.Takitsubo.register(function (page) {
/* Shared search entry: use the existing results page while keeping audio alive. */
document.querySelectorAll('.episode-search').forEach(function (form) {
  var input = form.querySelector('[name="q"]');
  var database = form.querySelector('.episode-search-db');
  var databaseUrl = new URL(database.href);
  function updateDatabase() {
    var url = new URL(databaseUrl);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    database.href = url.href;
  }
  input.addEventListener('input', updateDatabase);
  database.addEventListener('click', updateDatabase);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var query = input.value.trim();
    if (!query) { input.value = ''; input.focus(); return; }
    var url = new URL(form.action);
    url.searchParams.set('q', query);
    window.Takitsubo.navigate(url.href);
  });
  updateDatabase();
});
/* 全ページ共通: スマホ幅ではハンバーガーメニューで開閉 */
(function () {
  var btn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("siteNav");
  if (!btn || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("open", open);
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
  }
  btn.addEventListener("click", function (ev) {
    ev.stopPropagation();
    setOpen(!nav.classList.contains("open"));
  });
  // メニュー内リンクを押したら閉じる / メニュー外をタップしても閉じる
  nav.addEventListener("click", function (ev) {
    if (ev.target.closest("a")) setOpen(false);
  });
  page.listen(document, "click", function (ev) {
    if (nav.classList.contains("open") && !ev.target.closest(".header-inner")) setOpen(false);
  });
  page.listen(document, "keydown", function (ev) {
    if (ev.key === "Escape") setOpen(false);
  });
})();

/* トップページ: ヒーローのアートワーク再現ステージをマウスに追従させて立体感を出す */
(function () {
  var stage = document.getElementById("heroStage");
  if (!stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover)").matches) return; // タッチ端末では無効

  var hero = stage.closest(".hero") || stage;
  var layers = stage.querySelectorAll(".stage-layer");
  var tx = 0, ty = 0, raf = null;
  page.onDispose(function () { if (raf) cancelAnimationFrame(raf); });

  function apply() {
    raf = null;
    layers.forEach(function (l) {
      var d = parseFloat(l.dataset.depth || "1");
      l.style.transform =
        "translate3d(" + (tx * d * 14).toFixed(1) + "px," + (ty * d * 10).toFixed(1) + "px,0)";
    });
  }
  hero.addEventListener("mousemove", function (ev) {
    var r = hero.getBoundingClientRect();
    tx = ((ev.clientX - r.left) / r.width - 0.5) * 2;  // -1 .. 1
    ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  hero.addEventListener("mouseleave", function () {
    tx = 0; ty = 0;
    if (!raf) raf = requestAnimationFrame(apply);
  });
})();

/* エピソードページ: アートワークを拡大表示(ライトボックス)。
   リンクはPCのみ表示(スマホはピンチ拡大でOK)。背景・×・Escで閉じる */
(function () {
  var triggers = document.querySelectorAll(".art-zoom");
  if (!triggers.length) return;

  var box = null, lastTrigger = null, background = [];
  function restoreBackground() {
    background.forEach(function (el) { el.inert = false; });
    background = [];
  }
  page.onDispose(function () {
    restoreBackground();
    if (box) box.remove();
    document.body.classList.remove("art-lightbox-open");
  });

  function build() {
    box = document.createElement("div");
    box.className = "art-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "アートワークの拡大表示");
    box.innerHTML =
      '<button class="art-lightbox-close" type="button" aria-label="閉じる">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<figure class="art-lightbox-fig"><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(box);
    box.addEventListener("click", function (ev) {
      // 画像そのものをクリックしても閉じない(背景/×のみ閉じる)
      if (ev.target === box || ev.target.closest(".art-lightbox-close")) close();
    });
  }
  function open(src, caption) {
    if (!box) build();
    var img = box.querySelector("img");
    img.src = src;
    img.alt = caption || "";
    box.querySelector("figcaption").textContent = caption || "";
    // Keep the page and persistent player outside the modal interaction scope.
    background = Array.from(document.body.children).filter(function (el) { return el !== box && !el.inert; });
    background.forEach(function (el) { el.inert = true; });
    box.classList.add("show");
    document.body.classList.add("art-lightbox-open");
    box.querySelector(".art-lightbox-close").focus();
  }
  function close() {
    if (!box) return;
    box.classList.remove("show");
    document.body.classList.remove("art-lightbox-open");
    restoreBackground();
    if (lastTrigger) lastTrigger.focus();
  }
  triggers.forEach(function (t) {
    t.addEventListener("click", function () {
      lastTrigger = t;
      open(t.dataset.full, t.dataset.caption);
    });
  });
  page.listen(document, "keydown", function (ev) {
    if (!box || !box.classList.contains("show")) return;
    if (ev.key === "Escape") close();
    if (ev.key === "Tab") {
      ev.preventDefault();
      box.querySelector(".art-lightbox-close").focus();
    }
  });
})();

/* 全ページ共通: ページ下部でダチョウがニュッと出現 → クリックで先頭へ */
(function () {
  var btn = document.querySelector(".datyou-top");
  if (!btn) return;

  function check() {
    var nearBottom =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 160;
    btn.classList.toggle("show", nearBottom && window.scrollY > 200);
  }

  page.listen(window, "scroll", check, { passive: true });
  page.listen(window, "resize", check);
  page.listen(document, "takitsubo:navigated", check);
  check();

  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

});
