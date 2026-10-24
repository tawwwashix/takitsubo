// Carry the lab bundle version through every dependency to avoid stale child modules.
const {createCartridge, cartridgeTone, CASE_COLORS, FALLBACK} = await import(
  new URL("./cartridge.js" + new URL(import.meta.url).search, import.meta.url)
);

function imageFor(ep, signal) {
  return new Promise(resolve => {
    const img = new Image(); let done = false;
    const finish = value => { if(done) return; done=true;clearTimeout(timer);signal.removeEventListener("abort",abort);img.onload=img.onerror=null;resolve(value); };
    const abort = () => { img.src="";finish(null); };
    const timer = setTimeout(abort,6000);
    img.onload = () => finish(img); img.onerror = () => finish(null);
    signal.addEventListener("abort",abort,{once:true});
    if(signal.aborted) abort(); else img.src = ep.image || FALLBACK;
  });
}

export async function createPartyShareImage(episodes, signal, wrapLines) {
  await document.fonts.ready;
  const images = await Promise.all(episodes.map(e => imageFor(e, signal)));
  const logo = await imageFor({image:"assets/img/mainlogo.webp"}, signal);
  const shells = await Promise.all(episodes.map(ep => {
    const art = createCartridge(ep, true), svg = art.querySelector("svg");
    let source = new XMLSerializer().serializeToString(svg);
    CASE_COLORS[cartridgeTone(ep.number)].forEach((color,i) => {
      source = source.replaceAll(`var(${["--case-body","--case-light","--case-dark","--case-ink"][i]})`, color);
    });
    return imageFor({image:"data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)}, signal);
  }));
  if(signal.aborted) throw new DOMException("Disposed", "AbortError");
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1100;
  const height=canvas.height;
  const c = canvas.getContext("2d"), ink = "#254e70";
  const sky=c.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,"#2086d3");sky.addColorStop(160/height,"#69b1e5");sky.addColorStop(270/height,"#d7edff");sky.addColorStop(.75,"#dce8fb");sky.addColorStop(1,"#9ec7e5");
  c.fillStyle=sky;c.fillRect(0,0,1200,height);
  c.fillStyle="rgba(255,255,255,.1)";
  for(const x of [180,650,1080]) {c.beginPath();c.moveTo(x,0);c.lineTo(x+90,0);c.lineTo(x-100,height);c.lineTo(x-210,height);c.closePath();c.fill();}
  c.fillStyle="rgba(255,255,255,.36)";
  for(const [x,y,r] of [[27,240,8],[1168,280,10],[420,190,5],[805,570,6],[30,690,6],[1140,680,5],[1010,45,7]]) {c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  c.save();c.shadowColor="rgba(8,40,80,.3)";c.shadowBlur=14;c.shadowOffsetY=4;
  if(logo) c.drawImage(logo,30,14,138,138);
  c.fillStyle="#fff";c.font='900 44px "Noto Sans JP",sans-serif';c.fillText("エピソード研究所",190,79);
  const underlineWidth=c.measureText("エピソード").width;c.restore();
  c.fillStyle="#ee735c";c.beginPath();c.roundRect(190,94,underlineWidth,6,3);c.fill();
  c.fillStyle="#fff";c.font='bold 30px "Noto Sans JP",sans-serif';c.fillText("手持ちエピソード",190,140);
  {c.font='bold 24px "Noto Sans JP",sans-serif';c.textAlign="right";c.fillText(`${episodes.length} / 6`,1156,151);c.textAlign="left";}
  {
    c.save();c.strokeStyle="#aac8dc";c.lineWidth=2;c.setLineDash([9,7]);
    for(let i=episodes.length;i<6;i++) {
      const x=84+(i%3)*380,y=198+Math.floor(i/3)*440;
      c.beginPath();c.roundRect(x,y,240,280,10);c.stroke();
    }
    c.restore();
  }
  episodes.forEach((ep,i) => {
    const x=84+(i%3)*380, y=198+Math.floor(i/3)*440, w=240, h=w*7/6;
    c.fillStyle="#92b2cc"; c.fillRect(x+8,y+16,w,h-8);
    if(shells[i]) c.drawImage(shells[i],x,y,w,h);
    const ix=x+w*.0875, iy=y+h*.2357, iw=w*.825;
    c.fillStyle="#fff";c.fillRect(ix,iy,iw,iw);
    const img=images[i];
    if(img) { const scale=Math.min(iw/img.naturalWidth,iw/img.naturalHeight);c.drawImage(img,ix+(iw-img.naturalWidth*scale)/2,iy+(iw-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale); }
    c.fillStyle=ink;c.font='bold 19px "Noto Sans JP",sans-serif';c.fillText(`#${ep.number}`,x,y+h+37);
    c.font='bold 21px "Noto Sans JP",sans-serif';
    wrapLines(c,ep.title,320,2).forEach((line,j)=>c.fillText(line,x,y+h+73+j*30));

  });
  c.fillStyle=ink;c.fillRect(0,height-52,1200,52);c.fillStyle="#fff";c.font='bold 22px "Noto Sans JP",sans-serif';
  c.textAlign="center";c.fillText("#ゲームの滝壺 #滝壺エピソード研究所",600,height-18);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed")),"image/png"));
}
