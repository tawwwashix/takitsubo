const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.locator('.lab-choose').first().waitFor();
 const preview=()=>p.waitForFunction(()=>{const img=document.querySelector('#labSharePreview');return !img.hidden&&img.complete&&img.naturalWidth===1200;});
 const heading=()=>p.locator('.page-title').evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.color];});
 try {
  await p.goto(base+'/lab.html?eps=50,54,47');await ready();
  assert(await p.locator('.site-header').isVisible());assert(await p.locator('.site-footer').isVisible());
  assert.equal(await p.locator('h1').count(),1);assert.equal(await p.locator('.page-title .en').textContent(),'EPISODE LAB');
  assert.equal(await p.locator('.lab-exit,.lab-heading').count(),0);const labHeading=await heading();
  await p.locator('.nav-toggle').click();assert(await p.locator('#siteNav').isVisible());await p.locator('.nav-toggle').click();
  assert(await p.locator('#labMake').isVisible());assert.equal(await p.locator('#labCopy').count(),0);assert(await p.locator('#labSave').isHidden());assert(await p.locator('#labX').isHidden());
  assert(await p.locator('#labShare').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('.lab-case'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  assert.equal(new URL(new URL(await p.locator('#labX').getAttribute('href')).searchParams.get('url')).searchParams.get('eps'),'50,54,47');
  await p.screenshot({path:path.join(out,'site-lab-collapsed-mobile.png'),fullPage:true});
  await p.locator('#labMake').click();await preview();assert(await p.locator('#labSave').isVisible());assert(await p.locator('#labMake').isHidden());
  let old=await p.locator('#labSharePreview').getAttribute('src');
  await p.locator('.lab-choose').nth(1).click();await p.locator('#labConfirm').click();await preview();
  assert.notEqual(await p.locator('#labSharePreview').getAttribute('src'),old);
  await p.locator('.lab-choose').nth(2).click();assert.equal(new URL(p.url()).searchParams.get('pick'),'54');
  const downloadEvent=p.waitForEvent('download');await p.locator('#labSave').click();const download=await downloadEvent;
  assert(download.suggestedFilename().includes('pick-54'));await download.saveAs(path.join(out,'site-lab-share.png'));
  await p.locator('#labCopyImage').click();await p.waitForFunction(()=>document.querySelector('#labShareStatus').textContent.includes('コピーした'));
  for(const width of [320,390,768,1280]) {
   await p.setViewportSize({width,height:900});await p.locator('#labShare').scrollIntoViewIfNeeded();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const layout=await p.locator('#labSave').evaluate(b=>{
    const img=document.querySelector('#labSharePreview').getBoundingClientRect(),r=b.getBoundingClientRect();
    const s=getComputedStyle(b),row=getComputedStyle(b.parentElement),x=getComputedStyle(document.querySelector('#labX'));
    return {below:r.top>=img.bottom,radius:s.borderRadius,center:row.justifyContent,xBackground:x.backgroundColor,font:s.fontSize};
   });
   assert(layout.below);assert.equal(layout.radius,'999px');assert.equal(layout.center,'center');assert.equal(layout.xBackground,'rgb(16, 20, 25)');assert.equal(layout.font,'14px');
   if(width===390 || width===1280) { await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:path.join(out,`site-lab-expanded-${width}.png`),fullPage:true}); }
  }
  await p.locator('#labShuffle').click();assert(await p.locator('#labMake').isVisible());assert(await p.locator('#labSharePreview').isHidden());assert(await p.locator('#labSave').isHidden());
  // Cancel generation with a new round before the asynchronous image work completes.
  await p.evaluate(()=>{document.querySelector('#labMake').click();document.querySelector('#labShuffle').click();});
  await p.waitForTimeout(400);assert(await p.locator('#labSharePreview').isHidden());assert(await p.locator('#labSave').isHidden());
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/shindan.html');
  assert.deepEqual(await heading(),labHeading);
  await p.locator('#shName').fill('たわし');await p.locator('#shForm button').click();
  await p.locator('#shSharePreview').waitFor();assert.equal(await p.locator('#shShare details').count(),0);assert(await p.locator('#shMake').isHidden());
  assert.equal(await p.locator('#shSharePreview').evaluate(e=>e.naturalWidth),1080);
  const layout=await p.locator('#shSave').evaluate(b=>({below:b.getBoundingClientRect().top>=document.querySelector('#shSharePreview').getBoundingClientRect().bottom,center:getComputedStyle(b.parentElement).justifyContent}));assert(layout.below);assert.equal(layout.center,'center');
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:path.join(out,'site-diagnosis-result-mobile.png'),fullPage:true});
  const d=p.waitForEvent('download');await p.locator('#shSave').click();await(await d).saveAs(path.join(out,'site-diagnosis-result.png'));
  await p.locator('#shCopyImage').click();await p.waitForFunction(()=>document.querySelector('#shShareStatus').textContent.includes('コピーした'));
  assert.deepEqual(errors,[]);console.log('PASS site header/footer and title, mobile navigation, optional generation, automatic diagnosis image, old button style/alignment, generate/replace/reset/cancel, visible-image downloads and clipboard');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
