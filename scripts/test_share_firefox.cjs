// Optional native Firefox verification through its built-in WebDriver BiDi.
// Dedicated profile only; no browser installation, driver or user-profile edits.
const {spawn} = require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv.find(arg=>/^https?:/.test(arg)) || 'http://localhost:8766';
const executable=process.env.TK_FIREFOX || 'C:/Program Files/Mozilla Firefox/firefox.exe';
const out=path.resolve(__dirname,'../.local-preview');
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const profile=fs.mkdtempSync(path.join(out,'firefox-clipboard-'));
  const proc=spawn(executable,['--headless','--no-remote','--profile',profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true});
  let ws;
  try {
    const endpoint=await new Promise((resolve,reject)=>{
      let log='';const timer=setTimeout(()=>reject(new Error('Firefox startup timeout: '+log)),20000);
      const output=data=>{log+=data;const m=log.match(/WebDriver BiDi listening on (ws:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]+'/session');}};
      proc.stdout.on('data',output);proc.stderr.on('data',output);
      proc.on('error',reject);proc.on('exit',code=>{clearTimeout(timer);reject(new Error('Firefox exit '+code+': '+log));});
    });
    ws=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let id=0;const waiting=new Map();
    ws.onmessage=event=>{
      const message=JSON.parse(event.data), pending=waiting.get(message.id);
      if(!pending) return;
      waiting.delete(message.id);clearTimeout(pending.timer);
      if(message.type==='error') pending.reject(new Error(JSON.stringify(message))); else pending.resolve(message.result);
    };
    const send=(method,params)=>new Promise((resolve,reject)=>{
      const key=++id,timer=setTimeout(()=>{waiting.delete(key);reject(new Error('BiDi timeout: '+method));},30000);
      waiting.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
    });
    const session=await send('session.new',{capabilities:{alwaysMatch:{acceptInsecureCerts:false}}});
    console.log('Firefox '+session.capabilities.browserVersion);
    const {context}=await send('browsingContext.create',{type:'tab'});
    const evaluate=async expression=>{
      const result=await send('script.evaluate',{expression,target:{context},awaitPromise:true});
      if(result.type!=='success') throw new Error(JSON.stringify(result));
      return result.result.value;
    };
    const wait=async expression=>evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>{if(${expression})resolve(true);else if(Date.now()-start>15000)reject(new Error('Condition timeout'));else setTimeout(tick,50);};tick();})`);
    const click=async selector=>{
      const point=JSON.parse(await evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const r=e.getBoundingClientRect();return JSON.stringify({x:Math.floor(r.left+r.width/2),y:Math.floor(r.top+r.height/2)});})()`));
      await send('input.performActions',{context,actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',origin:'viewport',...point},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
    };
    await send('script.addPreloadScript',{functionDeclaration:`()=>{try{localStorage.setItem('takitsubo:episode-lab:party:v1','[92,127,99]');localStorage.setItem('takitsubo:episode-lab:collection:v1','[92,127,99]');}catch(_){}}`});
    for(const kind of ['lab','diagnosis']) {
      const prefix=kind==='lab'?'labParty':'sh';
      await send('browsingContext.navigate',{context,url:base+(kind==='lab'?'/lab.html':'/shindan.html'),wait:'complete'});
      assert.equal(await evaluate('isSecureContext'),true);
      if(kind==='lab') { await wait("document.querySelector('#labPartyMake')"); await click('#labPartyMake'); }
      else { await wait("document.querySelector('#shName')");await evaluate("document.querySelector('#shName').value='たわし'");await click('#shForm button'); }
      await wait(`document.querySelector('#${prefix}ImageActions') && !document.querySelector('#${prefix}ImageActions').hidden`);
      await click('#'+prefix+'CopyImage');
      await wait(`document.querySelector('#${prefix}CopyImage').textContent==='✅ コピーしました！' || document.querySelector('#${prefix}ShareStatus').textContent`);
      const feedback=await evaluate(`JSON.stringify({button:document.querySelector('#${prefix}CopyImage').textContent,status:document.querySelector('#${prefix}ShareStatus').textContent})`);
      assert.equal(JSON.parse(feedback).button,'✅ コピーしました！',feedback);
      const shot=await send('browsingContext.captureScreenshot',{context});
      fs.writeFileSync(path.join(out,`share-firefox-${kind}.png`),Buffer.from(shot.data,'base64'));
      console.log('PASS '+kind+': native Firefox click copies PNG and restores success button');
    }
    // The caller may optionally pass the real LAN preview to confirm the user's
    // reported restriction; this reads capabilities only, without copying data.
    const lan=process.argv.find(arg=>/^--lan=/.test(arg));
    if(lan) {
      await send('browsingContext.navigate',{context,url:lan.slice(6),wait:'complete'});
      const state=JSON.parse(await evaluate('JSON.stringify({secure:isSecureContext,clipboard:!!navigator.clipboard,item:!!window.ClipboardItem})'));
      assert.deepEqual(state,{secure:false,clipboard:false,item:false});
      console.log('PASS native Firefox LAN HTTP has no image Clipboard API');
    }
    await send('session.end',{});
  } finally { ws?.close();proc.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
