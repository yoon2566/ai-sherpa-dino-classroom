// Inserted inside the copied runner's IIFE by build-game.cjs.
// Only presentation controls are adapted; gameplay functions remain unchanged.
(() => {
  'use strict';
  const host=window.parent,embedded=host!==window,held=new Set();
  const controlCodes=new Set([32,38,40,13]);
  function focusGame(){try{canvas.focus({preventScroll:true});}catch{}}
  function key(code,down){
    if(!controlCodes.has(code)||typeof down!=='boolean')return;
    if(down){
      held.add(code);
      if(code===40)pressDown();
      else if(code===32||code===38)pressJump();
    }else{
      held.delete(code);
      if(code===40)releaseDown();
      else if(code===32||code===38)releaseJump();
      else if(code===13&&phase==='crashed')resetRun();
    }
  }
  function releaseHeld(){
    for(const code of held){
      if(code===40)releaseDown();
      else if((code===32||code===38)&&phase!=='crashed')releaseJump();
    }
    held.clear();
  }
  function tap(){
    focusGame();
    if(phase==='crashed'){releaseHeld();resetRun();return;}
    pressJump();pointerRelease=clockMs+140;
  }
  function restart(){
    focusGame();releaseHeld();
    if(phase==='waiting')tap();else resetRun();
  }
  window.addEventListener('message',event=>{
    if(!embedded||event.source!==host)return;
    const data=event.data;
    if(!data||typeof data!=='object'||data.channel!=='lounge-dino')return;
    if(data.command==='tap'){tap();return;}
    if(data.command==='restart'){restart();return;}
    key(data.code,data.down);
  });
  document.addEventListener('keydown',event=>{
    if(!embedded||event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
    const directions={ArrowLeft:-1,PageUp:-1,ArrowRight:1,PageDown:1};
    const direction=directions[event.key]??directions[event.code];
    if(direction!==-1&&direction!==1)return;
    event.preventDefault();
    // srcdoc may have an opaque origin. The payload contains only a page direction;
    // the containing lesson validates event.source against its own game iframe.
    try{host.postMessage({channel:'lounge-dino',navigate:direction},'*');}catch{}
  });
  // Preserve the approved behavior: changing slide-control focus does not pause.
  // Its existing visibilitychange handler pauses hidden tabs, and resize pauses.
  window.addEventListener('blur',releaseHeld);
})();
