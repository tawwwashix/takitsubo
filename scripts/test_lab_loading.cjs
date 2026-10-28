// Delayed/failed resources exercise the real loading and navigation lifecycle.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const out = process.env.TK_TEST_OUTPUT || '.local-preview/test_lab_loading';
fs.mkdirSync(out, {recursive:true});
const gate = () => { let release; const promise = new Promise(r => release=r); return {promise,release}; };
(async()=>{
 const browser=await chromium.launch({channel:'chrome'}),errors=[],checks=[];
 const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();
 await context.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
 p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.locator('#labCards:not(.is-loading) .lab-choose').first().waitFor();
 const check=message=>{checks.push(message);console.log('PASS',message);};
 const ids=()=>p.locator('#labCards .lab-card').evaluateAll(es=>es.map(e=>Number(e.dataset.number)));
 try {
  const moduleGate=gate(),shareGate=gate();let dataFetched=false,shareImageRequests=0;
  p.on('response',r=>{if(r.url().includes('/data/search.json'))dataFetched=true;});
  p.on('request',r=>{if(r.url().includes('/lab/party-share.js'))shareImageRequests++;});
  await p.route('**/lab/game.js*',async r=>{await moduleGate.promise;await r.continue();});
  await p.route('**/share-tools.js*',async r=>{await shareGate.promise;await r.continue();});
  const dataResponse = p.waitForResponse(r=>r.url().includes('/data/search.json'));
  await p.goto(base+'/lab.html?eps=31,22,23',{waitUntil:'domcontentloaded'});
  await dataResponse;
  assert(dataFetched,'Data must load while the game module is held');moduleGate.release();
  await ready();assert.equal(await p.locator('#labPartyMake').count(),0,'Cards must not wait for sharing UI');
  shareGate.release();await p.locator('#labPartyMake').waitFor({state:'attached'});
  assert.equal(shareImageRequests,0,'PNG module must remain unloaded');
  await p.unroute('**/lab/game.js*');await p.unroute('**/share-tools.js*');
  check('Episode data loads alongside game code; cards do not wait for sharing UI or PNG code');

  const imageGate=gate();
  await p.route('**/img/ep/31.jpg',async r=>{await imageGate.promise;await r.continue().catch(()=>{});});
  await p.goto(base+'/lab.html?eps=31,22,23',{waitUntil:'domcontentloaded'});
  await p.locator('#labLoading').waitFor();
  await p.waitForFunction(()=>[...document.querySelectorAll('#labCards img')].filter(i=>i.complete&&i.naturalWidth).length===2);
  assert.equal(await p.locator('#labCards').getAttribute('aria-busy'),'true');
  assert.equal(await p.locator('#labCards .lab-choose:disabled').count(),3);
  assert(await p.locator('#labCards .lab-art').first().isHidden());
  await p.locator('.lab-choose').first().evaluate(e=>e.click());
  assert.equal(await p.locator('.is-inspected').count(),0);
  await p.screenshot({path:path.join(out,'loading-mobile.png')});
  imageGate.release();await ready();
  assert.equal(await p.locator('#labCards').getAttribute('aria-busy'),'false');
  assert(await p.locator('#labLoading').isHidden());
  assert(await p.locator('#labCards img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)));
  assert.equal(await p.locator('#labCards .lab-choose:enabled').count(),3);
  await p.screenshot({path:path.join(out,'ready-mobile.png')});
  await p.unroute('**/img/ep/31.jpg');
  check('A slow third image keeps all three cartridges hidden and inert, then reveals complete artwork together');

  await p.addInitScript(()=>{
   if (!location.search.includes('decode-test')) return;
   const decode=HTMLImageElement.prototype.decode;
   window.__releaseDecode=null;
   HTMLImageElement.prototype.decode=async function(){await decode.call(this);if(this.src.endsWith('/31.jpg'))await new Promise(r=>window.__releaseDecode=r);};
  });
  await p.goto(base+'/lab.html?eps=31,22,23&decode-test=1',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.__releaseDecode==='function');
  assert(await p.locator('#labLoading').isVisible());
  assert(await p.locator('#labCards img').evaluateAll(es=>es.every(e=>e.complete)));
  await p.evaluate(()=>window.__releaseDecode());await ready();
  check('Downloaded artwork is still withheld until decoding completes');

  const stale=gate();
  await p.route('**/img/ep/31.jpg',async r=>{await stale.promise;await r.continue().catch(()=>{});});
  await p.goto(base+'/lab.html?eps=31,22,23',{waitUntil:'domcontentloaded'});
  await p.locator('#labLoading').waitFor();
  await p.evaluate(()=>Math.random=()=>0);
  await p.locator('#labShuffle').click();await ready();const current=await ids();
  assert(current.every(n=>![31,22,23].includes(n)));
  stale.release();await p.waitForTimeout(150);
  assert.deepEqual(await ids(),current);assert(await p.locator('#labLoading').isHidden());
  await p.unroute('**/img/ep/31.jpg');
  check('Reroll cancels pending preparation; a late old response cannot restore the old round');

  await p.route('**/img/ep/31.jpg',r=>r.abort());
  await p.goto(base+'/lab.html?eps=31,22,23');await ready();
  assert((await p.locator('#labCards img').first().getAttribute('src')).endsWith('artwork_320.jpg'));
  await p.route('**/img/artwork_320.jpg',r=>r.abort());
  await p.goto(base+'/lab.html?eps=31,22,23');await ready();
  assert((await p.locator('#labCards img').first().getAttribute('src')).startsWith('data:image/svg+xml'));
  await p.unroute('**/img/ep/31.jpg');await p.unroute('**/img/artwork_320.jpg');
  check('Failed artwork falls back; a failed fallback still produces a usable round');

  const timeout=gate();
  await p.route('**/img/ep/31.jpg',async r=>{await timeout.promise;await r.continue().catch(()=>{});});
  await p.goto(base+'/lab.html?eps=31,22,23',{waitUntil:'domcontentloaded'});await ready();
  assert((await p.locator('#labCards img').first().getAttribute('src')).endsWith('artwork_320.jpg'));
  timeout.release();await p.unroute('**/img/ep/31.jpg');
  check('A stalled image reaches the fallback within the preparation timeout');

  const leaving=gate();
  await p.route('**/img/ep/31.jpg',async r=>{await leaving.promise;await r.continue().catch(()=>{});});
  await p.goto(base+'/lab.html?eps=31,22,23',{waitUntil:'domcontentloaded'});await p.locator('#labLoading').waitFor();
  await p.locator('.site-header .brand').click();await p.locator('.hero').waitFor();
  leaving.release();await p.waitForTimeout(150);assert.equal(await p.locator('#episodeLab').count(),0);
  await p.unroute('**/img/ep/31.jpg');
  check('Leaving during preparation cancels it without touching the next page');

  await p.goto(base+'/lab.html?eps=128,127,126');await ready();
  await p.evaluate(()=>{localStorage.setItem('takitsubo:episode-lab:collection:v1',JSON.stringify(Array.from({length:120},(_,i)=>i+1)));localStorage.setItem('takitsubo:episode-lab:party:v1','[1,2,3,4,5,6]');});
  await p.reload();await ready();
  assert.equal(await p.locator('#labDexGrid>*').count(),0,'Closed dex must be deferred');
  await p.evaluate(()=>{window.__cards=[...document.querySelectorAll('#labCards .lab-card')];window.__party=[...document.querySelectorAll('#labPartyGrid>*')];});
  await p.locator('.lab-choose').first().click();await p.locator('#labRegister').click();
  assert.equal(await p.locator('#labDexGrid>*').count(),0);
  assert(await p.evaluate(()=>[...window.__cards,...window.__party].every(e=>e.isConnected)));
  await p.locator('#labDexToggle').click();assert.equal(await p.locator('#labDexGrid>*').count(),128);
  await p.evaluate(()=>window.__dex=[...document.querySelectorAll('#labDexGrid>*')]);
  await p.locator('#labDexOrder').selectOption('asc');
  assert(await p.evaluate(()=>window.__dex.every(e=>e.isConnected)),'Sort must reuse tiles');
  await p.locator('[data-close="labDex"]').click();
  await p.locator('.lab-choose').nth(1).click();await p.locator('#labRegister').click();
  assert(await p.evaluate(()=>window.__dex.every(e=>e.isConnected)),'Register must not rebuild closed dex');
  await p.locator('#labDexToggle').click();
  assert.equal(await p.evaluate(()=>window.__dex.filter(e=>!e.isConnected).length),1,'Only newly discovered tile should be replaced');
  await p.locator('[data-close="labDex"]').click();
  await p.locator('#labShuffle').click();await ready();
  assert(await p.evaluate(()=>window.__party.every(e=>e.isConnected)),'Reroll must preserve unchanged party');
  assert.equal(shareImageRequests,0);await p.locator('#labPartyMake').click();await p.locator('#labPartySharePreview').waitFor();
  assert(shareImageRequests>0);check('Closed dex is deferred; sorting and registration reuse tiles; unchanged party and cards survive; PNG code loads on demand');
  assert.deepEqual(errors,[]);
 } finally {fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
