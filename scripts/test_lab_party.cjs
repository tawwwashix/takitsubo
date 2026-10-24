const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const keys={party:'takitsubo:episode-lab:party:v1',collection:'takitsubo:episode-lab:collection:v1'};
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true}),ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 const ready=page=>page.locator('.lab-choose').first().waitFor();
 const party=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),keys.party);
 const openDex=async n=>{await p.locator('#labDexToggle').tap();await p.locator(`#labDexGrid [data-number="${n}"]`).tap();};
 const closeDex=async()=>{for(const id of ['labItem','labDex'])if(await p.locator('#'+id).isVisible())await p.locator('[data-close="'+id+'"]').tap();};
 try {
  await p.goto(base+'/lab.html?eps=50,54,47');await ready(p);
  assert.equal(await p.locator('#labPartyGrid .lab-empty-slot').count(),6);
  await p.locator('#labDexToggle').tap();assert.equal(await p.locator('.lab-undiscovered').count(),128);assert.equal(await p.locator('.lab-undiscovered img').count(),0);
  assert.equal(await p.locator('#labDexGrid>*').first().getAttribute('data-number'),'128');
  await p.locator('#labDexOrder').selectOption('asc');assert.equal(await p.locator('#labDexGrid>*').first().getAttribute('data-number'),'1');
  await p.locator('#labDexUnseen').uncheck();assert.equal(await p.locator('.lab-undiscovered').count(),0);await p.keyboard.press('Escape');
  await p.locator('.lab-choose').first().tap();await p.locator('#labConfirm').tap();assert.deepEqual(await party(),[50]);
  await openDex(50);assert.deepEqual(await party(),[50]);assert(await p.locator('#labItemAdd').isDisabled());await closeDex();
  await p.evaluate(({keys})=>localStorage.setItem(keys.collection,'[50,54,47,1,5,28,7]'),{keys});await p.reload();await ready(p);
  for(const n of [54,47,1,5,28]) {await openDex(n);await p.locator('#labItemAdd').tap();await closeDex();}
  assert.deepEqual(await party(),[50,54,47,1,5,28]);
  await openDex(7);await p.locator('#labItemAdd').tap();assert(await p.locator('#labReplace').isVisible());await p.keyboard.press('Escape');assert.deepEqual(await party(),[50,54,47,1,5,28]);
  await p.locator('#labItemAdd').tap();await p.locator('#labReplaceGrid [data-number="50"]').tap();assert.deepEqual(await party(),[7,54,47,1,5,28]);await closeDex();
  assert(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).includes(50),keys.collection));
  await p.locator('#labPartyGrid [data-number="54"]').tap();await p.locator('#labItemRemove').tap();assert.deepEqual(await party(),[7,47,1,5,28]);
  await p.locator('#labItemAdd').tap();assert.deepEqual(await party(),[7,47,1,5,28,54]);if(await p.locator('#labItem').isVisible())await p.locator('[data-close="labItem"]').tap();
  assert.equal(await p.locator('#labItemSet').count(),0);assert(await p.locator('#labPartyStatus').isHidden());
  await openDex(50);assert.equal(await p.locator('#labItemLink').getAttribute('href'),'episodes/50.html');await p.locator('#labItemAdd').tap();await p.locator('#labReplaceGrid [data-number="7"]').tap();await closeDex();
  assert.deepEqual(await party(),[50,47,1,5,28,54]);
  await p.locator('#labDexToggle').tap();assert.equal(await p.locator('#labDexOrder').inputValue(),'asc');assert(!(await p.locator('#labDexUnseen').isChecked()));assert.equal(await p.locator('#labDexGrid .lab-owned').count(),7);
  for(const width of [320,390,768,1280]) {
   await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const mark=p.locator('#labDexGrid [data-number="50"] .lab-party-mark');await mark.scrollIntoViewIfNeeded();
   assert(await mark.evaluate(e=>{const r=e.getBoundingClientRect(),a=e.closest('button').querySelector('.lab-art').getBoundingClientRect();return r.top>=a.bottom && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  }
  await p.keyboard.press('Escape');await p.reload();await ready(p);assert.equal(await p.locator('#labPartyGrid .lab-owned').count(),6);
  const q=await ctx.newPage();await q.goto(base+'/lab.html');await ready(q);await q.locator('#labPartyGrid [data-number="50"]').click();await q.locator('#labItemRemove').click();await p.waitForFunction(()=>document.querySelectorAll('#labPartyGrid .lab-owned').length===5);await q.close();
  const blocked=await b.newContext();await blocked.addInitScript(({keys})=>{localStorage.setItem(keys.collection,'[1,5,28]');Storage.prototype.setItem=()=>{throw Error('blocked writes');};},{keys});
  const f=await blocked.newPage();f.on('pageerror',e=>errors.push(e.message));await f.goto(base+'/lab.html');await ready(f);await f.locator('#labDexToggle').click();await f.locator('#labDexGrid [data-number="1"]').click();await f.locator('#labItemAdd').click();
  assert.equal(await f.locator('#labPartyGrid .lab-owned').count(),1);assert((await f.locator('#labPartyStatus').textContent()).includes('保存'));await blocked.close();
  const invalid=await b.newContext();await invalid.addInitScript(({keys})=>{localStorage.setItem(keys.collection,'[1,2,3,4,5,6,7,8,9]');localStorage.setItem(keys.party,'[2,2,"3",false,9,999999,1,3,4,5,6,7]');},{keys});
  const v=await invalid.newPage();await v.goto(base+'/lab.html');await ready(v);assert.deepEqual(await v.locator('#labPartyGrid .lab-owned').evaluateAll(es=>es.map(e=>Number(e.dataset.number))),[2,9,1,3,4,5]);await invalid.close();
  assert.deepEqual(errors,[]);console.log('PASS direct decision/discovery, dex sorting/filter, six-slot add/replace/cancel/remove, visible held badges, persistence/other tabs, blocked and corrupt storage');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
