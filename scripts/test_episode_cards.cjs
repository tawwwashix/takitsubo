/* Browser regression checks for independent episode/card tag links.
   NODE_PATH must expose Playwright. Screenshots go outside the site by default. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.TK_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'takitsubo-card-test');
fs.mkdirSync(output, { recursive: true });
const episodes = JSON.parse(fs.readFileSync(path.join(root, 'data/episodes.json'), 'utf8')).episodes;
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
});
const surfaces = [
  ['recommended', '/', '.recommended-grid .ep-card'],
  ['latest', '/', '.ep-card.featured'],
  ['recent', '/', 'section:has(h2:has-text("最近の配信")) .ep-card:has(a.tag)'],
  ['search', '/episodes/?q=ゲスト&sort=old', '#list .ep-card:has(a.tag)'],
  ['series', '/series/waruimura.html', '.ep-grid .ep-card'],
  ['related', '/episodes/38.html', 'section:has(h2:has-text("関連する回")) .ep-card'],
];
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    await context.route(/google-analytics\.com|googletagmanager\.com/, route => route.fulfill({ status: 200, body: '' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => !document.documentElement.classList.contains('navigating'));
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [name, url, selector] of surfaces) {
        await page.goto(base + url);
        const card = page.locator(selector).first();
        await card.waitFor();
        const link = card.locator('.ep-card-link');
        const destination = new URL(await link.getAttribute('href'), page.url()).href;
        const tag = card.locator('a.tag').first();
        const label = await tag.textContent();
        assert.equal(await card.locator('a a').count(), 0);
        await card.scrollIntoViewIfNeeded();
        // Images and blank card edges must still open the episode.
        const art = await card.locator('.ep-card-img').boundingBox();
        await page.mouse.click(art.x + art.width / 2, art.y + art.height / 2);
        await page.waitForURL(destination); await ready();
        await page.goBack(); await card.waitFor(); await ready();
        await card.click({ position: { x: 6, y: 6 } });
        await page.waitForURL(destination); await ready();
        await page.goBack(); await card.waitFor(); await ready();
        await tag.click();
        await page.waitForURL(u => u.pathname === '/episodes/' && u.searchParams.get('tag') === label);
        await page.locator('#list .ep-card').first().waitFor(); await ready();
        assert.equal(new URL(page.url()).searchParams.get('q'), null);
        assert.equal(new URL(page.url()).searchParams.get('sort'), null);
        assert.equal(await page.locator('.filter-btn.on').textContent(), label);
        assert.deepEqual(await page.locator('#list .ep-meta .ep-hash').allTextContents(),
          episodes.filter(e => e.tags.includes(label)).sort((a, b) => b.number - a.number).map(e => '#' + e.number));
        await page.goBack(); await card.waitFor(); await ready();
        await page.keyboard.press('Tab');
        await link.focus();
        assert.notEqual(await link.evaluate(e => getComputedStyle(e, '::after').outlineStyle), 'none');
        await page.keyboard.press('Tab');
        assert(await tag.evaluate(e => e === document.activeElement));
        assert.notEqual(await tag.evaluate(e => getComputedStyle(e).outlineStyle), 'none');
        await page.keyboard.press('Enter');
        await page.waitForURL(u => u.searchParams.get('tag') === label);
        await page.locator('#list .ep-card').first().waitFor(); await ready();
        console.log('PASS card image/edge, tag, results, Back and keyboard:', name, width);
      }
    }
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      const section = page.locator('.recommended-section');
      await section.scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.locator('.ep-card').evaluateAll(cards => cards.every(c => c.scrollWidth <= c.clientWidth)));
      await section.screenshot({ path: path.join(output, 'recommended-' + width + '.png') });
      console.log('PASS recommendation layout:', width);
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    const tag = page.locator('.recommended-grid a.tag').first();
    const popupPromise = context.waitForEvent('page');
    await tag.click({ modifiers: ['Control'] });
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).searchParams.get('tag'), await tag.textContent());
    await popup.close();
    // Real episode audio must survive both the tag route and a different episode card.
    await page.goto(base + '/episodes/128.html');
    await page.locator('.tkp-play').click();
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 1, null, { timeout: 60000 });
    await page.evaluate(() => {
      window.cardAudio = document.querySelector('audio');
      window.cardAudioStart = cardAudio.currentTime;
      window.cardAudioEvents = [];
      for (const name of ['pause', 'emptied', 'loadstart', 'error']) {
        cardAudio.addEventListener(name, () => cardAudioEvents.push(name));
      }
    });
    await page.locator('#siteNav a').filter({ hasText: 'ホーム' }).click(); await ready();
    await page.locator('.recommended-grid a.tag').first().click();
    await page.locator('#list .ep-card-link[href="61.html"]').click(); await ready();
    await page.goBack(); await ready();
    assert(await page.evaluate(() => document.querySelector('audio') === cardAudio &&
      !cardAudio.paused && cardAudio.currentTime > cardAudioStart));
    assert.deepEqual(await page.evaluate(() => cardAudioEvents), []);
    console.log('PASS actual audio continues through card tag, different episode and Back');
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await nojs.newPage();
    await staticPage.goto(base);
    await staticPage.locator('.recommended-grid .ep-card-link').first().click();
    await staticPage.waitForURL('**/episodes/128.html');
    await nojs.close();
    assert.deepEqual(errors, []);
    console.log('PASS Ctrl-click, static episode link without JS and no browser errors');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
