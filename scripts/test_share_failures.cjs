const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8766';
(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    for(const resource of ['**/assets/js/share-tools.js*', '**/data/shindan.json*']) {
      const context = await browser.newContext();
      await context.route(/google-analytics\.com|googletagmanager\.com/, r => r.abort());
      await context.route(resource, r => r.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/shindan.html');
      await page.waitForTimeout(700);
      const content = await page.locator('#shindanPanel').innerText();
      console.log(resource, content, errors);
      assert(content.includes('読み込みに失敗'), 'A failed dependency must not leave the loading message forever');
      assert.deepEqual(errors, []);
      await page.locator('.site-header .brand').click();
      await page.locator('.hero').waitFor();
      await context.close();
    }
    console.log('PASS failed module/data loads show a recoverable error and allow navigation');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
