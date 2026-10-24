const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
(async()=>{
 const b=await chromium.launch({channel:'chrome'});
 try {
  for(const width of [1280,390]) {
   const c=await b.newContext({viewport:{width,height:900},hasTouch:true}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await c.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
   await c.addInitScript(()=>{localStorage.setItem('takitsubo:episode-lab:party:v1','[1,2,3,4,5,6]');localStorage.setItem('takitsubo:episode-lab:collection:v1','[1,2,3,4,5,6,7]');});
   await p.goto(base+'/lab.html?eps=7,8,9');await p.locator('.lab-choose').first().waitFor();
   const open=id=>p.locator(id).evaluate(e=>e.open);
   const outside=()=>width===390?p.touchscreen.tap(2,450):p.mouse.click(2,450);
   const state=()=>p.evaluate(()=>[localStorage.getItem('takitsubo:episode-lab:party:v1'),localStorage.getItem('takitsubo:episode-lab:collection:v1')]);
   const initial=await state();
   await p.locator('#labPartyGrid [data-number="1"]').click();assert(await open('#labItem'));
   let r=await p.locator('#labItem').boundingBox();await p.mouse.click(r.x+8,r.y+r.height/2);assert(await open('#labItem'),'Inside padding must not dismiss');
   await p.mouse.move(r.x+8,r.y+r.height/2);await p.mouse.down();await p.mouse.move(2,450,{steps:8});await p.mouse.up();assert(await open('#labItem'),'Inside-to-outside drag must not dismiss');
   await p.mouse.move(2,450);await p.mouse.down();await p.mouse.move(2,520,{steps:8});await p.mouse.up();assert(await open('#labItem'),'Backdrop drag must not dismiss');
   await outside();assert(!(await open('#labItem')));assert.deepEqual(await state(),initial);
   await p.locator('#labDexToggle').click();assert(await open('#labDex'));
   await p.locator('#labDexGrid [data-number="7"]').click();assert(await open('#labItem'));
   await p.locator('#labItemAdd').click();assert(await open('#labReplace'));
   await outside();assert(!(await open('#labReplace')));assert(await open('#labItem'));assert(await open('#labDex'));assert.deepEqual(await state(),initial);
   await outside();assert(!(await open('#labItem')));assert(await open('#labDex'));assert.equal(await p.evaluate(()=>document.activeElement.dataset.number),'7');
   await p.locator('#labDexUnseen').check();await p.locator('#labDexGrid').hover();await p.mouse.wheel(0,400);assert(await open('#labDex'));
   await outside();assert(!(await open('#labDex')));assert.equal(await p.evaluate(()=>document.activeElement.id),'labDexToggle');
   await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();assert(await open('#labReplace'));await outside();assert(!(await open('#labReplace')));assert.deepEqual(await state(),initial);
   await p.locator('#labDexToggle').click();await p.keyboard.press('Escape');assert(!(await open('#labDex')));
   await p.locator('#labPartyGrid [data-number="1"]').click();await p.locator('[data-close="labItem"]').click();assert(!(await open('#labItem')));
   assert.deepEqual(errors,[]);console.log(`PASS ${width}: backdrop ${width===390?'tap':'click'}, nested dialogs/focus, padding and drags, scroll, unchanged collection/party on cancel, Escape and close button`);await c.close();
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
