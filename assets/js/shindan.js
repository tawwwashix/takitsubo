/* Stable shell adapter. Diagnosis code is loaded only on its own page. */
window.Takitsubo.register(async function (page) {
  const panel = document.getElementById("shindanPanel");
  if (!panel) return;
  try {
    const module = await import(new URL(panel.dataset.module, location.href).href);
    if (!page.signal.aborted) await module.mount(panel, page);
  } catch (_) {
    if (page.signal.aborted) return;
    panel.innerHTML = '<p style="text-align:center;color:var(--faint);padding:40px 0;">診断データの読み込みに失敗しました。ページを再読み込みしてください。</p>';
  }
});
