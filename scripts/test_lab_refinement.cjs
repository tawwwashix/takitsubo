const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const PARTY='takitsubo:episode-lab:party:v1', DEX='takitsubo:episode-lab:collection:v1';
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  const context=await browser.newContext(),p=await context.newPage(),errors=[];
  await context.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
  p.on('pageerror',e=>errors.push(e.message));
  const ready=()=>p.locator('.lab-choose').first().waitFor();
  const state=()=>p.evaluate(({PARTY,DEX})=>({party:JSON.parse(localStorage.getItem(PARTY)),dex:JSON.parse(localStorage.getItem(DEX))}),{PARTY,DEX});
  try {
    await p.goto(base+'/lab.html?eps=31,22,23');await ready();await p.evaluate(()=>document.fonts.ready);
    const stats=await p.evaluate(async()=>{
      const url=new URL(document.querySelector('#episodeLab').dataset.module,location.href);url.pathname=url.pathname.replace('game.js','selection.js');
      const {drawRound,readSharedParty}=await import(url);
      const episodes=Array.from({length:128},(_,i)=>({number:i+1})),collection=new Set(episodes.slice(0,127).map(e=>e.number));
      let seed=12345,found=0,slots=[0,0,0],valid=true;
      const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      for(let i=0;i<10000;i++) {
        const round=drawRound(episodes,episodes.slice(0,3),collection,random);
        const index=round.findIndex(e=>e.number===128);
        if(index>=0){found++;slots[index]++;}
        valid&&=new Set(round.map(e=>e.number)).size===3 && round.every(e=>e.number>3);
      }
      const map=new Map(episodes.map(e=>[e.number,e]));
      return {found,slots,valid,invalid:['?party=','?party=1,1','?party=0','?party=999','?party=1,2,3,4,5,6,7','?party=<script>'].every(q=>readSharedParty(q,map).invalid)};
    });
    assert(stats.valid&&stats.invalid);assert(stats.found>4800&&stats.found<5500,JSON.stringify(stats));
    assert(stats.slots.every(n=>n>1400&&n<2000),JSON.stringify(stats));
    console.log('PASS discovery probability, random slot, exclusion, deduplication and invalid links',stats);

    // Real long/short content must not move the reroll target, across rounds or selection.
    const source=JSON.parse(fs.readFileSync('data/search.json','utf8'));
    source.episodes.find(e=>e.number===31).title='長いタイトルの表示確認。'.repeat(40);
    await p.route('**/data/search.json*',r=>r.fulfill({json:source}));
    for(const width of [320,390,768,1280]) {
      await p.setViewportSize({width,height:900});
      await p.goto(base+'/lab.html?eps=31,22,23');await ready();await p.evaluate(()=>document.fonts.ready);
      const top=()=>p.locator('#labShuffle').evaluate(e=>e.getBoundingClientRect().top+scrollY);
      const before=await top();
      await p.locator('.lab-choose').first().click();
      assert(await p.locator('#labInspectTitle').evaluate(e=>e.scrollHeight>e.clientHeight));
      assert.equal(await p.locator('#labInspectTitle').evaluate(e=>getComputedStyle(e).webkitLineClamp),width<=760?'3':'2');
      for(let i=0;i<12;i++) {
        await p.locator('#labShuffle').evaluate(e=>e.click());
        await p.locator('.lab-choose').nth(i%3).evaluate(e=>e.click());
        assert(Math.abs(await top()-before)<1,`Control moved at ${width}`);
      }
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await p.unroute('**/data/search.json*');
    console.log('PASS fixed controls with extreme titles and repeated rerolls at four widths');

    await p.evaluate(({PARTY,DEX})=>{localStorage.setItem(PARTY,'[12,93,120,36,80,51]');localStorage.setItem(DEX,'[12,93,120,36,80,51]');},{PARTY,DEX});
    await p.goto(base+'/lab.html?party=31,22,23');
    await p.locator('#labSharedGrid a').first().waitFor();
    const original=await state();
    assert.deepEqual(original.party,[12,93,120,36,80,51]);
    assert.deepEqual(original.dex,[12,93,120,36,80,51]);
    assert.equal(await p.locator('#labSharedGrid a').first().getAttribute('href'),'episodes/31.html');
    assert(await p.locator('#labExperience').isHidden());
    await p.locator('#labSharedGrid a').first().click();await p.waitForURL('**/episodes/31.html');
    await p.goBack();await p.locator('#labSharedGrid a').first().waitFor();
    assert.deepEqual(await state(),original);
    await p.locator('#labStartOwn').click();await ready();assert(!new URL(p.url()).searchParams.has('party'));
    assert.deepEqual(await state(),original);
    await p.goto(base+'/lab.html?party=1,999999');await ready();assert((await p.locator('#labNotice').textContent()).includes('手持ちは読み取れなかった'));
    console.log('PASS recipient view, episode navigation/back, own records unchanged, invalid-link recovery');

    await p.goto(base+'/lab.html?eps=31,22,23');await ready();await p.evaluate(()=>document.fonts.ready);
    await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();
    assert.equal(await p.locator('#labSendDex').count(),0);
    assert.equal(await p.locator('#labReplaceTitle').textContent(),'手持ちがいっぱいだ！ どれと入れ替える？');
    await p.keyboard.press('Escape');assert.deepEqual(await state(),original);
    await p.locator('#labRegister').evaluate(e=>e.click());
    assert((await state()).dex.includes(31));
    await p.locator('#labShuffle').evaluate(e=>e.click());assert.equal(await p.locator('.lab-transfer').count(),0);

    for(const width of [320,390,1280]) {
      await p.setViewportSize({width,height:1000});
      const tops=await p.locator('#labPartyGrid .lab-art').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
      const columns=width<760?3:6;
      for(let i=0;i<6;i+=columns) assert(Math.max(...tops.slice(i,i+columns))-Math.min(...tops.slice(i,i+columns))<1);
    }
    await p.locator('#labReorder').click();assert.equal(await p.locator('#labReorder').textContent(),'完了');
    await p.locator('#labPartyGrid [data-number="120"]').click();
    const a=p.locator('#labPartyGrid [data-number="12"]'),b=p.locator('#labPartyGrid [data-number="93"]');
    await a.scrollIntoViewIfNeeded();const ar=await a.boundingBox(),br=await b.boundingBox();
    await p.mouse.move(ar.x+ar.width/2,ar.y+25);await p.mouse.down();await p.mouse.move(br.x+br.width/2,br.y+25,{steps:10});await p.mouse.up();
    assert.deepEqual((await state()).party,[93,12,120,36,80,51]);
    assert.equal(await p.locator('.is-reorder-source').count(),0);assert(await p.locator('#labItem').isHidden());
    await p.waitForTimeout(550);
    await p.locator('#labPartyGrid [data-number="120"]').click();await p.locator('#labPartyGrid [data-number="36"]').click();
    assert.deepEqual((await state()).party,[93,12,36,120,80,51]);
    await p.locator('#labReorder').click();
    console.log('PASS uniform short-title tiles, cancel without registration, tap and drag in reorder mode');

    await p.evaluate(({PARTY,DEX})=>{localStorage.setItem(PARTY,'[]');localStorage.setItem(DEX,'[]');},{PARTY,DEX});
    await p.goto(base+'/lab.html?eps=31,22,23');await ready();await p.evaluate(()=>document.fonts.ready);
    await p.setViewportSize({width:1280,height:1200});
    await p.locator('.lab-choose').first().click();
    const flight=await p.evaluate(async()=>{document.querySelector('#labConfirm').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const f=document.querySelector('.lab-transfer');if(f)f.getAnimations()[0].pause();return !!f;});
    assert(flight);assert.deepEqual((await state()).party,[31]);
    await p.evaluate(()=>document.querySelector('.lab-transfer').getAnimations()[0].finish());
    await p.waitForFunction(()=>!document.querySelector('.lab-transfer'));
    assert.equal(await p.locator('.is-arriving').count(),0);
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.locator('.lab-choose').nth(1).click();await p.locator('#labRegister').evaluate(e=>e.click());
    assert.equal(await p.locator('.lab-transfer').count(),0);assert((await state()).dex.includes(22));
    assert.equal(await p.locator('#labDexToggle').evaluate(e=>e.getAnimations().length),0,'Reduced motion must disable the discovery flash');
    await p.emulateMedia({reducedMotion:'no-preference'});
    await p.locator('#labMotion').click();
    await p.locator('.lab-choose').nth(2).click();await p.locator('#labConfirm').evaluate(e=>e.click());
    assert.equal(await p.locator('.lab-transfer').count(),0);assert.deepEqual((await state()).party,[31,23]);
    assert.equal(await p.locator('#labDexToggle').evaluate(e=>e.getAnimations().length),0,'Animation OFF must disable the discovery flash');
    assert.deepEqual(await p.locator('#episodeLab').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName||a.transitionProperty||'web-animation')),[],'Animation OFF must disable selection transitions and registration feedback');
    assert.equal(await p.locator('.is-registered,.is-updated').count(),0,'Disabled feedback must not be queued for later');
    await p.locator('#labMotion').click();
    assert.equal(await p.locator('.is-registered,.is-updated').count(),0,'Resuming motion must not replay earlier feedback');
    console.log('PASS immediate saves, insertion cleanup, interruption, reduced motion and explicit motion off');
    for(const width of [390,1280]) {
      await p.setViewportSize({width,height:900});
      await p.goto(base+'/lab.html?eps=31,22,23');await ready();await p.locator('.lab-choose').first().click();
      await p.screenshot({path:`.local-preview/refined-lab-${width}.png`,fullPage:true});
      await p.goto(base+'/lab.html?party=12,93,120,36,80,51');await p.locator('#labSharedGrid a').first().waitFor();
      await p.screenshot({path:`.local-preview/refined-shared-${width}.png`,fullPage:true});
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
