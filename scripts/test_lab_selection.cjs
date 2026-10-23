const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8766',out=path.resolve(__dirname,'../.local-preview');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await b.newContext({permissions:['clipboard-read','clipboard-write']}),p=await ctx.newPage(),errors=[];
 await ctx.route(/google-analytics\.com|googletagmanager\.com/,r=>r.abort());
 p.on('pageerror',e=>errors.push(e.message));
 try {
  await p.goto(base+'/lab.html?eps=50,54,47&pick=47');await p.locator('.lab-choose').first().waitFor();
  assert.equal(await p.locator('.is-selected,.is-inspected').count(),0);
  for(const w of [320,390,768,1280]) {
   await p.setViewportSize({width:w,height:900});
   for(let i=0;i<3;i++) {
    await p.locator('.lab-choose').nth(i).click();
    assert.equal(await p.locator('.lab-choose:enabled').count(),3);
    assert.equal(await p.locator('.is-inspected').getAttribute('data-number'),String([50,54,47][i]));
    await p.waitForTimeout(600);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const bounds=await p.locator('.lab-scene').evaluate(e=>{
     const r=e.getBoundingClientRect();return [...e.querySelectorAll('.lab-cart-front')].every(a=>{const q=a.getBoundingClientRect();return q.left>=r.left&&q.right<=r.right&&q.top>=r.top&&q.bottom<=r.bottom;});
    });assert(bounds,'Cartridge clipping '+w);
   }
   await p.screenshot({path:path.join(out,`lab-blue-${w}.png`),fullPage:true});
  }
  await p.locator('#labCopy').click();const shared=await p.evaluate(()=>navigator.clipboard.readText());
  assert.equal(new URL(shared).searchParams.get('eps'),'50,54,47');assert.equal(new URL(shared).searchParams.get('pick'),'47');
  await p.locator('#labMake').click();await p.locator('#labSharePreview').waitFor();
  const download=p.waitForEvent('download');await p.locator('#labSave').click();await(await download).saveAs(path.join(out,'lab-blue-share.png'));
  const png=fs.readFileSync(path.join(out,'lab-blue-share.png'));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),800);
  await p.locator('#labCopyImage').click();await p.waitForFunction(()=>document.querySelector('#labShareStatus').textContent.includes('コピーした'));
  const lines=await p.evaluate(async()=>{
   const {wrapLines}=await import(new URL(document.querySelector('#episodeLab').dataset.shareModule,location.href));
   const c=document.createElement('canvas').getContext('2d');c.font='bold 21px sans-serif';
   return ['ゲームの滝壺 2周年はじめました。クロノ・トリガー、ニーチェオートマタ、鉄腕アトム', 'タイトル「とても長いゲームタイトル」の紹介。', '😀😀😀。ゲーム！？「シリーズ」'].map(t=>({lines:wrapLines(c,t,160),widths:wrapLines(c,t,160).map(l=>c.measureText(l).width)}));
  });
  for(const x of lines){assert(x.lines.every(l=>! /^[、。！？）」』]/.test(l)));assert(x.widths.every(w=>w<=160));}
  await p.evaluate(()=>{window.marker=42;window.audio=document.querySelector('audio');});
  await p.locator('.site-header .brand').click();await p.locator('.hero').waitFor();await p.goBack();await p.locator('.lab-choose').first().waitFor();
  assert(await p.evaluate(()=>window.marker===42&&window.audio===document.querySelector('audio')));
  await p.goto(base+'/shindan.html');await p.locator('input').first().fill('たわし');await p.locator('#shForm button').click();
  await p.locator('#shSave').waitFor();const d=p.waitForEvent('download');await p.locator('#shSave').click();await(await d).saveAs(path.join(out,'diagnosis-share.png'));
  await p.locator('#shSharePreview').waitFor();
  await p.screenshot({path:path.join(out,'diagnosis-share-ui.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS selection, replacement, responsive bounds, PNG/clipboard, kinsoku, navigation/audio identity, diagnosis shared controls');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
