// Touch starts as ordinary scrolling. Only a stationary long press arms a drag;
// a non-passive touchmove then owns that gesture without disabling page scrolling.
export function installPartyReorder(grid, swap, page) {
  let pending=null, timer=null, ghost=null, target=null, suppressUntil=0;
  const listen=(node,type,handler,options={})=>node.addEventListener(type,handler,{...options,signal:page.signal});
  function cancel() {
    clearTimeout(timer);timer=null;ghost?.remove();ghost=null;
    grid.querySelectorAll(".is-drag-source,.is-drop-target").forEach(el=>el.classList.remove("is-drag-source","is-drop-target"));
    pending=null;target=null;
  }
  function point(x,y) {
    if(!ghost) return;
    ghost.style.left=`${x-ghost.offsetWidth/2}px`;ghost.style.top=`${y-45}px`;
    const over=document.elementFromPoint(x,y)?.closest("#labPartyGrid button[data-number]");
    target=over && over!==pending.button ? over : null;
    grid.querySelectorAll(".lab-owned").forEach(el=>el.classList.toggle("is-drop-target",el===target));
  }
  function start() {
    if(!pending || !pending.button.isConnected) { cancel();return; }
    ghost=document.createElement("div");ghost.className="lab-drag-ghost";ghost.setAttribute("aria-hidden","true");
    ghost.style.width=`${Math.min(130,pending.button.getBoundingClientRect().width)}px`;
    ghost.append(pending.button.querySelector(".lab-art").cloneNode(true));grid.parentElement.append(ghost);
    pending.button.classList.add("is-drag-source");point(pending.x,pending.y);
  }
  function prepare(event,x,y,kind,id) {
    if(grid.dataset.reordering==="true") return;
    const button=event.target.closest("button[data-number]");
    if(!button || !grid.contains(button) || grid.querySelectorAll("button[data-number]").length<2) return;
    cancel();pending={button,x,y,kind,id};
    if(kind==="touch") timer=setTimeout(start,350);
  }
  function move(x,y) {
    if(!pending) return;
    const distance=Math.hypot(x-pending.x,y-pending.y);
    if(!ghost && distance>8) {
      if(pending.kind==="touch") { cancel();return; }
      start();
    }
    point(x,y);
  }
  function finish() {
    if(!pending) return;
    const source=Number(pending.button.dataset.number),destination=target ? Number(target.dataset.number):null;
    const dragging=!!ghost;
    cancel();
    if(dragging) {
      suppressUntil=performance.now()+500;
      if(destination!==null) swap(source,destination);
      grid.querySelector(`[data-number="${source}"]`)?.focus({preventScroll:true});
    }
  }
  listen(grid,"pointerdown",e=>{if(e.pointerType!=="touch" && e.button===0) prepare(e,e.clientX,e.clientY,"pointer",e.pointerId);});
  listen(window,"pointermove",e=>{if(pending?.kind==="pointer" && pending.id===e.pointerId) move(e.clientX,e.clientY);});
  listen(window,"pointerup",e=>{if(pending?.kind==="pointer" && pending.id===e.pointerId) finish();});
  listen(window,"pointercancel",()=>{if(pending?.kind==="pointer") cancel();});
  listen(grid,"touchstart",e=>{
    if(e.touches.length!==1) {cancel();return;}
    const t=e.touches[0];prepare(e,t.clientX,t.clientY,"touch",t.identifier);
  },{passive:true});
  listen(window,"touchmove",e=>{
    if(pending?.kind!=="touch") return;
    if(e.touches.length!==1) {cancel();return;}
    const t=[...e.touches].find(t=>t.identifier===pending.id);if(!t) return;
    if(ghost) e.preventDefault();move(t.clientX,t.clientY);
  },{passive:false});
  listen(window,"touchend",e=>{if(pending?.kind==="touch") {if(ghost) e.preventDefault();finish();}},{passive:false});
  listen(window,"touchcancel",cancel);
  listen(grid,"click",e=>{if(performance.now()<suppressUntil && e.detail!==0) {e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
  listen(grid,"contextmenu",e=>{if(pending?.kind==="touch") e.preventDefault();});
  listen(grid,"dragstart",e=>e.preventDefault());
  listen(window,"blur",cancel);
  listen(window,"scroll",()=>{if(pending) cancel();},{capture:true,passive:true});
  listen(document,"keydown",e=>{if(e.key==="Escape" && pending) {suppressUntil=performance.now()+500;cancel();}});
  page.onDispose(cancel);
  return cancel;
}

