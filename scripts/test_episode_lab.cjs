const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const base=process.argv[2] || 'http://127.0.0.1:8766';
const out=path.resolve(__dirname,'../.local-preview');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,downloadsPath:out});const checks=[],errors=[];
 const context=await browser.newContext({viewport:{width:1280,height:1050},permissions:['clipboard-read','clipboard-write']});
 await context.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 const check=s=>{checks.push(s);console.log('PASS '+s);};
 const cards=page=>page.locator('.lab-card').evaluateAll(cs=>cs.map(c=>Number(c.dataset.number)));
 const ready=page=>page.locator('.lab-choose').first().waitFor();
 try{
  await p.goto(base+'/lab.html?eps=128,98,16');await ready(p);
  assert.deepEqual(await cards(p),[128,98,16]);assert.equal(await p.locator('.lab-art img').count(),3);
  assert.equal(await p.locator('#labCount').textContent(),'0 / 128');
  await p.screenshot({path:path.join(out,'lab-desktop.png'),fullPage:true});
  await p.locator('.lab-choose').nth(1).click();
  assert.equal(await p.evaluate(()=>localStorage.getItem('takitsubo:episode-lab:collection:v1')),null);
  await p.locator('#labConfirm').click();await p.waitForURL('**/episodes/98.html');await p.goBack();await ready(p);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('takitsubo:episode-lab:collection:v1'))),[98]);
  assert.equal(new URL(p.url()).searchParams.get('pick'),'98');
  assert.equal(await p.locator('.lab-choose:disabled').count(),0);
  check('Three ordered cartridges, inspect without saving, explicit confirmation, correct episode link and shared collection');
  await p.locator('#labCopy').click();const shared=await p.evaluate(()=>navigator.clipboard.readText());
  assert.equal(new URL(shared).searchParams.get('eps'),'128,98,16');assert.equal(new URL(shared).searchParams.get('pick'),'98');
  const recipient=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await recipient.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
  const q=await recipient.newPage();q.on('pageerror',e=>errors.push(e.message));
  await q.goto(shared);await ready(q);assert.deepEqual(await cards(q),[128,98,16]);
  assert.equal(await q.locator('.lab-sender').count(),1);assert.equal(await q.locator('#labCount').textContent(),'0 / 128');
  assert.equal(await q.locator('.lab-choose:enabled').count(),3);
  await q.screenshot({path:path.join(out,'lab-mobile.png'),fullPage:true});
  await q.locator('.lab-choose').nth(2).tap();await q.locator('#labConfirm').tap();await q.waitForURL('**/episodes/16.html');await q.goBack();await ready(q);
  assert.deepEqual(await q.evaluate(()=>JSON.parse(localStorage.getItem('takitsubo:episode-lab:collection:v1'))),[16]);
  assert.equal(new URL(q.url()).searchParams.get('pick'),'16');
  check('Recipient gets same trio and sender marker, with independent touch selection');
  await recipient.close();

  await p.locator('#labMake').click();await p.locator('#labSharePreview').waitFor();
  const downloadEvent=p.waitForEvent('download');await p.locator('#labSave').click();const download=await downloadEvent;
  await download.saveAs(path.join(out,'lab-share-selected.png'));
  const png=fs.readFileSync(path.join(out,'lab-share-selected.png'));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),800);
  assert(download.suggestedFilename().includes('128-98-16-pick-98'));

  check('1200x800 PNG download preserves trio/choice; direct save action');

  const old=await cards(p);await p.locator('#labShuffle').click();const fresh=await cards(p);
  assert.equal(new Set(fresh).size,3);assert(fresh.every(n=>!old.includes(n)));assert.equal(await p.locator('#labConfirm').getAttribute('aria-disabled'),'true');
  assert(!new URL(p.url()).searchParams.has('pick'));
  for(let i=0;i<8;i++)await p.locator('#labShuffle').click();assert.equal(await p.locator('.lab-choose:enabled').count(),3);
  check('Immediate unlimited rerolls, no duplicate candidates or stale selection');

  await p.locator('#labMake').click();await p.locator('#labSharePreview').waitFor();
  const blankDownload=p.waitForEvent('download');await p.locator('#labSave').click();await(await blankDownload).saveAs(path.join(out,'lab-share-unselected.png'));

  await p.goto(base+'/lab.html?eps=1,1,999999&pick=999999');await ready(p);
  assert(await p.locator('#labNotice').isVisible());assert.equal(new Set(await cards(p)).size,3);
  await p.goto(base+'/lab.html?eps=128,98,16&pick=999999');await ready(p);assert.deepEqual(await cards(p),[128,98,16]);assert.equal(await p.locator('.lab-sender').count(),0);
  check('Invalid duplicate/unknown IDs recover, invalid pick does not replace valid trio');
  await p.evaluate(()=>{window.originalAudio=document.querySelector('audio');window.labMarker=true;});
  await p.locator('.site-header .brand').click();await p.locator('.hero').waitFor();assert.equal(await p.locator('link[href*="/lab.css"]').count(),0);
  await p.goBack();await ready(p);assert(await p.evaluate(()=>window.labMarker&&window.originalAudio===document.querySelector('audio')));
  assert.equal(await p.locator('link[href*="/lab.css"]').count(),1);
  await p.locator('#labDexToggle').click();assert.equal(await p.locator('#labDexGrid .lab-owned').count(),1);
  check('Home/lab navigation retains collection, keeps audio element and cleans styles');
  for(const width of [320,390,768]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  check('No horizontal overflow at 320, 390 and 768 pixels');
  const fail=await browser.newContext();await fail.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
  await fail.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('disabled');};Storage.prototype.setItem=()=>{throw Error('disabled');};Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))}});});
  const f=await fail.newPage();f.on('pageerror',e=>errors.push(e.message));await f.route('**/assets/img/ep/*',r=>r.abort());
  await f.goto(base+'/lab.html?eps=128,98,16');await ready(f);await f.locator('.lab-choose').first().click();await f.locator('#labConfirm').click();await f.waitForURL('**/episodes/128.html');await f.goBack();await ready(f);assert(await f.locator('#labPartyStatus').isVisible());
  await f.locator('#labCopy').click();assert(await f.locator('#labCopyFallback').isVisible());
  await f.locator('#labMake').click();await f.locator('#labSharePreview').waitFor();const failedDownload=f.waitForEvent('download');await f.locator('#labSave').click();await failedDownload;await fail.close();
  check('Storage/image failures and denied clipboard retain selection, sharing fallback and PNG generation');
  await p.goto(base+'/episodes/122.html');await p.locator('.tkp-play').click();
  await p.waitForFunction(()=>document.querySelector('audio').currentTime>2,null,{timeout:60000});
  await p.evaluate(()=>{window.labAudio=document.querySelector('audio');window.labAudioTime=labAudio.currentTime;window.labAudioEvents=[];['pause','emptied','loadstart','error'].forEach(type=>labAudio.addEventListener(type,()=>labAudioEvents.push(type)));});
  await p.locator('.footer-nav a[href$="lab.html"]').click();await ready(p);
  await p.locator('.lab-choose').first().focus();await p.keyboard.press('Enter');await p.locator('#labConfirm').focus();await p.keyboard.press('Enter');await p.waitForURL('**/episodes/*.html');await p.goBack();await ready(p);
  await p.locator('#labShuffle').click();
  assert(await p.evaluate(()=>document.querySelector('audio')===labAudio&&!labAudio.paused&&labAudio.currentTime>labAudioTime&&!labAudioEvents.length));
  check('Keyboard selection and reroll preserve actual remote audio playback');
  assert.deepEqual(errors,[]);check('No JavaScript errors');
 }finally{fs.writeFileSync(path.join(out,'lab-report.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
