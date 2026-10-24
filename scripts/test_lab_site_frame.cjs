const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.locator('.lab-choose').first().waitFor();
 const preview=()=>p.waitForFunction(()=>{const img=document.querySelector('#labPartySharePreview');return !img.hidden&&img.complete&&img.naturalWidth===1200;});
 const heading=()=>p.locator('.page-title').evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.color];});
 try {
  await p.goto(base+'/lab.html?eps=50,54,47');await ready();
  assert(await p.locator('.site-header').isVisible());assert(await p.locator('.site-footer').isVisible());
  assert.equal(await p.locator('h1').count(),1);assert.equal(await p.locator('.page-title .en').textContent(),'EPISODE LAB');
  assert.equal(await p.locator('.lab-exit,.lab-heading').count(),0);const labHeading=await heading();
  await p.locator('.nav-toggle').click();assert(await p.locator('#siteNav').isVisible());await p.locator('.nav-toggle').click();
  await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();
  assert(await p.locator('#labPartyMake').isVisible());assert.equal(await p.locator('#labCopy').count(),0);assert(await p.locator('#labPartySave').isHidden());assert(await p.locator('#labPartyX').isHidden());
  assert.equal(await p.locator('#labShare').count(),0);
  assert(await p.locator('.lab-machine').evaluate(e=>e.nextElementSibling.classList.contains('lab-case')));
  assert.equal(new URL(new URL(await p.locator('#labPartyX').getAttribute('href')).searchParams.get('url')).href,'https://game-takitsubo.com/lab.html');
  await p.screenshot({path:path.join(out,'site-lab-collapsed-mobile.png'),fullPage:true});
  await p.locator('#labPartyMake').click();await preview();assert(await p.locator('#labPartySave').isVisible());assert(await p.locator('#labPartyMake').isHidden());
  let old=await p.locator('#labPartySharePreview').getAttribute('src');
  await p.locator('.lab-choose').nth(1).click();await p.locator('#labConfirm').click();assert(await p.locator('#labPartySharePreview').isHidden());assert(await p.locator('#labPartySave').isHidden());assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),null);await p.locator('#labPartyMake').click();await preview();
  assert.notEqual(await p.locator('#labPartySharePreview').getAttribute('src'),old);
  await p.locator('.lab-choose').nth(2).click();assert.equal(new URL(p.url()).searchParams.get('pick'),'54');
  const downloadEvent=p.waitForEvent('download');await p.locator('#labPartySave').click();const download=await downloadEvent;
  assert(download.suggestedFilename().includes('party-50-54'));await download.saveAs(path.join(out,'site-lab-share.png'));
  await p.locator('#labPartyCopyImage').click();await p.waitForFunction(()=>document.querySelector('#labPartyShareStatus').textContent.includes('コピーした'));
  for(const width of [320,390,768,1280]) {
   await p.setViewportSize({width,height:900});await p.locator('#labPartyShare').scrollIntoViewIfNeeded();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const layout=await p.locator('#labPartySave').evaluate(b=>{
    const img=document.querySelector('#labPartySharePreview').getBoundingClientRect(),r=b.getBoundingClientRect();
    const s=getComputedStyle(b),row=getComputedStyle(b.parentElement),x=getComputedStyle(document.querySelector('#labPartyX'));
    return {below:r.top>=img.bottom,radius:s.borderRadius,center:row.justifyContent,xBackground:x.backgroundColor,font:s.fontSize};
   });
   assert(layout.below);assert.equal(layout.radius,'999px');assert.equal(layout.center,'center');assert.equal(layout.xBackground,'rgb(16, 20, 25)');assert.equal(layout.font,'14px');
   if(width===390 || width===1280) { await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:path.join(out,`site-lab-expanded-${width}.png`),fullPage:true}); }
  }
  const partyImage=await p.locator('#labPartySharePreview').getAttribute('src');
  await p.locator('#labShuffle').click();assert(await p.locator('#labPartySharePreview').isVisible());assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),partyImage);
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/shindan.html');
  assert.deepEqual(await heading(),labHeading);
  await p.locator('#shName').fill('たわし');await p.locator('#shForm button').click();
  await p.locator('#shSharePreview').waitFor();assert.equal(await p.locator('#shShare details').count(),0);assert(await p.locator('#shMake').isHidden());
  assert.equal(await p.locator('#shSharePreview').evaluate(e=>e.naturalWidth),1080);
  const layout=await p.locator('#shSave').evaluate(b=>({below:b.getBoundingClientRect().top>=document.querySelector('#shSharePreview').getBoundingClientRect().bottom,center:getComputedStyle(b.parentElement).justifyContent}));assert(layout.below);assert.equal(layout.center,'center');
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:path.join(out,'site-diagnosis-result-mobile.png'),fullPage:true});
  const d=p.waitForEvent('download');await p.locator('#shSave').click();await(await d).saveAs(path.join(out,'site-diagnosis-result.png'));
  await p.locator('#shCopyImage').click();await p.waitForFunction(()=>document.querySelector('#shShareStatus').textContent.includes('コピーした'));
  assert.deepEqual(errors,[]);console.log('PASS site header/footer and title, mobile navigation, optional generation, automatic diagnosis image, old button style/alignment, party changes refresh images, rerolls preserve images, visible-image downloads and clipboard');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
