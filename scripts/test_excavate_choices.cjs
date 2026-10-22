const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.argv[2] || 'http://127.0.0.1:8765';
const output = path.resolve(__dirname, '../.local-preview');
fs.mkdirSync(output, {recursive:true});
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:1100}});
  await context.route(/google-analytics\.com|googletagmanager\.com/, r=>r.abort());
  // Test-only fixed randomness makes the first spot contain a shell; no debug hook ships.
  await context.addInitScript(() => { Math.random = () => .123; });
  const p=await context.newPage(), errors=[], checks=[];
  p.on('pageerror',e=>errors.push(e.message));
  const check=s=>{checks.push(s);console.log('PASS '+s);};
  const percent=async()=>Number(await p.locator('.dig-progress').getAttribute('aria-valuenow'));
  const uncover=async()=>{for(let i=0;i<20 && await p.locator('#digLift').isDisabled();i++) await p.locator('#digBrush').click();assert(await p.locator('#digLift').isEnabled());};
  try {
    await p.goto(base+'/excavate.html');await p.locator('.dig-spot').first().waitFor();
    assert.equal(await p.locator('.dig-spot').count(),3);
    await p.locator('#digBrush').click();const first=await percent();
    await p.locator('.dig-spot').nth(1).click();assert((await percent())<first);
    await p.locator('#digBrush').click();await p.locator('#digBrush').click();const second=await percent();
    await p.locator('.dig-spot').nth(0).click();assert.equal(await percent(),first);
    await p.locator('.dig-spot').nth(1).click();assert.equal(await percent(),second);
    await p.setViewportSize({width:390,height:844});assert.equal(await percent(),second);
    await p.setViewportSize({width:1280,height:1100});
    check('Three independent spots retain sand across switching and resize');
    await p.locator('.dig-spot').nth(0).click();await p.locator('#digBonusEnabled').uncheck();
    await uncover();assert(await p.locator('#digEvent').isHidden());
    await p.locator('#digBonusEnabled').check();await p.locator('#digBrush').click();
    assert(await p.locator('#digEvent').isVisible());assert((await p.locator('#digEvent').textContent()).includes('貝殻'));
    await p.locator('.dig-wrap').screenshot({path:path.join(output,'excavate-choices.png')});
    check('Optional sand collapse reveals the souvenir during excavation');
    await p.locator('#digLift').click();const firstLink=await p.locator('#digLink').getAttribute('href');
    assert((await p.locator('#digBonusResult').textContent()).includes('貝殻'));
    assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('takitsubo:excavation:finds:v1'))),['shell']);
    await p.locator('#digNext').click();assert.equal(await percent(),second);
    await uncover();await p.locator('#digLift').click();const secondLink=await p.locator('#digLink').getAttribute('href');assert.notEqual(firstLink,secondLink);
    await p.locator('.dig-spot').nth(0).click();assert.equal(await p.locator('#digLink').getAttribute('href'),firstLink);assert(await p.locator('#digLift').isDisabled());
    assert.equal((await p.evaluate(()=>JSON.parse(localStorage.getItem('takitsubo:excavation:v1')))).length,2);
    check('Distinct episode choices, revisit collected result, no double collection');
    await p.locator('#digNext').click();await uncover();await p.locator('#digLift').click();
    assert((await p.locator('#digNext').textContent()).includes('別の砂浜'));
    await p.locator('#digNext').click();assert.equal(await p.locator('.dig-spot[aria-pressed=true]').count(),1);assert((await percent())<10);
    // Refresh indefinitely; no daily quota or timer.
    for(let i=0;i<8;i++) await p.locator('#digNewBeach').click();
    assert(await p.locator('#digBrush').isEnabled());check('All three collected and unlimited next beaches');
    await p.reload();await p.locator('#digBrush').waitFor();
    await p.locator('.dig-collection-toggle').click();assert.equal(await p.locator('.dig-entry').count(),3);
    assert.equal(await p.locator('.dig-souvenir.is-found').count(),1);
    check('Existing episode collection and separate souvenir shelf persist');
    await p.setViewportSize({width:390,height:844});
    await p.locator('.dig-wrap').screenshot({path:path.join(output,'excavate-choices-mobile.png')});
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);check('Mobile layout and zero JavaScript errors');
  } finally {
    fs.writeFileSync(path.join(output,'excavate-choices-report.json'),JSON.stringify({checks,errors},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
