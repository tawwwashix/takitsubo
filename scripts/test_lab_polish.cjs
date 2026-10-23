const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
(async()=>{
 const b=await chromium.launch({channel:'chrome'}),ctx=await b.newContext({permissions:['clipboard-read','clipboard-write']}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 await ctx.addInitScript(()=>{
  window.canvasLabels=[];const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.canvasLabels.push(String(text));return fill.call(this,text,...args);};
 });
 const ready=()=>p.locator('.lab-choose').first().waitFor();
 const intent=async id=>{const u=new URL(await p.locator(id).getAttribute('href'));return {text:u.searchParams.get('text'),url:new URL(u.searchParams.get('url'))};};
 const preview=prefix=>p.waitForFunction(prefix=>{const i=document.querySelector('#'+prefix+'SharePreview');return i&&!i.hidden&&i.complete&&i.naturalWidth===1200;},prefix);
 try {
  for(const width of [320,390,1280]) {
   await p.setViewportSize({width,height:900});await p.goto(base+'/lab.html?eps=31,22,23');await ready();
   assert((await p.locator('.page-head p').textContent()).includes('ランダムに並ぶ3本'));assert((await p.locator('.page-head p').textContent()).includes('遊び方はご自由に'));
   assert.equal(await p.locator('#labCopy,#labCopyFallback').count(),0);assert(!(await p.locator('#episodeLab').innerText()).includes('試作中のリンク'));
   for(const reroll of [false,true]) {
    if(reroll) {await p.locator('#labShuffle').click();await p.waitForTimeout(350);}
    await p.locator('.lab-scene').scrollIntoViewIfNeeded();
    const samples=await p.evaluate(async()=>{
     const grid=document.querySelector('#labCards'),width=()=>parseFloat(getComputedStyle(grid).gridTemplateColumns);
     const before=width();document.querySelector('.lab-choose').click();const start=width();
     const animations=grid.getAnimations().map(a=>a.transitionProperty);
     await new Promise(r=>setTimeout(r,100));const middle=width();await new Promise(r=>setTimeout(r,250));
     return{before,start,middle,end:width(),animations};
    });
    assert(samples.animations.includes('grid-template-columns'),'First selection must animate');
    assert(Math.abs(samples.start-samples.before)<2);assert(samples.middle>samples.before+2 && samples.middle<samples.end-2,JSON.stringify({width,reroll,...samples}));
   }
   await p.mouse.move(0,0);
   const color=await p.locator('#labConfirm').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(color,'rgb(185, 76, 67)');
   await p.locator('#labDexToggle').click();assert.equal(await p.locator('#labStorageNote').textContent(),'※このブラウザに保存されます');
   assert(await p.locator('#labStorageNote').evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('.lab-dex-controls').getBoundingClientRect().top));
   await p.keyboard.press('Escape');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(100);
   await p.screenshot({path:path.join(out,`lab-polish-${width}.png`),fullPage:true});
  }
  await p.goto(base+'/lab.html?eps=31,22,23');await ready();
  let share=await intent('#labX');assert.equal(share.url.origin,'https://game-takitsubo.com');assert.equal(share.url.pathname,'/lab.html');assert.equal(share.url.searchParams.get('eps'),'31,22,23');assert(!share.text.includes('私は'));
  await p.locator('.lab-choose').nth(1).click();await p.locator('#labConfirm').click();share=await intent('#labX');assert.equal(share.url.searchParams.get('pick'),'22');assert(share.text.includes('私は #22 を手持ちに！'));assert(share.text.includes('#ゲームの滝壺 #滝壺エピソード研究所'));
  await p.locator('#labMake').click();await preview('lab');
  assert.equal(await p.locator('#labShare .sh-note').textContent(),'画像を保存/コピーしてから、Xのポストに添付すると盛り上がります！');
  const d=p.waitForEvent('download');await p.locator('#labSave').click();await(await d).saveAs(path.join(out,'lab-polish-share.png'));
  await p.locator('#labPartyMake').click();await preview('labParty');
  const hand=await intent('#labPartyX');assert.equal(hand.url.href,'https://game-takitsubo.com/lab.html');assert(hand.text.includes('私の手持ちはこの1本！'));assert(hand.text.includes('#滝壺エピソード研究所'));
  const pd=p.waitForEvent('download');await p.locator('#labPartySave').click();await(await pd).saveAs(path.join(out,'lab-polish-party.png'));
  const labels=await p.evaluate(()=>window.canvasLabels);for(const text of ['ゲームの滝壺｜エピソード研究所','この3本、どれを聴く？','わたしの手持ちエピソード','#ゲームの滝壺 #滝壺エピソード研究所'])assert(labels.includes(text));
  assert.equal(new URL(p.url()).origin,new URL(base).origin,'Sharing must not change local history origin');
  await p.locator('#labPartyGrid [data-number="22"]').click();await p.locator('#labItemRemove').click();assert((await intent('#labX')).text.includes('私は #22 を選んだ！'));await p.keyboard.press('Escape');
  await p.goto(base+'/lab.html?eps=31,22,23&pick=31');await ready();assert((await intent('#labX')).text.includes('紹介した人は #31'));
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.lab-choose').first().click();assert.equal(await p.locator('#labCards').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  assert.deepEqual(errors,[]);console.log('PASS first/reroll interpolation, responsive intro, coral action, prominent storage note, canonical URLs and tags, accurate choice text, removed link controls, PNG labels/downloads, local history, reduced motion');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
