// A diagnosis-only deployment must not reload unrelated pages or stop the player.
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  const context = await browser.newContext(), page = await context.newPage(), errors = [];
  await context.route(/google-analytics\.com|googletagmanager\.com/, r => r.abort());
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/js/shindan/main.js*', route => {
    const version = new URL(route.request().url()).searchParams.get('v');
    const source = fs.readFileSync(path.join(root,'assets/js/shindan/main.js'),'utf8');
    return route.fulfill({contentType:'text/javascript', body:`(window.diagnosisVersions ||= []).push(${JSON.stringify(version)});\n` + source});
  });
  try {
    await page.goto(base + '/');
    assert.equal(await page.evaluate(() => window.diagnosisVersions?.length || 0), 0);
    await page.evaluate(() => { window.shellMarker = true; window.originalAudio = document.querySelector('audio'); });
    const go = () => page.locator('#siteNav a[href$="shindan.html"]').click();
    await go(); await page.locator('#shName').waitFor();
    const first = await page.evaluate(() => diagnosisVersions[0]);
    await page.locator('#shName').fill('たわし');await page.locator('#shForm button').click();
    await page.locator('#shSharePreview').waitFor();
    await page.locator('.site-header .brand').click();await page.locator('.hero').waitFor();
    await page.route('**/shindan.html', route => {
      const html = fs.readFileSync(path.join(root,'shindan.html'),'utf8')
        .replace(/data-module="assets\/js\/shindan\/main\.js\?v=[^"]+"/, 'data-module="assets/js/shindan/main.js?v=test-next"');
      return route.fulfill({contentType:'text/html', body:html});
    });
    await go(); await page.locator('#shName').waitFor();
    assert.deepEqual(await page.evaluate(() => diagnosisVersions), [first, 'test-next']);
    assert(await page.evaluate(() => shellMarker && originalAudio === document.querySelector('audio')));
    await page.locator('.site-header .brand').click();await page.locator('.hero').waitFor();
    await go();await page.locator('#shName').waitFor();
    assert.equal(await page.evaluate(() => diagnosisVersions.length), 2, 'same module reused; mount still runs each visit');
    assert.equal(await page.locator('#shForm').count(), 1);
    assert.deepEqual(errors, []);
    // Entry-module failure has the same recoverable UI as data/share-module failure.
    const failure = await browser.newContext();
    await failure.route(/google-analytics\.com|googletagmanager\.com/, r => r.abort());
    await failure.route('**/assets/js/shindan/main.js*', r => r.abort());
    const p = await failure.newPage();await p.goto(base + '/shindan.html');
    await p.getByText('診断データの読み込みに失敗しました。ページを再読み込みしてください。', {exact:true}).waitFor();
    await failure.close();
    console.log('PASS diagnosis lazy loading, version change during SPA navigation, unchanged audio, repeat mount and module failure');
  } finally {await browser.close();}
})().catch(e => {console.error(e);process.exitCode=1;});
