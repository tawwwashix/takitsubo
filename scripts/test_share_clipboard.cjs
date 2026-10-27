// Real PNG clipboard writes without pre-granting clipboard-write permission.
const {chromium} = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../.local-preview');
fs.mkdirSync(out, {recursive:true});

(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  const context = await browser.newContext();
  await context.route(/google-analytics\.com|googletagmanager\.com/, route => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('takitsubo:episode-lab:party:v1','[92,127,99]');
    localStorage.setItem('takitsubo:episode-lab:collection:v1','[92,127,99]');
    window.pngEncodings = 0;
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(...args) { pngEncodings++; return encode.apply(this,args); };
    if(window.ClipboardItem) {
      const Item = window.ClipboardItem;
      window.clipboardPayloads = [];
      window.ClipboardItem = new Proxy(Item, {construct(target,args) {
        clipboardPayloads.push(args[0]['image/png'] instanceof Blob);
        return Reflect.construct(target,args);
      }});
    }
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function prepare(kind, origin = base) {
    const prefix = kind === 'lab' ? 'labParty' : 'sh';
    await page.goto(origin + (kind === 'lab' ? '/lab.html' : '/shindan.html'));
    if(kind === 'lab') await page.locator('#labPartyMake').click();
    else { await page.locator('#shName').fill('たわし'); await page.locator('#shForm button').click(); }
    await page.locator('#'+prefix+'ImageActions').waitFor();
    return prefix;
  }
  async function messageBetween(prefix) {
    for(const width of [320,390,1280]) {
      await page.setViewportSize({width,height:900});
      const bounds = await page.evaluate(prefix => {
        const image=document.getElementById(prefix+'SharePreview').getBoundingClientRect();
        const status=document.getElementById(prefix+'ShareStatus').getBoundingClientRect();
        const actions=document.getElementById(prefix+'ImageActions').getBoundingClientRect();
        return {between:status.top>=image.bottom && status.bottom<=actions.top, overflow:document.documentElement.scrollWidth>innerWidth};
      },prefix);
      assert(bounds.between && !bounds.overflow,JSON.stringify(bounds));
    }
  }
  try {
    for(const kind of ['lab','diagnosis']) {
      const prefix = await prepare(kind);
      const copy=page.locator('#'+prefix+'CopyImage');
      const encodings=await page.evaluate(()=>pngEncodings);
      await copy.click();
      await page.waitForFunction(prefix=>document.getElementById(prefix+'CopyImage').textContent==='✅ コピーしました！',prefix);
      assert.equal(await page.locator('#'+prefix+'ShareStatus').textContent(),'');
      assert.equal(await page.evaluate(()=>pngEncodings),encodings,'Copy re-encoded the displayed PNG');
      assert.deepEqual(await page.evaluate(()=>clipboardPayloads),[true]);
      await page.locator('#'+prefix+'ImageActions').screenshot({path:path.join(out,`share-copy-${kind}-success.png`)});
      // Read permission is granted only after the write has already succeeded.
      await context.grantPermissions(['clipboard-read']);
      assert(await page.evaluate(async prefix=>{
        const item=(await navigator.clipboard.read()).find(item=>item.types.includes('image/png'));
        if(!item) return false;
        const actual=await createImageBitmap(await item.getType('image/png'));
        const expected=await createImageBitmap(await (await fetch(document.getElementById(prefix+'SharePreview').src)).blob());
        function pixels(image) { const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data; }
        const a=pixels(actual),b=pixels(expected);
        const equal=actual.width===expected.width && actual.height===expected.height && a.length===b.length && a.every((value,i)=>value===b[i]);
        actual.close();expected.close();return equal;
      },prefix),'Clipboard PNG must match the displayed image');
      await context.clearPermissions();
      await page.waitForFunction(prefix=>document.getElementById(prefix+'CopyImage').textContent==='📋 画像をコピー',prefix);

      // A real permission failure must not be displayed as success.
      await page.evaluate(()=>{navigator.clipboard.write=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));});
      await copy.click();
      await page.waitForFunction(prefix=>document.getElementById(prefix+'ShareStatus').textContent.includes('コピー許可'),prefix);
      assert.equal(await copy.textContent(),'📋 画像をコピー');
      await messageBetween(prefix);
      await page.locator('#'+prefix+'ImagePanel').screenshot({path:path.join(out,`share-copy-${kind}-failure.png`)});
      console.log('PASS '+kind+': real clipboard pixels, button feedback/reset, prepared Blob, denial and message placement');
    }
    // Route an HTTP hostname to the local preview: actual insecure context,
    // without changing browser security settings or needing a LAN server.
    const insecure = 'http://preview.test';
    await context.route(insecure+'/**', async route => {
      const url=new URL(route.request().url());
      await route.fulfill({response:await context.request.get(base+url.pathname+url.search)});
    });
    for(const kind of ['lab','diagnosis']) {
      const prefix=await prepare(kind,insecure);
      assert.equal(await page.evaluate(()=>isSecureContext),false);
      assert.equal(await page.evaluate(()=>!!navigator.clipboard),false);
      await page.locator('#'+prefix+'CopyImage').click();
      assert((await page.locator('#'+prefix+'ShareStatus').textContent()).includes('localhost'));
      await messageBetween(prefix);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS both pages: genuine insecure HTTP context, actionable explanation between image and controls');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
