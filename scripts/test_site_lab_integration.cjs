// Representative page types, menu widths, lab isolation and versioned modules.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../.local-preview');
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  const context = await browser.newContext({reducedMotion:'reduce'});
  await context.route(/google-analytics\.com|googletagmanager\.com/, r => r.abort());
  const page = await context.newPage(), errors = [], broken = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {if(r.url().startsWith(base) && r.status() >= 400) broken.push(r.url());});
  try {
    const pages = ['/', '/episodes/', '/episodes/128.html', '/games/', '/series/', '/series/developer-guests.html', '/awq/', '/shindan.html', '/news/', '/guide.html', '/otayori.html', '/privacy.html', '/lab.html?eps=31,22,23'];
    for (const url of pages) {
      await page.goto(base + url);
      if(url.includes('lab.html')) await page.locator('.lab-choose').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      for(const width of [320,390,768,1024,1280]) {
        await page.setViewportSize({width, height:900});
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${url} overflows at ${width}`);
        assert.equal(await page.locator('.site-header').count(), 1);
        assert.equal(await page.locator('.footer-nav a[href$="lab.html"]').count(), 1);
        if(await page.locator('.nav-toggle').isVisible()) {
          await page.locator('.nav-toggle').click();
          assert(await page.locator('#siteNav a[href$="lab.html"]').isVisible());
          await page.locator('.nav-toggle').click();
        }
        if(['/', '/lab.html?eps=31,22,23'].includes(url) && [390,1280].includes(width)) {
          await page.screenshot({path:path.join(out, `audit-${url === '/' ? 'home' : 'lab'}-${width}.png`), fullPage:true});
        }
      }
      console.log('PASS responsive page and navigation', url);
    }
    const modules = await page.evaluate(() => performance.getEntriesByType('resource')
      .map(r => new URL(r.name)).filter(u => u.pathname.includes('/assets/js/lab/'))
      .map(u => ({name:u.pathname.split('/').pop(), version:u.searchParams.get('v')})));
    assert.equal(new Set(modules.map(m => m.name)).size, 6);
    assert.equal(new Set(modules.map(m => m.version)).size, 1);
    assert(modules.every(m => m.version));
    await page.evaluate(() => { window.labAuditMarker = true; window.auditAudio = document.querySelector('audio'); });
    for(let i=0; i<3; i++) {
      await page.locator('.footer-nav a[href$="index.html"]').first().click();
      await page.locator('.hero').waitFor();
      assert.equal(await page.locator('link[href*="/lab.css"]').count(), 0);
      assert.equal(await page.locator('#episodeLab, .lab-drag-ghost, dialog[open]').count(), 0);
      await page.locator('.route-bubble-lab').click();
      await page.locator('.lab-choose').first().waitFor();
      assert.equal(await page.locator('link[href*="/lab.css"]').count(), 1);
      assert(await page.evaluate(() => labAuditMarker && auditAudio === document.querySelector('audio')));
    }
    assert.deepEqual(errors, []); assert.deepEqual(broken, []);
    console.log('PASS child versions, repeated lab navigation, CSS cleanup, persistent audio identity, no local 404s or JS errors');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
