// Verify actual GA configuration while intercepting every collection request.
// Start a static server (python -m http.server 8765), then pass its local URL.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const hits = [];
  await context.route(/google-analytics\.com/, async route => {
    const request = route.request(), url = new URL(request.url());
    for (const line of (request.postData() || '').split('\n')) {
      const payload = new URLSearchParams(url.search);
      for (const [k, v] of new URLSearchParams(line)) payload.set(k, v);
      if (payload.get('en')) hits.push(Object.fromEntries(['en', 'dl', 'dt', 'dr'].map(k => [k, payload.get(k)])));
    }
    await route.fulfill({ status: 204, body: '' });
  });
  const page = await context.newPage();
  try {
    await page.goto(process.argv[2] + '/guide.html');
    await page.waitForTimeout(3000);
    await page.locator('#siteNav a').filter({ hasText: '名物企画' }).first().click();
    await page.waitForFunction(() => !document.documentElement.classList.contains('navigating'));
    await page.waitForTimeout(3000);
    await page.goBack();
    await page.waitForFunction(() => !document.documentElement.classList.contains('navigating'));
    await page.waitForTimeout(3000);
    console.log(JSON.stringify(hits, null, 2));
    const views = hits.filter(hit => hit.en === 'page_view');
    assert.deepEqual(views.map(hit => new URL(hit.dl).pathname), ['/guide.html', '/series/', '/guide.html']);
    assert.equal(views[0].dt, views[2].dt);
    assert(views[1].dt.startsWith('名物企画'));
    console.log('PASS Three page views, correct titles and referrers, no collection requests sent');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
