const STORAGE = "takitsubo:excavation:v1";
const READY = 0.42;
const FINDS_STORAGE = "takitsubo:excavation:finds:v1";
const FINDS = [
  { id: "shell", name: "さくら色の貝殻", icon: "◒", color: "#cb8c80", note: "波に磨かれた、ちいさな扇。" },
  { id: "glass", name: "水色のシーグラス", icon: "◆", color: "#64aaa6", note: "光に透かすと、滝壺の色。" },
  { id: "stone", name: "しましまの小石", icon: "◉", color: "#8c9480", note: "水が描いた、ふしぎな模様。" },
  { id: "star", name: "星のかけら", icon: "✦", color: "#caa04c", note: "砂の中で、ひとつだけきらり。" }
];
function findIcon(item) {
  const paths = {
    shell: '<path d="M32 53 10 29C3 12 17 7 22 14 20 2 35 2 37 12 45 2 56 10 51 20 66 16 64 33 54 38Z"/><path d="m32 51-12-31m12 31-1-36m1 36 12-29m-12 29 20-17" fill="none" stroke="currentColor" stroke-width="2"/>',
    glass: '<path d="m18 12 25-5 14 22-9 25-29 4L7 35Z"/><path d="m21 17 18-3 8 11" fill="none" stroke="white" stroke-opacity=".65" stroke-width="4" stroke-linecap="round"/>',
    stone: '<path d="M8 35C5 12 43 1 55 22S56 55 35 57 11 52 8 35Z"/><path d="M10 28c15 12 29-9 44 3M13 40c14 11 31-6 43 1" fill="none" stroke="#eee9d4" stroke-width="5"/>',
    star: '<path d="m32 4 8 19 21 5-17 13 1 20-17-13L8 55l6-20L2 19l22 1Z"/><path d="m32 13-3 12-12-1" fill="none" stroke="#fff5bf" stroke-width="3" stroke-linecap="round"/>'
  };
  return `<svg viewBox="0 0 66 66" aria-hidden="true" style="color:${item.color};fill:${item.color};fill-opacity:.55;stroke:${item.color};stroke-width:1.5">${paths[item.id]}</svg>`;
}

