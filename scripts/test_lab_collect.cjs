const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
const keys={party:'takitsubo:episode-lab:party:v1',collection:'takitsubo:episode-lab:collection:v1'};
(async()=>{
 const b=await chromium.launch({channel:'chrome'}),ctx=await b.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.locator('.lab-choose').first().waitFor();
 const state=()=>p.evaluate(keys=>Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,JSON.parse(localStorage.getItem(v)||'[]')])),keys);
 const preview=()=>p.waitForFunction(()=>{const e=document.querySelector('#labPartySharePreview');return !e.hidden&&e.complete&&e.naturalWidth===1200;});
 try {
  await p.goto(base+'/lab.html?eps=31,22,23');await ready();
  await p.evaluate(keys=>{for(const key of Object.values(keys))localStorage.setItem(key,'[1,2,3,4,5,6]');},keys);await p.reload();await ready();
  assert.equal(await p.locator('.lab-doctor img').getAttribute('src'),'assets/img/hyuuma.webp');assert.equal(await p.locator('.lab-doctor img').evaluate(e=>getComputedStyle(e).transform),'matrix(-1, 0, 0, 1, 0, 0)');
  assert.equal(await p.locator('.lab-pedestal,#labItemMove').count(),0);assert.equal(await p.locator('#labDexHeading').textContent(),'エピソード図鑑');
  assert.deepEqual(await p.locator('#labDexOrder option').allTextContents(),['新しい順','古い順']);
  for(const width of [320,390,768,1280]) {
   await p.setViewportSize({width,height:900});
   for(let i=0;i<3;i++) {
    await p.locator('.lab-choose').nth(i).click();await p.waitForTimeout(400);
    const shadows=await p.locator('.lab-shadow').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().bottom));assert(shadows[i]>Math.max(...shadows.filter((_,j)=>j!==i))+20);
    assert(await p.locator('#labInspectNumber').textContent().then(t=>t.startsWith('#')));
   }
   await p.screenshot({path:path.join(out,`lab-depth-${width}.png`),fullPage:true});
  }
  await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();assert(await p.locator('#labReplace').isVisible());
  assert(!(await state()).collection.includes(31));await p.keyboard.press('Escape');assert(!(await state()).collection.includes(31));assert(!new URL(p.url()).searchParams.has('pick'));
  await p.locator('#labOpen').click();await p.waitForURL('**/episodes/31.html');assert(!(await state()).collection.includes(31));await p.goBack();await ready();
  await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();await p.locator('#labSendDex').click();
  assert((await state()).collection.includes(31));assert.deepEqual((await state()).party,[1,2,3,4,5,6]);assert.equal(new URL(p.url()).searchParams.get('pick'),'31');
  await p.locator('.lab-choose').nth(1).click();await p.locator('#labConfirm').click();await p.locator('#labReplaceGrid [data-number="1"]').click();
  assert.deepEqual((await state()).party,[22,2,3,4,5,6]);assert((await state()).collection.includes(1));assert((await state()).collection.includes(22));assert(await p.locator('#labConfirm').isDisabled());
  // A second tab frees a slot while the full-party dialog is open.
  await p.locator('.lab-choose').nth(2).click();await p.locator('#labConfirm').click();
  const q=await ctx.newPage();await q.goto(base+'/lab.html');await q.locator('.lab-choose').first().waitFor();await q.evaluate(k=>localStorage.setItem(k,'[22,2,3,4,5]'),keys.party);await p.bringToFront();
  await p.getByRole('button',{name:'空き枠に加える',exact:true}).click();assert.deepEqual((await state()).party,[22,2,3,4,5,23]);await q.close();
  await p.locator('#labPartyMake').click();await preview();assert.equal(await p.locator('#labPartySharePreview').getAttribute('alt'),'手持ちエピソードのシェア画像');assert.equal(await p.locator('#labPartySharePreview').evaluate(e=>e.naturalHeight),1100);
  let old=await p.locator('#labPartySharePreview').getAttribute('src');await p.locator('#labReorder').click();await p.locator('#labPartyGrid [data-number="22"]').click();await p.locator('#labPartyGrid [data-number="2"]').click();assert(await p.locator('#labPartySharePreview').isHidden());assert(await p.locator('#labPartySave').isHidden());assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),null);await p.locator('#labPartyMake').click();await preview();
  assert.notEqual(await p.locator('#labPartySharePreview').getAttribute('src'),old);assert.deepEqual((await state()).party,[2,22,3,4,5,23]);await p.locator('#labReorder').click();
  const download=p.waitForEvent('download');await p.locator('#labPartySave').click();const d=await download;assert(d.suggestedFilename().includes('party-2-22-3-4-5-23'));await d.saveAs(path.join(out,'lab-party-share.png'));
  await p.locator('#labPartyCopyImage').click();await p.waitForFunction(()=>document.querySelector('#labPartyShareStatus').textContent.includes('コピーした'));
  assert.equal(await p.locator('#labPartyCopy').count(),0);
  await p.locator('#labDexToggle').click();
  for(const width of [390,1280]) {
   await p.setViewportSize({width,height:900});await p.locator('#labDexUnseen').uncheck();
   const positions=await p.locator('#labDexGrid .lab-owned').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,art:e.querySelector('.lab-art').getBoundingClientRect().top,height:e.getBoundingClientRect().height})));
   assert(positions.every(e=>Math.abs(e.art-e.top)<1));assert(Math.max(...positions.map(e=>e.height))-Math.min(...positions.map(e=>e.height))<1);
   await p.screenshot({path:path.join(out,`lab-dex-aligned-${width}.png`)});
  }
  await p.keyboard.press('Escape');
  // Emptying the party hides and resets its optional image; refilling starts collapsed.
  for(const n of [2,22,3,4,5,23]) {await p.locator(`#labPartyGrid [data-number="${n}"]`).click();await p.locator('#labItemRemove').click();await p.keyboard.press('Escape');}
  assert(await p.locator('#labPartyShare').isHidden());assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),null);
  await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();assert(await p.locator('#labPartyMake').isVisible());await p.locator('#labPartyMake').click();await preview();
  const single=p.waitForEvent('download');await p.locator('#labPartySave').click();await(await single).saveAs(path.join(out,'lab-party-share-one.png'));
  assert.deepEqual(errors,[]);console.log('PASS depth/shadows, mirrored host, number labels, cancel/no discovery, listen independently, dex-only/full-party replacement, concurrent free slot, separate party PNG/clipboard/reorder invalidation, aligned dex, empty/refill');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
