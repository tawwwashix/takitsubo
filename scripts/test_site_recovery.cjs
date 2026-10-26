// Local media fixtures keep recovery tests independent of the podcast host.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:8766';

function silentWav(seconds) {
  const rate = 8000, bytes = seconds * rate * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
  return wav;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const wav = silentWav(180);
  try {
    for (const miniRetry of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage(), errors = [];
      let attempts = 0;
      page.on('pageerror', error => errors.push(error.message));
      await context.route(/google-analytics\.com|googletagmanager\.com/, route => route.abort());
      await context.route('**/*', route => {
        if (route.request().resourceType() !== 'media') return route.fallback();
        attempts++;
        if (attempts === 1) return route.fulfill({ status: 503, body: 'Temporary audio outage' });
        const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
        const start = range ? Number(range[1]) : 0;
        const end = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
        return route.fulfill({
          status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
          headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) }
        });
      });
      await context.addInitScript(() => localStorage.setItem('tkpos:128', JSON.stringify({ t: 75, ts: Date.now() })));
      await page.goto(base + '/episodes/128.html');
      await page.locator('.tkp-play').click();
      await page.waitForFunction(() => document.querySelector('audio').error?.code === 4);
      assert.equal(attempts, 1);
      assert.match(await page.locator('.tkp-note').textContent(), /読み込めませんでした/);
      if (miniRetry) {
        await page.locator('.site-header .brand').click();
        await page.locator('.hero').waitFor();
        await page.locator('.tk-mini.show').waitFor();
        assert.match(await page.locator('.tk-mini-message').textContent(), /再試行/);
        await page.locator('.tk-mini-play').click();
      } else {
        await page.locator('.tkp-play').click();
      }
      await page.waitForFunction(() => {
        const audio = document.querySelector('audio');
        return !audio.error && !audio.paused && audio.currentTime >= 75 && audio.readyState >= 3;
      });
      assert(attempts >= 2, 'retry must issue a new media request');
      assert((await page.evaluate(() => document.querySelector('audio').currentTime)) < 85, 'resume position must survive retry');
      assert.equal(await page.locator('.tk-mini-message').textContent(), '');
      if (!miniRetry) assert(await page.locator('.tkp-note').isHidden(), 'successful playback clears its error note');
      await page.evaluate(() => document.querySelector('audio').pause());
      console.log('PASS audio retry, resume position and warning cleanup via ' + (miniRetry ? 'persistent mini player' : 'episode player'));

      if (!miniRetry) {
        await page.evaluate(() => {
          const marker = document.createElement('div');
          marker.id = 'alreadyInert'; marker.inert = true; document.body.appendChild(marker);
        });
        await page.locator('.art-zoom').click();
        assert.equal(await page.locator('.art-lightbox').getAttribute('aria-label'), 'アートワークの拡大表示');
        for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
          await page.keyboard.press(key);
          assert(await page.locator('.art-lightbox-close').evaluate(el => el === document.activeElement));
        }
        assert(await page.locator('#sitePage').evaluate(el => el.inert));
        assert(await page.locator('.tk-mini').evaluate(el => el.inert));
        await page.keyboard.press('Escape');
        assert(await page.locator('.art-zoom').evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('#sitePage').evaluate(el => el.inert), false);
        assert(await page.locator('#alreadyInert').evaluate(el => el.inert), 'pre-existing inert state must be preserved');
        await page.locator('.art-zoom').click();
        await page.locator('.art-lightbox').click({ position: { x: 2, y: 2 } });
        assert(await page.locator('.art-lightbox').isHidden());
        await page.locator('.art-zoom').click();
        await page.evaluate(() => window.Takitsubo.navigate('../index.html'));
        await page.locator('.hero').waitFor();
        assert.equal(await page.locator('.art-lightbox').count(), 0);
        assert.equal(await page.locator('.tk-mini').evaluate(el => el.inert), false, 'disposing the modal restores persistent controls');
        assert.equal(await page.locator('#sitePage').evaluate(el => el.inert), false);
        assert(await page.locator('#alreadyInert').evaluate(el => el.inert));
        console.log('PASS lightbox keyboard focus, background isolation, Escape/backdrop close and navigation cleanup');
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
