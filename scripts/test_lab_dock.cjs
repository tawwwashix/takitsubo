const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
(async()=>{
 const b=await chromium.launch({channel:'chrome'}),ctx=await b.newContext(),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.locator('.lab-choose').first().waitFor();
 await ctx.addInitScript(()=>{if(!localStorage.getItem('takitsubo:episode-lab:collection:v1'))localStorage.setItem('takitsubo:episode-lab:collection:v1','[71,93]');});
 try {
  for(const width of [320,390,660,1280]) {
   await p.setViewportSize({width,height:900});await p.goto(base+'/lab.html?eps=71,93,107');await ready();await p.evaluate(()=>document.fonts.ready);
   const before=await p.locator('#labShuffle').evaluate(e=>e.getBoundingClientRect().top+scrollY);
   assert(await p.locator('#labConfirm').isHidden());assert(await p.locator('#labSaveActions').evaluate(e=>e.inert));
   let anchor=null;
   for(let i=0;i<3;i++) {
    await p.locator('.lab-choose').nth(i).click();await p.waitForTimeout(350);
    const layout=await p.evaluate(()=>{
     const r=id=>document.getElementById(id).getBoundingClientRect();const dock=r('labSaveActions'),cards=r('labCards'),open=r('labOpen'),shuffle=r('labShuffle'),tags=r('labInspectTags'),number=r('labInspectNumber');
     const hit=id=>{const e=document.getElementById(id),a=r(id);return e.contains(document.elementFromPoint(a.x+a.width/2,a.y+a.height/2));};
     return {x:dock.x,y:dock.y+scrollY,width:dock.width,center:cards.x+cards.width/2,below:open.top-dock.bottom,navGap:shuffle.left-open.right,tagAligned:Math.abs(tags.top-number.top)<6,hit:hit('labConfirm')&&hit('labRegister')};
    });
    assert(Math.abs(layout.x+layout.width/2-layout.center)<1);assert(layout.below>60);assert(layout.navGap>=20);assert(layout.tagAligned&&layout.hit);
    if(anchor)assert(Math.abs(layout.y-anchor.y)<1&&Math.abs(layout.x-anchor.x)<1);anchor=layout;
    assert(Math.abs(await p.locator('#labShuffle').evaluate(e=>e.getBoundingClientRect().top+scrollY)-before)<1);
   }
   assert.equal(await p.locator('#labSaveActions').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.equal(await p.locator('.lab-card-badge:visible').count(),2);
   const badges=await p.locator('.lab-card-badge:visible').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect(),a=e.parentElement.getBoundingClientRect(),dock=document.querySelector('#labSaveActions').getBoundingClientRect();return {text:e.textContent,aboveDock:b.bottom<dock.top,nearTop:b.top<a.top+a.height*.3,left:b.left,right:b.right};}));
   assert(badges.every(b=>b.text==='✓ 登録済み'&&b.aboveDock&&b.nearTop&&b.left>=0&&b.right<=width));
   assert(badges[0].right<badges[1].left);
   await p.screenshot({path:`.local-preview/badges-${width}.png`,fullPage:true});
   await p.locator('#labShuffle').click();assert(await p.locator('#labConfirm').isHidden());
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  console.log('PASS fixed central registration dock, hidden/inert initial state, separated navigation, metadata alignment');

  // Test the production animation at fully visible, partially visible and offscreen endpoints.
  const cases=await p.evaluate(async()=>{
   const u=new URL(document.querySelector('#episodeLab').dataset.module,location.href);u.pathname=u.pathname.replace('game.js','transfer.js');
   const {installTransfer}=await import(u),root=document.createElement('div');document.body.append(root);
   const t=installTransfer(root,{listen(){},onDispose(){}},()=>document.createElement('span'),()=>true),results=[];
   for(const [name,top] of [['visible',200],['bottom-partial',innerHeight-20],['below',innerHeight+20],['top-partial',-20],['above',-150]]) {
    const dest=document.createElement('div');root.append(dest);dest.getBoundingClientRect=()=>({top,bottom:top+90,left:100,right:180,width:80,height:90});
    t.fly({}, {left:100,top:100,width:120,height:140},dest);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const a=root.querySelector('.lab-transfer').getAnimations()[0];a.pause();
    const frames=a.effect.getKeyframes(),duration=a.effect.getTiming().duration;
    results.push({name,duration,ys:frames.map(f=>new DOMMatrix(f.transform).m42),times:frames.map(f=>f.offset*duration)});
    t.cancel();dest.remove();
   }
   root.remove();return results;
  });
  for(const c of cases) {
   const visible=['visible','bottom-partial','top-partial'].includes(c.name);
   assert.equal(c.duration,visible?1300:420);
   if(visible){assert.equal(Math.round(c.times[2]-c.times[1]),600);assert.equal(Math.round(c.ys[1]-c.ys[2]),7);assert.equal(Math.round(c.ys[3]-c.ys[2]),21);}
   if(['bottom-partial','below'].includes(c.name))assert(c.ys.at(-1)>0,JSON.stringify(c));
   if(c.name==='above')assert(c.ys.at(-1)<0);
  }
  console.log('PASS 600ms anticipation, fast insertion, all viewport edge directions',cases.map(c=>[c.name,c.duration]));

  await p.evaluate(()=>{localStorage.setItem('takitsubo:episode-lab:party:v1','[107,59,108,60,105,109]');localStorage.setItem('takitsubo:episode-lab:collection:v1','[71,107,59,108,60,105,109]');});
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/lab.html?eps=71,93,12');await ready();await p.evaluate(()=>document.fonts.ready);
  await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();
  // Place the receiving slot across the viewport bottom while the modal is open.
  await p.evaluate(()=>{let r=document.querySelector('#labPartyGrid .lab-art').getBoundingClientRect();scrollTo(0,scrollY+r.top-innerHeight+20);document.querySelector('#labReplaceGrid [data-number="107"]').click();});
  await p.waitForFunction(()=>document.querySelector('.lab-transfer'));
  const arrival=await p.evaluate(()=>{let f=document.querySelector('.lab-transfer'),a=f.getAnimations()[0];a.pause();let y=parseFloat(f.style.top)+new DOMMatrix(a.effect.getKeyframes().at(-1).transform).m42;return {y,h:innerHeight,party:JSON.parse(localStorage.getItem('takitsubo:episode-lab:party:v1'))};});
  assert(arrival.y>0);assert.equal(arrival.party[0],71);
  await p.evaluate(()=>document.querySelector('.lab-transfer').getAnimations()[0].finish());await p.waitForFunction(()=>!document.querySelector('.lab-transfer'));
  await p.locator('#labPartyGrid [data-number="71"]').click();
  assert(await p.locator('#labItemTags').evaluate(e=>{const r=e.getBoundingClientRect(),title=document.querySelector('.lab-modal-top').getBoundingClientRect(),art=document.querySelector('#labItemArt').getBoundingClientRect();return r.bottom<=art.top&&r.top>=e.previousElementSibling.getBoundingClientRect().bottom;}));
  await p.screenshot({path:'.local-preview/dock-item.png',fullPage:true});await p.keyboard.press('Escape');
  for(const width of [390,660,1280]) {
   await p.setViewportSize({width,height:1000});await p.locator('#labPartyGrid').scrollIntoViewIfNeeded();
   const size=await p.locator('#labPartyGrid .lab-art').first().evaluate(e=>({width:e.getBoundingClientRect().width,cell:e.parentElement.getBoundingClientRect().width}));
   assert(size.width>=Math.min(150,size.cell*.78));
   await p.screenshot({path:`.local-preview/dock-party-${width}.png`,fullPage:true});
  }
  await p.goto(base+'/lab.html?party=107,59,108');await p.locator('#labSharedGrid a').first().waitFor();
  assert.equal(await p.locator('#labSharedHeading').textContent(),'シェアされた手持ちエピソード');
  assert.equal(await p.locator('#labShared .lab-footnote').textContent(),'選択すると詳細ページに移動します');
  assert.deepEqual(errors,[]);console.log('PASS actual full-party replacement at bottom edge, modal tags, responsive cartridge sizes and shared wording');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
