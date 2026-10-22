/* Only the small lifecycle adapter is shared with other pages. */
window.Takitsubo.register(async function (page) {
  var root = document.getElementById("excavation") || document.getElementById("episodeLab");
  if (!root) return;
  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL(root.dataset.css, location.href).href;
  page.onDispose(function () { css.remove(); });
  try {
    var styleReady = new Promise(function (resolve, reject) {
      css.onload = resolve;
      css.onerror = function () { reject(new Error("Stylesheet unavailable")); };
      page.signal.addEventListener("abort", resolve, { once: true });
    });
    document.head.appendChild(css);
    var result = await Promise.all([import(new URL(root.dataset.module, location.href).href), styleReady]);
    if (!page.signal.aborted) await result[0].mount(root, page);
  } catch (error) {
    if (page.signal.aborted) return;
    root.textContent = "ページを読み込めませんでした。";
    var retry = document.createElement("button");
    retry.textContent = "もう一度読み込む";
    retry.onclick = function () { location.reload(); };
    root.appendChild(retry);
  }
});
