// New search entry and real HTTP-404 recovery, using the local preview server.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../.local-preview');
fs.mkdirSync(out, {recursive:true});

(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  const context = await browser.newContext({reducedMotion:'reduce'});
  await context.route(/google-analytics\.com|googletagmanager\.com/, route => route.abort());
  const page = await context.newPage(), errors = [], broken = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if(response.url().startsWith(base) && response.status() >= 400 && !new URL(response.url()).pathname.startsWith('/missing/')) broken.push(response.url());
  });
  const form = () => page.getByRole('search', {name:'エピソードを検索'});
  try {
    await page.goto(base + '/');
    for (const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.recommended-grid .ep-card').count(),4);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const layout = await form().evaluate(f => {
        const input=f.querySelector('input').getBoundingClientRect(), button=f.querySelector('button').getBoundingClientRect();
        return {sameRow:Math.abs(input.top-button.top)<1, inputWidth:input.width, buttonHeight:button.height,
          afterIntro:document.querySelector('.info-box').getBoundingClientRect().bottom<f.getBoundingClientRect().top,
          beforeCards:f.getBoundingClientRect().bottom<document.querySelector('.recommended-grid').getBoundingClientRect().top};
      });
      assert(layout.sameRow && layout.inputWidth >= 190 && layout.buttonHeight >= 44 && layout.afterIntro && layout.beforeCards, JSON.stringify(layout));
      if ([390,1280].includes(width)) {
        await form().scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,`search-home-${width}.png`)});
      }
    }
    await form().locator('input').fill('   ');
    await form().locator('button').click();
    assert.equal(new URL(page.url()).pathname,'/');
    assert(await form().locator('input').evaluate(el=>el===document.activeElement));
    for (const [term,number] of [['#100',100],['パタポン1+2 リプレイ',45],['DETECTIVE X CASE FILE #1『御仏の殺人』',84]]) {
      await form().locator('input').fill(term);
      await form().locator('input').press('Enter');
      await page.locator('#list a[href="'+number+'.html"]').waitFor();
      assert.equal(new URL(page.url()).searchParams.get('q'),term);
      assert.equal(await page.locator('#q').inputValue(),term);
      await page.goBack(); await form().waitFor();
    }
    await form().locator('input').fill('風来のシレン');
    await form().locator('a').click();
    await page.locator('#gmQ').waitFor();
    assert.equal(await page.locator('#gmQ').inputValue(),'風来のシレン');
    assert(await page.locator('.gm-item:not([hidden])').count()>0);
    console.log('PASS four widths, four recommended cards, empty query, Enter, special characters, search results and database handoff');

    // The same audio element must keep playing through the form submission.
    await page.goto(base+'/episodes/122.html');
    await page.locator('.tkp-play').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentTime>1, null,{timeout:60000});
    await page.evaluate(()=>{window.discoveryAudio=document.querySelector('audio');window.discoveryTime=discoveryAudio.currentTime;});
    await page.locator('.site-header .brand').click(); await form().waitFor();
    await form().locator('input').fill('#100'); await form().locator('button').click();
    await page.locator('#list a[href="100.html"]').waitFor();
    assert(await page.evaluate(()=>discoveryAudio===document.querySelector('audio')&&!discoveryAudio.paused&&discoveryAudio.currentTime>=discoveryTime));
    await page.evaluate(()=>discoveryAudio.pause());
    console.log('PASS real audio continues through homepage search submission');

    for (const missing of ['/missing/deep/page.html','/missing/deep/']) {
      const response=await page.goto(base+missing);
      assert.equal(response.status(),404);
      assert.equal(await page.locator('h1').textContent(),'ページが見つかりませんでした');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex');
      assert.equal(await page.locator('link[rel="canonical"]').count(),0);
      for (const width of [320,390,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(()=>document.fonts.ready);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert(await page.locator('.not-found-bird').evaluate(img=>img.complete&&img.naturalWidth>0));
        if ([390,1280].includes(width)) await page.screenshot({path:path.join(out,`not-found-${width}.png`),fullPage:true});
      }
      await form().locator('input').fill('#100'); await form().locator('button').click();
      await page.locator('#list a[href="100.html"]').waitFor();
      assert.equal(new URL(page.url()).pathname,'/episodes/');
      assert.equal(await page.locator('meta[name="robots"]').count(),0,'404 noindex must not leak into a valid destination');
      await page.goBack(); await page.locator('.not-found').waitFor();
      await page.locator('.not-found-home').click(); await page.locator('.hero').waitFor();
      assert.equal(await page.locator('meta[name="robots"]').count(),0);
    }
    assert.deepEqual(errors,[]); assert.deepEqual(broken,[]);
    console.log('PASS real nested 404 responses, assets, noindex, responsive layout, search, Back and home recovery');
    const nojs = await browser.newContext({javaScriptEnabled:false});
    const staticPage = await nojs.newPage();
    assert.equal((await staticPage.goto(base+'/missing/without-js/')).status(),404);
    await staticPage.locator('.episode-search input').fill('#100');
    await staticPage.locator('.episode-search button').click();
    await staticPage.waitForURL('**/episodes/?q=%23100');
    assert(await staticPage.locator('main').isVisible());
    await nojs.close();
    console.log('PASS ordinary GET form and recovery links without JavaScript (interactive filtering still requires JavaScript)');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
