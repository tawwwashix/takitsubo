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
