// Diagnosis must retain analytics and release each discarded result immediately.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:8766';
(async () => {
  const browser = await chromium.launch({channel:'chrome', downloadsPath:path.resolve(__dirname,'../.local-preview/downloads')});
  const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  await context.route(/google-analytics\.com|googletagmanager\.com/, r => r.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.addInitScript(() => {
    window.liveBlobs = new Set();
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); liveBlobs.add(url); return url; };
    URL.revokeObjectURL = url => { liveBlobs.delete(url); revoke(url); };
  });
  try {
    await page.goto(base + '/shindan.html');
    await page.locator('#shName').waitFor();
    await page.evaluate(() => { window.events = []; window.gtag = (...args) => events.push(args); });
    const counts = [];
    for (const name of ['たわし','ひゅうま']) {
      await page.locator('#shName').fill(name);
      await page.locator('#shForm button').click();
      await page.locator('#shSharePreview').waitFor();
      const download = page.waitForEvent('download');
      await page.locator('#shSave').click();
      assert(await (await download).path(), 'the PNG must finish downloading before retry cleanup');
      await page.locator('#shCopyImage').click();
      await page.waitForFunction(() => document.querySelector('#shCopyImage').textContent === '✅ コピーしました！');
      await page.locator('#shRetry').click();
      counts.push(await page.evaluate(() => liveBlobs.size));
    }
    const events = await page.evaluate(() => events.filter(e => e[0] === 'event').map(e => e[1]));
    console.log(JSON.stringify({liveBlobsAfterRetry:counts, events}));
    assert.deepEqual(counts, [0,0], 'retry must release the previous PNG');
    assert.equal(events.filter(e => e === 'shindan_save').length, 2);
    assert.equal(events.filter(e => e === 'shindan_copy').length, 2);
    // Retry while images are still loading must not paint an obsolete result.
    await page.route('**/assets/img/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue().catch(() => {});
    });
    await page.locator('#shForm button').click();
    await page.locator('#shRetry').click();
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => liveBlobs.size), 0);
    assert(await page.locator('#shName').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS diagnosis save/copy analytics, repeated and in-flight retry cleanup');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
