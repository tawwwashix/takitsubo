const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
const keys={party:'takitsubo:episode-lab:party:v1',collection:'takitsubo:episode-lab:collection:v1',dex:'takitsubo:episode-lab:dex:v1'};
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true}),ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 const ready=page=>page.locator('.lab-choose').first().waitFor();
 const party=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),keys.party);
 const choose=async i=>{await p.locator('.lab-choose').nth(i).tap();await p.locator('#labConfirm').tap();};
 try {
  await p.goto(base+'/lab.html?eps=50,54,47');await ready(p);
  assert.equal(await p.locator('#labPartyGrid .lab-empty-slot').count(),6);
  await p.locator('#labDexToggle').tap();
  assert.equal(await p.locator('.lab-undiscovered').count(),128);assert.equal(await p.locator('.lab-undiscovered img').count(),0);
  assert.equal(await p.locator('#labDexGrid>*').first().getAttribute('data-number'),'128');
  await p.locator('#labDexOrder').selectOption('asc');assert.equal(await p.locator('#labDexGrid>*').first().getAttribute('data-number'),'1');
  await p.locator('#labDexUnseen').uncheck();assert.equal(await p.locator('.lab-undiscovered').count(),0);
  await p.keyboard.press('Escape');
  await choose(0);assert.deepEqual(await party(),[]);await p.locator('#labAddParty').tap();assert.deepEqual(await party(),[50]);assert(await p.locator('#labAddParty').isDisabled());
  await choose(1);await p.locator('#labAddParty').tap();await choose(2);await p.locator('#labAddParty').tap();
  await p.goto(base+'/lab.html?eps=1,5,28');await ready(p);
  for(let i=0;i<3;i++){await choose(i);await p.locator('#labAddParty').tap();}
  assert.deepEqual(await party(),[50,54,47,1,5,28]);
  await p.goto(base+'/lab.html?eps=7,8,9');await ready(p);await choose(0);await p.locator('#labAddParty').tap();
  assert(await p.locator('#labReplace').isVisible());await p.keyboard.press('Escape');assert.deepEqual(await party(),[50,54,47,1,5,28]);
  await p.locator('#labAddParty').tap();await p.locator('#labReplaceGrid [data-number="50"]').tap();assert.deepEqual(await party(),[7,54,47,1,5,28]);
  assert(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).includes(50),keys.collection));
  await p.locator('#labPartyGrid [data-number="54"]').tap();await p.locator('#labItemRemove').tap();assert.deepEqual(await party(),[7,47,1,5,28]);
  assert(await p.locator('#labItemAdd').isEnabled());await p.locator('#labItemAdd').tap();assert.deepEqual(await party(),[7,47,1,5,28,54]);
  await p.locator('#labItemSet').tap();assert.equal(await p.locator('.is-selected').getAttribute('data-number'),'54');
  assert(new URL(p.url()).searchParams.get('eps').split(',').includes('54'));assert.equal(new URL(p.url()).searchParams.get('pick'),'54');
  await p.locator('#labDexToggle').tap();assert.equal(await p.locator('#labDexOrder').inputValue(),'asc');assert(!(await p.locator('#labDexUnseen').isChecked()));
  assert.equal(await p.locator('#labDexGrid .lab-owned').count(),7);
  await p.locator('#labDexGrid [data-number="50"]').tap();assert.equal(await p.locator('#labItemLink').getAttribute('href'),'episodes/50.html');
  await p.locator('#labItemAdd').tap();await p.locator('#labReplaceGrid [data-number="7"]').tap();assert.deepEqual(await party(),[50,47,1,5,28,54]);
  await p.keyboard.press('Escape');assert(await p.locator('#labDex').isVisible());
  await p.locator('#labDexOrder').selectOption('desc');await p.locator('#labDexUnseen').check();
  await p.screenshot({path:path.join(out,'lab-dex-silhouettes.png')});await p.keyboard.press('Escape');
  for(const width of [320,390,768,1280]) {
   await p.setViewportSize({width,height:900});await p.locator('.lab-case').scrollIntoViewIfNeeded();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await p.locator('#labPartyGrid .lab-owned').count(),6);
   const columns=await p.locator('#labPartyGrid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,width<=760?3:6);
   await p.screenshot({path:path.join(out,`lab-party-${width}.png`),fullPage:true});
  }
  await p.reload();await ready(p);assert.equal(await p.locator('#labPartyGrid .lab-owned').count(),6);
  const q=await ctx.newPage();await q.goto(base+'/lab.html?eps=7,8,9');await ready(q);
  await q.locator('#labPartyGrid [data-number="50"]').click();await q.locator('#labItemRemove').click();
  await p.waitForFunction(()=>document.querySelectorAll('#labPartyGrid .lab-owned').length===5);await q.close();
  const blocked=await b.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('blocked writes');};});
  const f=await blocked.newPage();f.on('pageerror',e=>errors.push(e.message));await f.goto(base+'/lab.html?eps=1,5,28');await ready(f);
  for(let i=0;i<3;i++){await f.locator('.lab-choose').nth(i).click();await f.locator('#labConfirm').click();await f.locator('#labAddParty').click();}
  assert.equal(await f.locator('#labPartyGrid .lab-owned').count(),3);assert((await f.locator('#labPartyStatus').textContent()).includes('保存'));await blocked.close();
  const invalid=await b.newContext();await invalid.addInitScript(({keys})=>{
   localStorage.setItem(keys.collection,'[1,2,3,4,5,6,7,8,9]');
   localStorage.setItem(keys.party,'[2,2,"3",false,9,999999,1,3,4,5,6,7]');
  },{keys});
  const v=await invalid.newPage();await v.goto(base+'/lab.html');await ready(v);
  assert.deepEqual(await v.locator('#labPartyGrid .lab-owned').evaluateAll(es=>es.map(e=>Number(e.dataset.number))),[2,9,1,3,4,5]);await invalid.close();
  assert.deepEqual(errors,[]);console.log('PASS silhouettes/order/filter, explicit six-slot collection, duplicate prevention, replacement/cancel, remove/re-add, dex actions, set/share, persistence, other-tab changes, blocked/corrupt storage, responsive case');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
