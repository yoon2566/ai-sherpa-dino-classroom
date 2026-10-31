function downloadGameHtml(html,name='내가_만든_공룡게임.html'){
  if(!html)return;const url=URL.createObjectURL(new Blob(['\ufeff',html],{type:'text/html;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openPromptDialog({value,applyLabel='게임 만들기',onInput,onApply,onStop,onClose,returnFocus}){
  const element=document.createElement('dialog');element.className='prompt-dialog';element.setAttribute('aria-label','적용할 프롬프트');
  const heading=node('prompt-dialog-heading','적용할 프롬프트'),instruction=node('prompt-dialog-instruction','문장을 확인하거나 고친 뒤, '+applyLabel+'를 눌러 주세요.'),input=document.createElement('textarea');
  input.className='prompt-dialog-input';input.setAttribute('aria-label','적용할 프롬프트');input.maxLength=16000;input.value=value||'';input.spellcheck=false;
  const status=node('prompt-dialog-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const footer=node('prompt-dialog-footer');let busy=false,closed=false,phase='prompt',resultHtml='',removeFrameListener=null;
  function close(notify=true){if(closed)return;closed=true;removeFrameListener?.();element.close();element.remove();if(notify)onClose?.(phase);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true})}
  function showPrompt(){if(phase==='prompt')return;removeFrameListener?.();removeFrameListener=null;phase='prompt';busy=false;resultHtml='';element.className='prompt-dialog';element.setAttribute('aria-label','적용할 프롬프트');element.replaceChildren(heading,instruction,input,status,footer);input.disabled=false;dismiss.disabled=false;stop.hidden=true;apply.disabled=!input.value.trim();apply.textContent=applyLabel;status.textContent='';input.focus({preventScroll:true})}
  function showGame({html,title='완성된 게임',onEdit,onNext,previewOnly=false}){
    if(phase==='result'&&resultHtml===html)return;removeFrameListener?.();phase='result';busy=false;resultHtml=html;element.className='prompt-dialog prompt-game-result';element.setAttribute('aria-label',title);element.setAttribute('aria-busy','false');
    const resultHeading=node('error-result-heading',title),frame=document.createElement('iframe'),token=crypto.randomUUID();frame.className='error-game-frame';frame.title='완성된 내 게임';frame.setAttribute('sandbox','allow-scripts allow-pointer-lock');frame.referrerPolicy='no-referrer';frame.srcdoc=generatedPreview(html,token);frame.addEventListener('load',()=>{if(frame.isConnected)frame.focus({preventScroll:true})});
    const bar=node('error-result-footer'),hint=node('error-result-hint','게임을 해 보고 결과를 확인해 주세요.'),buttons=node('error-actions');
    if(previewOnly)buttons.append(quizButton('닫기',()=>close()));else buttons.append(quizButton('프롬프트 고치기',()=>{showPrompt();onEdit?.()}));
    buttons.append(quizButton('HTML 다운로드',()=>downloadGameHtml(html)));
    if(!previewOnly)buttons.append(quizButton('다음 단계',()=>{if(onNext?.()===false)hint.textContent='강사가 다음 페이지를 열면 이동할 수 있어요. 지금은 게임을 더 해 보세요.'},true));bar.append(hint,buttons);element.replaceChildren(resultHeading,frame,bar);
    const errorListener=event=>{if(event.source===frame.contentWindow&&event.data?.type==='sherpa-game-error'&&event.data.token===token)hint.textContent='게임 실행 오류: '+String(event.data.message).slice(0,200)};window.addEventListener('message',errorListener);removeFrameListener=()=>window.removeEventListener('message',errorListener);
  }
  const dismiss=quizButton('닫기',()=>{if(!busy)close()}),stop=quizButton('중지',()=>onStop?.()),apply=quizButton(applyLabel,()=>{if(!busy&&input.value.trim())return onApply?.(input.value)},true);
  stop.hidden=true;apply.disabled=!input.value.trim();input.oninput=()=>{onInput?.(input.value);apply.disabled=busy||!input.value.trim()};
  input.addEventListener('keydown',event=>event.stopPropagation());input.addEventListener('keyup',event=>event.stopPropagation());
  footer.append(dismiss,stop,apply);element.append(heading,instruction,input,status,footer);
  element.addEventListener('cancel',event=>{event.preventDefault();if(!busy)close()});document.body.append(element);element.showModal();input.focus({preventScroll:true});
  return {element,input,status,apply,close,showPrompt,showGame,get phase(){return phase},update({value,busy:nextBusy=false,message=''}){busy=nextBusy;if(value!==undefined&&input.value!==value)input.value=value;input.disabled=busy;dismiss.disabled=busy;stop.hidden=!busy;apply.disabled=busy||!input.value.trim();apply.textContent=busy?(applyLabel==='게임 만들기'?'게임 만드는 중…':'적용 중…'):applyLabel;status.textContent=message;element.setAttribute('aria-busy',String(busy))}};
}
