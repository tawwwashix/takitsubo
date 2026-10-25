const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
const keys={party:'takitsubo:episode-lab:party:v1',collection:'takitsubo:episode-lab:collection:v1'};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 try {
  for(const mobile of [false,true]) {
   const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile});
   await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
   await ctx.addInitScript(({keys})=>{if(!localStorage.getItem(keys.party)){localStorage.setItem(keys.collection,'[1,2,3,4,5,6]');localStorage.setItem(keys.party,'[1,2,3,4,5,6]');}},{keys});
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base+'/lab.html?eps=31,22,23');await p.locator('.lab-choose').first().waitFor();
   const order=()=>p.locator('#labPartyGrid .lab-owned').evaluateAll(es=>es.map(e=>Number(e.dataset.number)));
   const stored=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),keys.party);
   for(const width of mobile?[320,390]:[768,1280]) {
    await p.setViewportSize({width,height:900});await p.reload();await p.locator('.lab-choose').first().waitFor();await p.evaluate(()=>document.fonts.ready);
    const initial=await p.locator('#labInspection').boundingBox();
    for(let i=0;i<3;i++) {
     await p.locator('.lab-choose').nth(i).click();await p.waitForTimeout(350);
     const rect=await p.locator('#labInspection').boundingBox();assert(Math.abs(rect.height-initial.height)<1,'Details change height');
     const confirm=await p.locator('#labOpen').boundingBox(),shuffle=await p.locator('#labShuffle').boundingBox();assert(confirm.x+confirm.width+20<=shuffle.x);assert(confirm.height>=44&&shuffle.height>=44);
     assert.equal(await p.locator('.lab-card-title,#labResult,#labAddParty').count(),0);
     assert(!(await p.locator('#episodeLab').innerText()).includes('どんな話か、出会ってみよう'));
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await p.screenshot({path:path.join(out,`lab-simple-${width}.png`),fullPage:true});
   }
   await p.locator('#labReorder').click();
   await p.locator('#labPartyGrid').scrollIntoViewIfNeeded();await p.waitForTimeout(200);
   const center=async n=>{const r=await p.locator(`#labPartyGrid [data-number="${n}"] .lab-art`).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
   let a=await center(1),b=await center(2);
   const cdp=mobile?await ctx.newCDPSession(p):null;
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(pt=>({...pt,id:1}))});
   if(mobile) {await touch('touchStart',[a]);await p.waitForTimeout(400);await touch('touchMove',[b]);await touch('touchEnd',[]);}
   else {await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:10});await p.mouse.up();}
   await p.waitForFunction(()=>document.querySelector('#labPartyGrid .lab-owned').dataset.number==='2');
   assert.deepEqual(await order(),[2,1,3,4,5,6]);assert.deepEqual(await stored(),await order());assert(!(await p.locator('#labItem').isVisible()));
   await p.locator('#labReorder').click();
   a=await center(1);const outside={x:5,y:a.y};
   if(mobile){await touch('touchStart',[a]);await p.waitForTimeout(400);await touch('touchMove',[outside]);await touch('touchEnd',[]);}
   else {await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(outside.x,outside.y,{steps:5});await p.mouse.up();}
   assert.deepEqual(await stored(),[2,1,3,4,5,6]);assert.equal(await p.locator('.lab-drag-ghost').count(),0);
   await p.waitForTimeout(550);
   if(mobile) {
    a=await center(3);const before=await p.evaluate(()=>scrollY);
    await touch('touchStart',[a]);await touch('touchMove',[{x:a.x,y:a.y-65}]);await touch('touchMove',[{x:a.x,y:a.y-120}]);await touch('touchEnd',[]);await p.waitForTimeout(350);
    assert.notEqual(await p.evaluate(()=>scrollY),before,'Quick swipe should scroll');assert.deepEqual(await stored(),[2,1,3,4,5,6]);
    await p.locator('#labPartyGrid [data-number="1"]').tap();
   } else await p.locator('#labPartyGrid [data-number="1"]').click();
   assert(await p.locator('#labItem').isVisible());
   assert.equal(await p.locator('#labItemMove,#labPositions').count(),0);await p.keyboard.press('Escape');
   await p.locator('#labReorder').click();await p.locator('#labPartyGrid [data-number="1"]').focus();await p.keyboard.press('Enter');await p.locator('#labPartyGrid [data-number="3"]').focus();await p.keyboard.press('Enter');assert.deepEqual(await stored(),[2,3,1,4,5,6]);
   await p.keyboard.press('Escape');await p.reload();await p.locator('.lab-choose').first().waitFor();assert.deepEqual(await order(),[2,3,1,4,5,6]);
   await ctx.close();console.log('PASS stable details, separated navigation, '+(mobile?'long-press touch drag / scroll / tap':'mouse drag')+', outside cancel, keyboard alternative, saved order');
  }
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