export async function mount(root, page) {
  const response = await fetch(root.dataset.source, { signal: page.signal });
  if (!response.ok) throw new Error("Episode data unavailable");
  const data = await response.json();
  if (page.signal.aborted) return;
  const episodes = data.episodes.filter(e => Number.isInteger(e.number) && e.number > 0 && typeof e.title === "string");
  if (!episodes.length) throw new Error("No episodes");
  const valid = new Set(episodes.map(e => e.number));
  let found = new Set(), canSave = true;
  let finds = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "[]");
    if (Array.isArray(saved)) found = new Set(saved.filter(n => valid.has(n)));
    const souvenirs = JSON.parse(localStorage.getItem(FINDS_STORAGE) || "[]");
    if (Array.isArray(souvenirs)) finds = new Set(souvenirs.filter(id => FINDS.some(f => f.id === id)));
  } catch (_) { canSave = false; }
  root.innerHTML = `
    <div class="dig-wrap">
      <div class="dig-heading"><div><p class="dig-eyebrow">TAKITSUBO DISCOVERY <span>PROTOTYPE</span></p>
        <h1>滝壺発掘<span>砂の下の、まだ知らない一回。</span></h1><a href="lab.html" style="font-size:12px">新しい試作：博士のエピソード研究所へ →</a></div>
        <button class="dig-collection-toggle" type="button" aria-expanded="false" aria-controls="digCollection"><span>発掘図鑑</span><strong id="digCount"></strong></button>
      </div>
      <div class="dig-layout">
        <section class="dig-play" aria-label="砂浜の発掘場">
          <div class="dig-beach-heading"><div><strong>どこから掘ってみる？</strong><p>気になる色を少し覗いて、選んでみよう。</p></div><button id="digNewBeach" class="dig-secondary" type="button">別の砂浜へ →</button></div>
          <div class="dig-spots" id="digSpots" role="group" aria-label="発掘する場所を選ぶ"></div>
          <div class="dig-stage" id="digStage">
            <div class="dig-water" aria-hidden="true"></div>
            <span class="dig-location" aria-hidden="true">01 / 滝壺のほとり</span>
            <div class="dig-plate"><span id="digFallback">?</span><img id="digArtwork" alt="砂の下に埋まったアートワーク" draggable="false"></div>
            <canvas id="digSand" aria-label="砂を払う場所。クリック、タップ、またはなぞって発掘。キーボードでは下の砂を払うボタンを使用。"></canvas>
            <canvas id="digParticles" aria-hidden="true"></canvas>
            <div class="dig-pebble p1" aria-hidden="true"></div><div class="dig-pebble p2" aria-hidden="true"></div>
            <div class="dig-shell" aria-hidden="true">✳</div>
            <div class="dig-bonus-object" id="digBonusObject" hidden aria-hidden="true"></div>
            <div class="dig-event" id="digEvent" hidden role="status"></div>
            <div class="dig-stage-note" id="digStageNote">この角、何か埋まっていそう。</div>
          </div>
          <div class="dig-controls">
            <div class="dig-progress-copy"><span id="digHint" role="status">砂を払って、絵を見つけよう。</span><span id="digPercent" aria-hidden="true">0%</span></div>
            <div class="dig-progress" role="progressbar" aria-label="アートワークの露出" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
            <div class="dig-actions"><button id="digBrush" class="dig-secondary" type="button">砂をひと払い</button><button id="digLift" class="dig-primary" type="button" disabled>もう少し掘ってみよう</button></div>
            <p class="dig-help">クリック・タップ、またはなぞって払う。急がなくて大丈夫。</p>
            <label class="dig-experiment"><input type="checkbox" id="digBonusEnabled" checked> おまけの発見を楽しむ</label>
          </div>
        </section>
        <aside class="dig-find" aria-label="発見したエピソード">
          <p class="dig-eyebrow">YOUR DISCOVERY</p>
          <div id="digEmpty"><div class="dig-empty-icon" aria-hidden="true">▧</div><h2>気になる一枚は、どれ？</h2><p>上の3か所は、自由に行き来できる。<br>払った砂は、そのまま残るよ。</p><div class="dig-tip"><span>小さな発見のしかた</span><p>半分ほど見えたら取り出せる。<br>砂が崩れて、何か出てくることも。</p></div></div>
          <div id="digResult" hidden><span class="dig-new" id="digNew"></span><img id="digResultImage" alt=""><p class="dig-episode" id="digEpisode"></p><h2 id="digTitle"></h2><div id="digBonusResult" hidden></div><a class="dig-primary" id="digLink">このエピソードへ →</a><button class="dig-secondary" id="digNext" type="button">ほかの場所を掘る →</button></div>
          <p class="dig-save-note" id="digSaveNote">図鑑はこのブラウザに保存されるよ。</p>
        </aside>
      </div>
      <section class="dig-collection" id="digCollection" hidden><div class="dig-collection-heading"><h2>あなたの発掘図鑑</h2><p>出会ったアートワークを、ここに。</p></div><div id="digCollectionGrid"></div><h3 class="dig-shelf-title">砂浜のちいさな収穫 <span id="digFindCount"></span></h3><div id="digShelf"></div><p class="dig-footnote">保存はこの端末・ブラウザ内のみ。閲覧データを消すと図鑑もリセットされる。再生履歴は記録しない。</p></section>
    </div>`;
  const $ = s => root.querySelector(s);
  const stage = $("#digStage"), canvas = $("#digSand"), ctx = canvas.getContext("2d");
  const fx = $("#digParticles"), fctx = fx.getContext("2d");
  const mask = document.createElement("canvas"); mask.width = mask.height = 128;
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  const sand = document.createElement("canvas"), sctx = sand.getContext("2d");
  let width = 0, height = 0, size = 0, left = 0, top = 0;
  let current, previous = null, lifted = false, ready = false, coverage = 0;
  let spots = [], selected = 0, beach = 0;
  let pointer = null, last = null, particles = [], frame = 0, disposed = false;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const getFound = () => {
    // Merge another tab's discoveries rather than overwriting them.
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      if (Array.isArray(saved)) saved.forEach(n => { if (valid.has(n)) found.add(n); });
      const souvenirs = JSON.parse(localStorage.getItem(FINDS_STORAGE) || "[]");
      if (Array.isArray(souvenirs)) souvenirs.forEach(id => { if (FINDS.some(f => f.id === id)) finds.add(id); });
    } catch (_) { canSave = false; }
  };
  function collection() {
    $("#digCount").textContent = `${found.size} / ${episodes.length}`;
    const grid = $("#digCollectionGrid"); grid.replaceChildren();
    if (!found.size) { const p = document.createElement("p"); p.textContent = "最初の一枚を、砂浜から見つけよう。"; grid.append(p); }
    episodes.filter(e => found.has(e.number)).sort((a,b) => b.number-a.number).forEach(e => {
      const a = document.createElement("a"); a.href = `episodes/${e.number}.html`; a.className = "dig-entry";
      const img = document.createElement("img"); img.src = e.image || "assets/img/artwork_320.jpg"; img.alt = ""; img.loading = "lazy";
      img.onerror = () => { img.onerror = null; img.src = "assets/img/artwork_320.jpg"; };
      const text = document.createElement("span"); text.textContent = `第${e.number}回 ${e.title}`;
      a.append(img, text); grid.append(a);
    });
    if (!canSave) $("#digSaveNote").textContent = "保存を利用できないため、今回の画面内だけで図鑑を記録するよ。";
    $("#digFindCount").textContent = `${finds.size} / ${FINDS.length}`;
    const shelf = $("#digShelf"); shelf.replaceChildren();
    FINDS.forEach(item => {
      const card = document.createElement("div"); card.className = "dig-souvenir" + (finds.has(item.id) ? " is-found" : "");
      const icon = document.createElement("span"); if(finds.has(item.id)) icon.innerHTML=findIcon(item); else icon.textContent="?"; icon.style.color = finds.has(item.id) ? item.color : "#b4b9a8";
      const name = document.createElement("strong"); name.textContent = finds.has(item.id) ? item.name : "まだ砂の中";
      const note = document.createElement("p"); note.textContent = finds.has(item.id) ? item.note : "掘っていると、出会えるかも。";
      card.append(icon, name, note); shelf.append(card);
    });
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over"; ctx.drawImage(sand, 0, 0, width, height);
    ctx.globalCompositeOperation = "destination-out";
    if (lifted) ctx.clearRect(left-8, top-8, size+16, size+16);
    else ctx.drawImage(mask, left, top, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
  function resize() {
    const rect = stage.getBoundingClientRect(); width = rect.width; height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    [canvas, fx].forEach(c => { c.width = Math.round(width*dpr); c.height = Math.round(height*dpr); c.getContext("2d").setTransform(dpr,0,0,dpr,0,0); });
    size = Math.min(width * (width < 500 ? .66 : .49), height * .66);
    left = (width-size)/2; top = (height-size)/2 + height*.035;
    const plate = $(".dig-plate"); plate.style.cssText = `width:${size}px;height:${size}px;left:${left}px;top:${top}px`;
    sand.width = Math.ceil(width); sand.height = Math.ceil(height);
    const gradient = sctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f3e4c5"); gradient.addColorStop(.55, "#e8cc99"); gradient.addColorStop(1, "#d9b57e");
    sctx.fillStyle = gradient; sctx.fillRect(0,0,width,height);
    // A stable sand texture, generated only at layout changes, not every frame.
    let seed = 2199;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i=0; i<width*height/17; i++) {
      sctx.fillStyle = i%3 ? "rgba(101,70,30,.12)" : "rgba(255,253,229,.6)";
      const x=random()*width, y=random()*height, r=random()*1.35+.3;
      sctx.fillRect(x,y,r,r*.65);
    }
    // Shallow ridges suggest sand piled around the buried plate.
    sctx.strokeStyle="rgba(114,79,37,.11)"; sctx.lineWidth=7;
    sctx.beginPath(); sctx.roundRect(left-7,top-7,size+14,size+14,8); sctx.stroke();
    draw();
  }
  function updateProgress() {
    const pixels = mctx.getImageData(0,0,128,128).data; let total=0;
    for(let i=3;i<pixels.length;i+=4) total+=pixels[i]/255;
    coverage=total/(128*128); ready=coverage>=READY;
    const spot = spots[selected];
    if (spot) { spot.coverage = coverage; spot.mask.getContext("2d").clearRect(0,0,128,128); spot.mask.getContext("2d").drawImage(mask,0,0); }
    const percent=Math.round(coverage*100);
    $("#digPercent").textContent=`${percent}%`;
    $(".dig-progress i").style.width=`${percent}%`;
    $(".dig-progress").setAttribute("aria-valuenow", percent);
    $("#digLift").disabled=!ready || lifted;
    $("#digLift").textContent=lifted ? "発掘成功！" : ready ? "取り出す ↗" : "もう少し掘ってみよう";
    $("#digHint").textContent=lifted ? "アートワークを発見！図鑑に記録したよ。" : coverage>.18 && found.has(current.number) ? "見覚えのある一枚。図鑑に登録済みだよ。" : ready ? "もう取り出せる。続きを払ってもいいよ。" : "砂を払って、絵を見つけよう。";
    renderSpots();
  }
  function animate() {
    if(disposed) return;
    fctx.clearRect(0,0,width,height);
    particles=particles.filter(p => p.life>0);
    particles.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.vy+=.13; p.life-=.045;
      fctx.fillStyle=`rgba(173,124,61,${Math.max(0,p.life)*.75})`;
      fctx.fillRect(p.x,p.y,p.r,p.r*.7);
    });
    frame=particles.length ? requestAnimationFrame(animate) : 0;
  }
  function brush(x,y,from) {
    if(lifted) return;
    const mx=(x-left)/size*128, my=(y-top)/size*128;
    mctx.strokeStyle="#000"; mctx.fillStyle="#000"; mctx.lineWidth=32; mctx.lineCap="round";
    mctx.beginPath();
    if(from) { mctx.moveTo((from.x-left)/size*128,(from.y-top)/size*128); mctx.lineTo(mx,my); mctx.stroke(); }
    mctx.beginPath(); mctx.arc(mx,my,16,0,Math.PI*2); mctx.fill();
    // Small irregular scallops keep the brush edge from looking machine-cut.
    for(let i=0;i<7;i++) { const a=i*Math.PI*2/7; mctx.beginPath(); mctx.arc(mx+Math.cos(a)*14,my+Math.sin(a)*14,3+(i%3),0,Math.PI*2); mctx.fill(); }
    if(!reducedMotion) {
      for(let i=0;i<8;i++) particles.push({x,y,vx:(Math.random()-.5)*5+(from?(x-from.x)*.08:1),vy:-Math.random()*3-1,life:1,r:Math.random()*3+1});
      if(particles.length>180) particles=particles.slice(-180);
      if(!frame) frame=requestAnimationFrame(animate);
    }
    $("#digStageNote").hidden=true;
    draw(); updateProgress();
    const spot = spots[selected];
    if (spot && !spot.surprise && spot.bonus && coverage >= .22 && $("#digBonusEnabled").checked) {
      spot.surprise = true;
      // A small collapse uncovers more artwork immediately; no waiting or QTE.
      mctx.fillStyle = "#000"; mctx.beginPath(); mctx.ellipse(98,94,29,24,-.4,0,Math.PI*2); mctx.fill();
      draw(); updateProgress(); showBonus();
    }
  }
  function position(event) { const rect=stage.getBoundingClientRect(); return {x:event.clientX-rect.left,y:event.clientY-rect.top}; }
  canvas.addEventListener("pointerdown", e => {
    if(lifted || pointer!==null || (e.pointerType==="mouse" && e.button!==0)) return;
    e.preventDefault(); pointer=e.pointerId; canvas.setPointerCapture(pointer); last=position(e); brush(last.x,last.y);
  });
  canvas.addEventListener("pointermove", e => { if(e.pointerId!==pointer) return; const p=position(e); brush(p.x,p.y,last); last=p; });
  const release = () => { pointer=null; last=null; };
  ["pointerup","pointercancel","lostpointercapture"].forEach(type => canvas.addEventListener(type, release));
  page.listen(window,"blur",release);
  $("#digBrush").addEventListener("click", () => {
    if(lifted) return;
    // Always aim for covered sand; keyboard/tap-only play never gets stuck.
    const pixels=mctx.getImageData(0,0,128,128).data;
    let best={x:24,y:24}, alpha=256;
    for(let y=18;y<120;y+=24) for(let x=18;x<120;x+=24) {
      const a=pixels[(y*128+x)*4+3]; if(a<alpha) { alpha=a; best={x,y}; }
    }
    brush(left+best.x/128*size, top+best.y/128*size);
  });
  function renderSpots() {
    spots.forEach((spot,index) => {
      const button = $("#digSpots").children[index]; if (!button) return;
      button.setAttribute("aria-pressed", index===selected);
      const label = spot.lifted ? "発掘済み" : spot.coverage>.18 && found.has(spot.episode.number) ? "図鑑に登録済み" : spot.coverage>.08 ? `${Math.round(spot.coverage*100)}% 見えてきた` : "角がちらり";
      button.querySelector("span").textContent = `${["波打ち際", "流木のそば", "砂のくぼみ"][index]} · ${label}`;
      const pc=button.querySelector("canvas").getContext("2d");
      pc.clearRect(0,0,160,160);
      pc.fillStyle="#f6efdb";pc.fillRect(0,0,160,160);
      if(spot.image.complete && spot.image.naturalWidth) pc.drawImage(spot.image,8,8,144,144);
      if(!spot.lifted) {
        const cover=spot.cover, cc=cover.getContext("2d");cc.globalCompositeOperation="source-over";cc.clearRect(0,0,160,160);
        cc.fillStyle=["#e7cea3","#dec396","#ead9b5"][index];cc.fillRect(0,0,160,160);
        cc.fillStyle="#bba57e55";for(let n=0;n<100;n++) cc.fillRect((n*71)%160,(n*37)%160,1.5,1);
        cc.globalCompositeOperation="destination-out";cc.drawImage(spot.mask,8,8,144,144);
        cc.globalCompositeOperation="source-over";pc.drawImage(cover,0,0);
      }
    });
  }
  function showBonus() {
    const spot=spots[selected], item=spot.bonus;
    const visible=spot.surprise && !!item;
    $("#digBonusObject").hidden=!visible;
    $("#digEvent").hidden=!visible || lifted;
    if(visible) {
      $("#digBonusObject").innerHTML=findIcon(item);
      $("#digEvent").textContent=`砂がさらり。${item.name}も見つかった！`;
    }
  }
  function result() {
    const spot=spots[selected];
    $("#digEmpty").hidden=true;$("#digResult").hidden=false;
    $("#digNew").textContent=spot.isNew ? "NEW DISCOVERY / 初めての発見" : "WELCOME BACK / また会えた一枚";
    $("#digEpisode").textContent=`第${current.number}回 · ${current.date || ""}`;
    $("#digTitle").textContent=current.title;
    const img=$("#digResultImage");img.onerror=()=>{img.onerror=null;img.src="assets/img/artwork_320.jpg";};img.src=current.image || "assets/img/artwork_320.jpg";img.alt=current.title;
    $("#digLink").href=`episodes/${current.number}.html`;
    $("#digBonusResult").hidden=!spot.surprise;
    if(spot.surprise) $("#digBonusResult").textContent=`${spot.bonus.icon} ${spot.bonus.name}も、飾り棚へ。`;
    $("#digNext").textContent=spots.every(s=>s.lifted) ? "別の砂浜へ →" : "ほかの場所を掘る →";
  }
  function selectSpot(index) {
    selected=index; const spot=spots[index];current=spot.episode;
    lifted=spot.lifted;release();particles=[];fctx.clearRect(0,0,width,height);
    stage.classList.toggle("is-lifted",lifted);
    $("#digEmpty").hidden=lifted;$("#digResult").hidden=!lifted;
    $("#digBrush").disabled=lifted;
    $("#digStageNote").hidden=spot.coverage>.08 || lifted;
    $(".dig-location").textContent=`${String(beach).padStart(2,"0")} / ${["波打ち際", "流木のそば", "砂のくぼみ"][index]}`;
    const img=$("#digArtwork"); img.hidden=false; img.alt="砂の下に埋まったアートワーク";
    img.onerror=() => { img.hidden=true; };
    img.src=current.image || "assets/img/artwork_320.jpg";
    $("#digFallback").textContent=`#${current.number}`;
    mctx.clearRect(0,0,128,128);
    mctx.drawImage(spot.mask,0,0);
    draw();updateProgress();showBonus();if(lifted) result();
  }
  function choose() {
    getFound();beach++;
    const used=new Set(); if(previous!==null && episodes.length>3) used.add(previous);
    spots=[];
    const surpriseIndex=Math.floor(Math.random()*Math.min(3,episodes.length));
    for(let index=0;index<Math.min(3,episodes.length);index++) {
      const available=episodes.filter(e=>!used.has(e.number));
      const unseen=available.filter(e=>!found.has(e.number));
      const choices=unseen.length && Math.random()<.8 ? unseen : available;
      const episode=choices[Math.floor(Math.random()*choices.length)];used.add(episode.number);
      const savedMask=document.createElement("canvas");savedMask.width=savedMask.height=128;
      const mc=savedMask.getContext("2d");mc.fillStyle="#000";mc.beginPath();mc.arc(index===1?119:9,9,17,0,Math.PI*2);mc.fill();
      const cover=document.createElement("canvas");cover.width=cover.height=160;
      const img=new Image();img.onload=()=>{if(!disposed)renderSpots();};img.src=episode.image || "assets/img/artwork_320.jpg";
      spots.push({episode,mask:savedMask,cover,image:img,coverage:.04,lifted:false,surprise:false,bonus:index===surpriseIndex?FINDS[Math.floor(Math.random()*FINDS.length)]:null});
    }
    const buttons=$("#digSpots");buttons.replaceChildren();
    spots.forEach((spot,index)=>{
      const button=document.createElement("button");button.type="button";button.className="dig-spot";
      const preview=document.createElement("canvas");preview.width=preview.height=160;preview.setAttribute("aria-hidden","true");
      const label=document.createElement("span");button.append(preview,label);button.addEventListener("click",()=>selectSpot(index));buttons.append(button);
    });
    selectSpot(0);collection();
  }
  $("#digLift").addEventListener("click", () => {
    if(!ready || lifted) return;
    lifted=true; release(); getFound(); const isNew=!found.has(current.number); found.add(current.number);previous=current.number;
    const spot=spots[selected];spot.lifted=true;spot.isNew=isNew;
    if(spot.surprise) {finds.add(spot.bonus.id);try{localStorage.setItem(FINDS_STORAGE,JSON.stringify([...finds]));}catch(_){canSave=false;}}
    try { localStorage.setItem(STORAGE,JSON.stringify([...found])); } catch(_) { canSave=false; }
    stage.classList.add("is-lifted"); draw();
    $("#digBrush").disabled=true; $("#digLift").disabled=true; $("#digLift").textContent="発掘成功！";
    $("#digHint").textContent="アートワークを発見！図鑑に記録したよ。";
    $("#digArtwork").alt=current.title;
    collection();renderSpots();showBonus();result();
    $("#digLink").focus({preventScroll:true});
    if(matchMedia("(max-width: 760px)").matches) $(".dig-find").scrollIntoView({behavior:reducedMotion?"instant":"smooth",block:"nearest"});
  });
  $("#digNext").addEventListener("click", () => { const next=spots.findIndex(s=>!s.lifted);if(next<0)choose();else selectSpot(next); $("#digBrush").focus({preventScroll:true}); $("#digSpots").scrollIntoView({behavior:reducedMotion?"instant":"smooth",block:"start"}); });
  $("#digNewBeach").addEventListener("click",()=>choose());
  $(".dig-collection-toggle").addEventListener("click", () => {
    const panel=$("#digCollection"); panel.hidden=!panel.hidden;
    $(".dig-collection-toggle").setAttribute("aria-expanded",!panel.hidden);
    if(!panel.hidden) panel.scrollIntoView({behavior:reducedMotion?"instant":"smooth",block:"start"});
  });
  page.listen(window,"storage",e=>{ if(e.key===STORAGE || e.key===FINDS_STORAGE) {getFound();collection();renderSpots();} });
  const observer=new ResizeObserver(resize); observer.observe(stage);
  page.onDispose(()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame);particles=[];release();});
  resize(); choose();
}
