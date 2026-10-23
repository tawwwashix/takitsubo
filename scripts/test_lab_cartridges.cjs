const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../.local-preview');
const key = 'takitsubo:episode-lab:collection:v1';
const legacyKey = 'takitsubo:excavation:v1';
const retired = ['excavate.html','assets/js/excavate-loader.js','assets/js/excavate/game.js','assets/css/excavate.css','start-excavation.bat','scripts/preview_excavation.py'];

(async () => {
  const source = fs.readFileSync(path.resolve(__dirname,'../assets/js/lab/game.js'),'utf8');
  const { cartridgeTone } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const episodes = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/search.json'),'utf8')).episodes.filter(e=>e.number>0);
  assert.deepEqual([35,33,7].map(cartridgeTone),['gray','gray','gray']);
  const distribution = {}, large = {};
  for (const ep of episodes) { const c=cartridgeTone(ep.number); distribution[c]=(distribution[c]||0)+1; }
  for (let n=1;n<=10000;n++) { const c=cartridgeTone(n); large[c]=(large[c]||0)+1; }
  assert(Math.abs(large.gray/10000-.7)<.02); assert(Math.abs(large.black/10000-.2)<.02);
  const trio = ['gray','black','amber'].map(t => episodes.find(e=>cartridgeTone(e.number)===t).number);
  console.log('COLORS',distribution,'EXAMPLE',trio);
  for(const file of retired) assert(!fs.existsSync(path.resolve(__dirname,'..',file)),file+' still exists');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const checks=[], errors=[];
  const check=s=>{checks.push(s);console.log('PASS '+s);};
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
  const p=await context.newPage(); p.on('pageerror',e=>errors.push(e.message));
  const url=base+'/lab.html?eps='+trio.join(',');
  try {
    await p.goto(url); await p.locator('.lab-choose').first().waitFor();
    assert.equal(await p.locator('.is-inspected,.is-selected').count(),0);
    assert.equal(await p.locator('#labConfirm').getAttribute('aria-disabled'),'true');
    const tones=await p.locator('#labCards .lab-art').evaluateAll(es=>es.map(e=>e.dataset.tone));
    assert.deepEqual(tones,['gray','black','amber']);
    assert.equal(await p.locator('#labCards .lab-cart-front text').first().textContent(),'GAME NO TAKITSUBO');
    assert.equal(await p.locator('.lab-scene-caption,.lab-card-number,.lab-stage-hint,.lab-bottom').count(),0);
    assert(!(await p.locator('#episodeLab').innerText()).includes('まだ見ぬ一回'));
    await p.screenshot({path:path.join(out,'cartridges-mobile-neutral.png'),fullPage:true});
    check('Starts unselected, fixed gray/black/color cases, requested chrome removed');
    for(const [width,height] of [[320,700],[390,844],[600,900],[768,1024],[1280,850]]) {
      await p.setViewportSize({width,height}); await p.goto(url); await p.locator('.lab-choose').first().waitFor();
      const neutral=await p.locator('#labCards .lab-art').first().boundingBox();
      for(let i=0;i<3;i++) {
        await p.locator('.lab-choose').nth(i).tap();
        await p.waitForTimeout(400); // allow the finite layout transition to settle
        assert.equal(await p.locator('.is-inspected').getAttribute('data-number'),String(trio[i]));
        const enlarged=await p.locator('#labCards .lab-art').nth(i).boundingBox();
        if(width<=600) assert(enlarged.width/neutral.width>1.65,'Insufficient enlargement at '+width);
        const hitAreas=await p.locator('.lab-choose').evaluateAll(buttons=>buttons.map(button=>{
          const r=button.getBoundingClientRect();
          const hit=document.elementFromPoint(r.left+r.width/2,Math.min(innerHeight-1,r.top+r.height/2));
          return r.width>=44 && (hit===button||button.contains(hit));
        }));
        assert(hitAreas.every(Boolean),'A candidate cannot be tapped at '+width);
        const inside=await p.evaluate(()=>{
          const room=document.querySelector('.lab-scene').getBoundingClientRect();
          return [...document.querySelectorAll('#labCards .lab-cart-front')].every(el=>{
            const r=el.getBoundingClientRect();return r.top>=room.top && r.bottom<=room.bottom && r.left>=room.left && r.right<=room.right;
          });
        });
        assert(inside,'Clipped enlarged cartridge at '+width+' slot '+i);
      }
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null);
    }
    check('Every slot enlarges without clipping; all three remain touchable at 320–1280px; inspection does not save');
    await p.setViewportSize({width:390,height:844});
    await p.locator('#labConfirm').tap();
    await p.locator('.lab-choose').nth(2).tap();
    const before=await p.locator('.is-inspected .lab-cartridge').evaluate(e=>getComputedStyle(e).transform);
    await p.waitForFunction(t=>getComputedStyle(document.querySelector('.is-inspected .lab-cartridge')).transform!==t,before);
    await p.screenshot({path:path.join(out,'cartridges-mobile-selected.png'),fullPage:true});
    await p.locator('#labDexToggle').tap();
    assert.equal(await p.locator('#labDexGrid .lab-art').getAttribute('data-tone'),'amber');
    assert.equal(await p.locator('#labDexGrid .lab-cartridge').evaluate(e=>getComputedStyle(e).animationName),'none');
    await p.screenshot({path:path.join(out,'cartridges-dex.png'),fullPage:true});
    await p.keyboard.press('Escape'); await p.reload(); await p.locator('.lab-choose').first().waitFor();
    assert.deepEqual(await p.locator('#labCards .lab-art').evaluateAll(es=>es.map(e=>e.dataset.tone)),tones);
    check('Confirmed case keeps moving; the collection uses the same fixed case and stays static; reload preserves colors');
    const migrated=await browser.newContext();
    await migrated.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
    await migrated.addInitScript(({legacyKey})=>{if(localStorage.getItem(legacyKey)===null)localStorage.setItem(legacyKey,JSON.stringify([35,33,7,35,999999,'12']));},{legacyKey});
    const q=await migrated.newPage();await q.goto(url);await q.locator('.lab-choose').first().waitFor();
    assert.deepEqual(await q.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),[35,33,7]);
    assert.deepEqual(await q.evaluate(k=>JSON.parse(localStorage.getItem(k)),legacyKey),[35,33,7,35,999999,'12']);
    await q.evaluate(k=>localStorage.setItem(k,'[1]'),legacyKey);await q.reload();await q.locator('.lab-choose').first().waitFor();
    assert.deepEqual(await q.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),[35,33,7]);
    assert.deepEqual(await q.locator('#labCards .lab-art').evaluateAll(es=>es.map(e=>e.dataset.tone)),tones);
    await q.locator('.lab-choose').first().hover();
    assert.equal(await q.locator('.is-inspected').count(),0);
    assert.equal(await q.locator('.lab-choose').first().locator('.lab-cartridge').evaluate(e=>getComputedStyle(e).animationName),'lab-present');
    await q.locator('.lab-choose').nth(1).click();await q.waitForTimeout(400);
    await q.screenshot({path:path.join(out,'cartridges-desktop.png'),fullPage:true});
    await migrated.close();
    check('Legacy collection imports once without erasing the source; colors match across browsers; hover does not select');
    const response=await p.request.get(base+'/excavate.html');assert.equal(response.status(),404);
    await p.goto(base+'/');assert.equal(await p.locator('a[href*="excavate"]').count(),0);
    assert(!(await (await p.request.get(base+'/sitemap.xml')).text()).includes('excavate.html'));
    assert.deepEqual(errors,[]);check('Retired page returns 404, site links and sitemap are cleaned, no browser errors');
  } finally {
    fs.writeFileSync(path.join(out,'cartridges-report.json'),JSON.stringify({checks,errors,distribution,example:trio},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
