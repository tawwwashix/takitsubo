/* Integration tests: NODE_PATH must expose Playwright, or install it outside the site.
   Runs a local static server and real Chromium; never sends test events to GA. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.TK_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'takitsubo-navigation-test');
fs.mkdirSync(output, { recursive: true });
const report = { checks: [], continuity: [], errors: [] };
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});
function check(name) { report.checks.push(name); console.log('PASS ' + name); }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  console.log('Local test server: ' + base);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  console.log('Chromium started: ' + browser.version());
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route(/google-analytics\.com|googletagmanager\.com/, route => route.fulfill({ status: 200, body: '' }));
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  async function ready() { await page.waitForFunction(() => !document.documentElement.classList.contains('navigating')); }
  async function nav(label) {
    await page.locator('#siteNav a').filter({ hasText: label }).first().click(); await ready();
  }
  async function sample(label) {
    const data = await page.evaluate(() => ({ url: location.pathname, time: tkAudio.currentTime,
      same: document.getElementById('tkAudio') === window.originalAudio,
      paused: tkAudio.paused, rate: tkAudio.playbackRate, volume: tkAudio.volume,
      events: window.audioEvents.slice(), resources: performance.getEntriesByType('resource').filter(x => /assets\/js\//.test(x.name)).length }));
    data.label = label; report.continuity.push(data);
    assert(data.same, label + ': audio identity'); assert(!data.paused, label + ': playing');
    assert(data.time > report.continuity.at(-2)?.time || report.continuity.length === 1, label + ': time advances');
    assert.equal(data.events.length, 0, label + ': no interruption events'); assert.equal(data.resources, 6);
    console.log('AUDIO ' + label + ' ' + data.time.toFixed(2));
  }
  try {
    await page.goto(base + '/episodes/122.html');
    await page.locator('.tkp-play').click();
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 10, null, { timeout: 60000 });
    await page.evaluate(() => {
      window.originalAudio = document.querySelector('audio'); window.audioEvents = [];
      for (const event of ['pause', 'emptied', 'loadstart', 'waiting', 'stalled', 'error', 'seeking']) originalAudio.addEventListener(event, () => audioEvents.push({ event, t: originalAudio.currentTime }));
      originalAudio.volume = 0.65;
    });
    await sample('122 after 10 seconds of actual remote audio');
    await nav('エピソード'); await page.locator('#list .ep-card').first().waitFor(); await sample('episodes');
    await page.locator('#q').fill('ドラクエ');
    assert(await page.locator('#list .ep-card').count() > 0);
    await page.locator('#qClear').click();
    await page.locator('.filter-btn[data-tag]').nth(1).click();
    assert(new URL(page.url()).searchParams.has('tag'));
    await page.locator('#sort').selectOption('old'); check('Episode search, tag and sort');
    await nav('滝壺DB'); await page.locator('#gmQ').fill('しれん');
    assert(await page.locator('.gm-item:not([hidden])').count() > 0);
    await page.locator('.filter-btn[data-flv="lv3"]').click();
    assert(new URL(page.url()).searchParams.get('f') === 'lv3'); check('Database search and filter'); await sample('games');
    await nav('名物企画'); await sample('series');
    await page.locator('main a[href$="waruimura.html"]').first().click(); await ready(); await sample('waruimura');
    await nav('ホーム'); await sample('home');
    await page.goBack(); await ready(); await sample('back to series detail');
    await page.goBack(); await ready(); await sample('back to series');
    await page.goForward(); await ready(); await sample('forward'); check('Back/forward maintain audio');
    await nav('AWQ');
    const details = page.locator('details').first(); await details.locator('summary').click(); assert(await details.getAttribute('open') !== null);
    await page.locator('details').filter({ has: page.locator('summary', { hasText: '答え' }) }).first().locator('summary').click();
    await sample('AWQ'); check('AWQ ranking and answer disclosure');
    await nav('ゲーム診断'); await page.locator('#shName').fill('たわし'); await page.locator('#shForm button').click();
    await page.locator('.sh-r-title').waitFor(); assert(await page.locator('.sh-r-title').innerText());
    await page.locator('#shRetry').click(); await page.locator('#shName').fill('クリス'); await page.locator('#shForm button').click();
    await page.locator('.sh-r-title').waitFor(); await sample('shindan'); check('Diagnosis result and retry');
    await nav('お知らせ'); await sample('news');
    await nav('聴き方'); await sample('guide');
    await nav('おたより'); await sample('otayori');
    await page.locator('.footer-nav a').filter({ hasText: 'エピソード' }).click(); await ready();
    await page.locator('#q').fill('#121'); await page.locator('#list a[href="121.html"]').click(); await ready();
    await sample('121 before pressing play');
    const oldSrc = await page.locator('audio').getAttribute('src');
    await page.locator('.tkp-play').click();
    await page.waitForFunction(old => document.querySelector('audio').src !== old && document.querySelector('audio').currentTime > 1, oldSrc);
    assert(await page.evaluate(() => tkAudio === originalAudio)); check('B starts only when selected, same audio element');
    await page.locator('.tkp-rate').click(); assert.equal(await page.evaluate(() => tkAudio.playbackRate), 1.2);
    await page.locator('.tkp-fwd').click(); assert(await page.evaluate(() => tkAudio.currentTime > 25));
    await page.locator('.tkp-play').click(); assert(await page.evaluate(() => tkAudio.paused));
    const pausedTime = await page.evaluate(() => tkAudio.currentTime);
    await nav('ホーム'); assert(await page.evaluate(() => tkAudio.paused));
    assert(Math.abs(await page.evaluate(() => tkAudio.currentTime) - pausedTime) < 0.1);
    assert.equal(await page.evaluate(() => tkAudio.playbackRate), 1.2); assert.equal(await page.evaluate(() => tkAudio.volume), 0.65);
    await page.locator('.tk-mini-play').click(); await page.waitForFunction(() => !tkAudio.paused); check('Pause, speed, skip, volume preserved; mini resumes');
    await page.evaluate(() => { window.audioEvents = []; window.minimizeStart = tkAudio.currentTime; });
    await page.locator('.tk-mini-toggle').click();
    await page.waitForFunction(() => document.querySelector('.tk-mini').classList.contains('collapsed'));
    await page.waitForTimeout(700);
    assert(await page.evaluate(() => tkAudio === originalAudio && !tkAudio.paused && tkAudio.currentTime > window.minimizeStart));
    assert.equal(await page.locator('.tk-mini-toggle').getAttribute('aria-label'), 'プレイヤーを展開');
    assert.equal(await page.evaluate(() => window.audioEvents.length), 0);
    await nav('名物企画');
    assert(await page.locator('.tk-mini').evaluate(el => el.classList.contains('collapsed')));
    await page.goBack(); await ready();
    assert(await page.locator('.tk-mini').evaluate(el => el.classList.contains('collapsed')));
    await page.goForward(); await ready();
    assert(await page.locator('.tk-mini').evaluate(el => el.classList.contains('collapsed')));
    await page.goBack(); await ready();
    assert(await page.locator('.tk-mini').evaluate(el => el.classList.contains('collapsed')));
    await page.locator('.tk-mini-toggle').click();
    assert(!await page.locator('.tk-mini').evaluate(el => el.classList.contains('collapsed')));
    await page.locator('.tk-mini-toggle').click(); check('Minimize, expand and navigation state preservation');
    const resumeSource = await page.locator('audio').getAttribute('src');
    await page.locator('.tk-mini-title').click(); await ready();
    assert.equal(await page.locator('audio').getAttribute('src'), resumeSource);
    assert(await page.evaluate(() => tkAudio === originalAudio && !tkAudio.paused)); check('Returning to the playing episode reconnects controls without reloading audio');
    await page.locator('.tkp-play').click();
    await page.locator('#tkPlayer .tkp-seek').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    assert(Math.abs(await page.evaluate(() => tkAudio.currentTime) - 1) < 0.2); check('Seek slider supports keyboard controls');
    const chapter = page.locator('.chap-row[data-t]').nth(1), chapterTime = Number(await chapter.getAttribute('data-t'));
    await chapter.click(); await page.waitForFunction(t => Math.abs(tkAudio.currentTime - t) < 3 && !tkAudio.paused, chapterTime);
    assert(await chapter.evaluate(el => el.parentElement.classList.contains('now'))); check('Chapter seek, playback and highlighting');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.tkp-copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert(new URL(copied).pathname === '/episodes/121.html' && Number(new URL(copied).searchParams.get('t')) >= chapterTime); check('Copy position link points to the active episode');
    await page.locator('.art-zoom').first().click(); assert(await page.locator('.art-lightbox.show').isVisible());
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.art-lightbox.show').count(), 0); check('Episode artwork lightbox and Escape');
    await page.locator('.tkp-play').click();
    await page.waitForFunction(() => !!localStorage.getItem('tkpos:121'), null, { timeout: 5000 }); check('Existing saved position storage');
    await nav('ホーム'); await page.locator('.tk-mini-play').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'mobile-player.png') });
    assert(await page.locator('.tk-mini').isVisible());
    const bounds = await page.locator('.tk-mini').boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    const toggleBounds = await page.locator('.tk-mini-toggle').boundingBox();
    assert(toggleBounds && toggleBounds.width >= 32 && toggleBounds.height >= 32 && toggleBounds.x + toggleBounds.width <= 390);
    assert.equal(await page.locator('.tk-mini-toggle').getAttribute('aria-label'), 'プレイヤーを展開');
    await page.locator('.nav-toggle').click(); await page.locator('#siteNav a').filter({ hasText: '名物企画' }).first().click(); await ready();
    assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'false'); check('Mobile layout and hamburger navigation');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(output, 'desktop-player.png') });
    await page.locator('#siteNav a').filter({ hasText: 'ホーム' }).click({ modifiers: ['Control'] });
    await page.waitForTimeout(500); assert(context.pages().length > 1); check('Ctrl+click opens a new tab');
    for (const extra of context.pages().filter(x => x !== page)) await extra.close();
    await nav('ホーム');
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('a.svc-spotify').first().click()]);
    assert(popup.url().includes('spotify') || popup.url() === 'about:blank'); await popup.close(); check('External service opens separately');
    await nav('エピソード'); await page.locator('#q').fill('ドラクエ');
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' })); await page.waitForTimeout(100);
    const scrollBefore = await page.evaluate(() => scrollY);
    await nav('滝壺DB'); await page.goBack(); await ready();
    assert.equal(await page.locator('#q').inputValue(), 'ドラクエ');
    assert(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 5); check('Back restores search URL and scroll position');
    await page.evaluate(() => Takitsubo.navigate('/games/#gm-a')); await ready();
    const anchorID = await page.locator('.gm-letter-nav a[href^="#"]').first().getAttribute('href');
    await page.locator('.gm-letter-nav a[href^="#"]').first().click();
    assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(anchorID));
    const targetTop = await page.locator(anchorID).evaluate(el => el.getBoundingClientRect().top);
    assert(targetTop >= 0 && targetTop < 200); check('Hash navigation');
    await nav('エピソード'); await nav('ホーム'); await nav('エピソード');
    await page.locator('h1').focus(); await page.keyboard.press('/'); assert(await page.locator('#q').evaluate(el => el === document.activeElement));
    assert.equal(await page.locator('audio').count(), 1); assert.equal(await page.locator('.tk-mini').count(), 1); check('Repeated initialization and search keyboard shortcut');
    await nav('ホーム');
    await page.route('**/data/search.json*', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue().catch(() => {}); });
    await page.locator('#siteNav a').filter({ hasText: 'エピソード' }).click();
    await page.waitForURL('**/episodes/');
    await nav('滝壺DB'); await page.waitForTimeout(600);
    assert(page.url().endsWith('/games/')); assert.equal(await page.locator('#gmQ').count(), 1);
    await page.unroute('**/data/search.json*'); check('Leaving a page cancels its pending data initialization');
    const exempt = await page.evaluate(() => {
      const cases = [
        { href: 'https://example.com/' }, { href: 'mailto:test@example.com' }, { href: 'tel:0123456789' },
        { href: '/guide.html', target: '_blank' }, { href: '/guide.html', download: '' },
        { href: '/guide.html', 'data-no-navigation': '' }, { href: '/guide.html', onclick: 'void 0' },
        { href: '/guide.html', modifier: 'ctrlKey' }, { href: '/guide.html', modifier: 'shiftKey' },
        { href: '/guide.html', modifier: 'altKey' }, { href: '/guide.html', modifier: 'metaKey' },
        { href: '/guide.html', button: 1 }, { href: '/data/search.json' }
      ];
      return cases.map(spec => {
        const a = document.createElement('a');
        for (const [key, value] of Object.entries(spec)) if (key !== 'modifier' && key !== 'button') a.setAttribute(key, value);
        document.body.appendChild(a);
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: spec.button || 0, [spec.modifier || 'ctrlKey']: !!spec.modifier });
        let intercepted;
        window.addEventListener('click', e => { intercepted = e.defaultPrevented; e.preventDefault(); }, { once: true });
        a.dispatchEvent(event); a.remove(); return intercepted;
      });
    });
    assert(exempt.every(value => value === false)); check('All modifier/download/opt-out/protocol links bypass navigation');
    await page.evaluate(() => { Takitsubo.navigate('/games/'); Takitsubo.navigate('/news/'); });
    await page.waitForURL('**/news/'); await ready(); check('Rapid navigation: latest request wins');
    await page.route('**/guide.html', route => route.request().resourceType() === 'fetch' ? route.abort('failed') : route.continue());
    await nav('聴き方'); await page.waitForFunction(() => !window.originalAudio); assert(page.url().endsWith('/guide.html')); check('Fetch failure falls back to full HTML navigation');
    await page.unroute('**/guide.html');
    await page.goto(base + '/episodes/122.html'); await page.reload(); assert(await page.locator('#tkPlayer').count() === 1); check('Direct URL and reload');
    const nojs = await browser.newContext({ javaScriptEnabled: false }); const staticPage = await nojs.newPage();
    await staticPage.goto(base + '/episodes/122.html'); assert(await staticPage.locator('main').innerText());
    await staticPage.locator('#siteNav a').filter({ hasText: '滝壺DB' }).click(); assert(await staticPage.locator('.gm-item').count() > 0);
    await nojs.close(); check('Static HTML and links without JavaScript');
    assert.deepEqual(report.errors, []); check('No JavaScript errors');
  } catch (error) {
    report.playerAtFailure = await page.evaluate(() => ({ time: document.querySelector('audio')?.currentTime,
      paused: document.querySelector('audio')?.paused, source: document.querySelector('audio')?.src,
      position: localStorage.getItem('tkpos:121'), events: window.audioEvents?.slice(-15) })).catch(() => null);
    report.failure = error.stack; console.error(error); await page.screenshot({ path: path.join(output, 'failure.png') }); process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Report: ' + output);
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
