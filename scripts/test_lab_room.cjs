const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../.local-preview');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route(/google-analytics\.com|googletagmanager\.com/, r => r.abort());
  const p = await context.newPage(), checks = [], errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const check = s => { checks.push(s); console.log('PASS ' + s); };
  const ready = () => p.locator('.lab-choose').first().waitFor();
  const paused = () => p.locator('.lab-cartridge').first().evaluate(e => getComputedStyle(e).animationPlayState);
  try {
    await p.goto(base + '/lab.html?eps=101,30,95&pick=101'); await ready();
    assert(await p.locator('.site-header').isHidden()); assert(await p.locator('.site-footer').isHidden());
    await p.locator('.lab-choose').first().focus(); await p.keyboard.press('ArrowRight');
    assert.equal(await p.locator('.is-inspected').getAttribute('data-number'), '30');
    await p.keyboard.press('ArrowRight');
    assert.equal(await p.locator('.is-inspected').getAttribute('data-number'), '95');
    await p.keyboard.press('ArrowRight');
    assert.equal(await p.locator('.is-inspected').getAttribute('data-number'), '101');
    assert.equal(await p.evaluate(() => localStorage.getItem('takitsubo:excavation:v1')), null);
    assert.equal(new URL(p.url()).searchParams.get('pick'), '101');
    check('Keyboard inspection wraps across three candidates without collecting or altering the sender choice');
    await p.locator('#labMotion').click();
    assert.equal(await paused(), 'paused');
    for (const [width, height, name] of [[1280,800,'desktop'],[390,844,'mobile'],[320,700,'small'],[844,390,'landscape'],[768,1024,'tablet']]) {
      await p.setViewportSize({ width, height });
      await p.evaluate(() => window.scrollTo(0,0));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // The visible 3D faces and sender label must fit within the clipped scene.
      const layout = await p.evaluate(() => {
        const room = document.querySelector('.lab-scene').getBoundingClientRect();
        return [...document.querySelectorAll('.lab-cart-front,.lab-sender')].map(e => {
          const r = e.getBoundingClientRect();
          return r.top >= room.top && r.bottom <= room.bottom && r.left >= room.left && r.right <= room.right;
        });
      });
      assert(layout.every(Boolean), 'Clipped cartridge or sender marker at ' + width);
      await p.screenshot({ path: path.join(out, 'lab-room-' + name + '.png'), fullPage: true });
    }
    check('All three cartridges and sender marker fit at desktop, mobile, 320px, landscape and tablet widths');
    await p.setViewportSize({ width:1280, height:800 });
    await p.locator('#labMotion').click();
    const before = await p.locator('.lab-float').first().evaluate(e => getComputedStyle(e).transform);
    await p.waitForTimeout(180);
    const after = await p.locator('.lab-float').first().evaluate(e => getComputedStyle(e).transform);
    assert.notEqual(before, after);
    await p.locator('#labShareToggle').click(); assert.equal(await paused(), 'paused');
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#labShareToggle').evaluate(e => document.activeElement === e), true);
    assert.equal(await paused(), 'running');
    await p.locator('#labDexToggle').click(); assert.equal(await paused(), 'paused');
    await p.keyboard.press('Escape');
    await p.setViewportSize({ width:390, height:350 });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForFunction(() => document.querySelector('#episodeLab').classList.contains('lab-paused'));
    await p.evaluate(() => window.scrollTo(0,0));
    await p.waitForFunction(() => !document.querySelector('#episodeLab').classList.contains('lab-paused'));
    check('Motion advances, stops manually/in dialogs/offscreen, and resumes; Escape restores menu focus');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await p.locator('.lab-cartridge').first().evaluate(e => getComputedStyle(e).animationName), 'none');
    await p.locator('.lab-choose').nth(2).click(); await p.locator('#labConfirm').click();
    assert.equal(await p.locator('.is-selected').getAttribute('data-number'), '95');
    assert.equal(await p.locator('#labListen').getAttribute('href'), 'episodes/95.html');
    await p.setViewportSize({ width:390, height:844 });
    await p.screenshot({ path: path.join(out, 'lab-room-selected.png'), fullPage:true });
    await p.locator('#labShuffle').click();
    assert(await p.locator('#labInspection').isVisible()); assert(await p.locator('#labResult').isHidden());
    check('Reduced-motion mode retains complete inspect/confirm/reroll flow and selected cartridge presentation');
    await p.locator('.lab-exit').click(); await p.locator('.hero').waitFor();
    assert(await p.locator('.site-header').isVisible()); assert(await p.locator('.site-footer').isVisible());
    assert.equal(await p.locator('link[href*="/lab.css"]').count(), 0);
    await p.goBack(); await ready();
    assert.equal(await p.locator('link[href*="/lab.css"]').count(), 1);
    check('Exit restores normal site chrome; returning mounts one fresh lab');
    assert.deepEqual(errors, []);
  } finally {
    fs.writeFileSync(path.join(out,'lab-room-report.json'), JSON.stringify({checks,errors},null,2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
