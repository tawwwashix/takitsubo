/* トップページ: ヒーローのアートワーク再現ステージをマウスに追従させて立体感を出す */
(function () {
  var stage = document.getElementById("heroStage");
  if (!stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover)").matches) return; // タッチ端末では無効

  var hero = stage.closest(".hero") || stage;
  var layers = stage.querySelectorAll(".stage-layer");
  var tx = 0, ty = 0, raf = null;

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

/* 全ページ共通: ページ下部でダチョウがニュッと出現 → クリックで先頭へ */
(function () {
  var btn = document.querySelector(".datyou-top");
  if (!btn) return;

  function check() {
    var nearBottom =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 160;
    btn.classList.toggle("show", nearBottom && window.scrollY > 200);
  }

  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check);
  check();

  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
