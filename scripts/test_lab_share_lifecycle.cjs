const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8766';
(async()=>{
 const b=await chromium.launch({channel:'chrome',downloadsPath:path.resolve(__dirname,'../.local-preview/downloads')}),c=await b.newContext({viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[];
 await c.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());p.on('pageerror',e=>errors.push(e.message));
 await c.addInitScript(()=>{
  if(localStorage.getItem('takitsubo:episode-lab:party:v1')===null){localStorage.setItem('takitsubo:episode-lab:party:v1','[1,2,3]');localStorage.setItem('takitsubo:episode-lab:collection:v1','[1,2,3]');}
  window.pngCount=0;window.imageLabels=[];window.headingWidth=null;window.underlineWidth=null;
  const blob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(...args){window.pngCount++;return blob.apply(this,args);};
  const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.imageLabels.push(text);if(text==='エピソード研究所')window.headingWidth=this.measureText('エピソード').width;return fill.call(this,text,...args);};
  const rect=CanvasRenderingContext2D.prototype.roundRect;CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,...args){if(x===190&&h===6)window.underlineWidth=w;return rect.call(this,x,y,w,h,...args);};
 });
 const count=()=>p.evaluate(()=>window.pngCount);
 const make=async()=>{await p.locator('#labPartyMake').click();await p.waitForFunction(()=>{const i=document.querySelector('#labPartySharePreview');return i&&!i.hidden&&i.complete&&i.naturalWidth===1200;});};
 const closed=async n=>{assert(await p.locator('#labPartyImagePanel').isHidden());assert(await p.locator('#labPartyMake').isVisible());assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),null);await p.waitForTimeout(250);assert.equal(await count(),n);};
 try {
  await p.goto(base+'/lab.html?eps=31,22,23');await p.locator('.lab-choose').first().waitFor();await closed(0);
  await make();assert.equal(await count(),1);
  const labels=await p.evaluate(()=>window.imageLabels);assert(labels.includes('手持ちエピソード'));assert(labels.includes('#ゲームの滝壺 #滝壺エピソード研究所'));assert(!labels.some(t=>t.includes('わたしの')||t.includes('game-takitsubo.com')||t.includes('ゲーム系ポッドキャスト')));
  assert(await p.evaluate(()=>headingWidth>0&&headingWidth===underlineWidth));
  await p.locator('.lab-choose').first().click();await p.locator('#labConfirm').click();await closed(1);await make();assert.equal(await count(),2);
  await p.locator('#labPartyGrid [data-number="1"]').click();await p.locator('#labItemRemove').click();await p.keyboard.press('Escape');await closed(2);await make();assert.equal(await count(),3);
  await p.locator('#labReorder').click();await p.locator('#labPartyGrid [data-number="2"]').click();await p.locator('#labPartyGrid [data-number="3"]').click();await p.locator('#labReorder').click();await closed(3);await make();assert.equal(await count(),4);
  const q=await c.newPage();await q.goto(base+'/lab.html');await q.evaluate(()=>localStorage.setItem('takitsubo:episode-lab:party:v1','[31,3,2]'));await p.bringToFront();await closed(4);await make();assert.equal(await count(),5);
  const image=await p.locator('#labPartySharePreview').getAttribute('src');await p.locator('.lab-choose').nth(1).click();await p.locator('#labRegister').click();await p.locator('#labShuffle').click();assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),image);assert.equal(await count(),5);
  const x=new URL(await p.locator('#labPartyX').getAttribute('href'));assert.equal(new URL(x.searchParams.get('url')).origin+new URL(x.searchParams.get('url')).pathname,'https://game-takitsubo.com/lab.html');assert(new URL(x.searchParams.get('url')).searchParams.has('party'));assert(x.searchParams.get('text').includes('#ゲームの滝壺 #滝壺エピソード研究所'));
  const download=p.waitForEvent('download');await p.locator('#labPartySave').click();await(await download).saveAs(path.resolve(__dirname,'../.local-preview/lab-share-minimal.png'));assert.equal(await count(),5);
  await q.evaluate(()=>localStorage.setItem('takitsubo:episode-lab:party:v1','[]'));await p.waitForFunction(()=>document.querySelector('#labPartyShare').hidden);assert.equal(await p.locator('#labPartySharePreview').getAttribute('src'),null);assert.equal(await count(),5);
  assert.deepEqual(errors,[]);console.log('PASS explicit-only PNG generation, add/remove/reorder/storage invalidation, unchanged-party reuse, concise image text and measured underline, hashtags and post URL, empty cleanup');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
