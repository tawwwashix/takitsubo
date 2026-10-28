/* Only the small lifecycle adapter is shared with other pages. */
window.Takitsubo.register(async function (page) {
  var root = document.getElementById("episodeLab");
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
    // Fetch data alongside the module tree, instead of waiting for it to finish.
    var dataReady = fetch(root.dataset.source, { signal: page.signal }).then(function (response) {
      if (!response.ok) throw new Error("Episode data unavailable");
      return response.json();
    });
    var result = await Promise.all([import(new URL(root.dataset.module, location.href).href), styleReady, dataReady]);
    if (!page.signal.aborted) await result[0].mount(root, page, result[2]);
  } catch (error) {
    if (page.signal.aborted) return;
    root.textContent = "ページを読み込めませんでした。";
    var retry = document.createElement("button");
    retry.textContent = "もう一度読み込む";
    retry.onclick = function () { location.reload(); };
    root.appendChild(retry);
  }
});
