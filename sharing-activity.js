const sharedGames=new Map();
// Remove the legacy name autofill value without touching saved lessons or games.
try{localStorage.removeItem('sherpa-share-author')}catch{}
function buildSharingActivity(slide,print=false){
  const root=node('sharing-stage'),steps=node('sharing-steps');
  ['공유하기를 누르고 작품 제목을 적으세요.','완성한 게임이 게시판에 익명으로 올라갑니다.','게시판 보기에서 서로의 게임을 해 보세요.'].forEach((text,i)=>{const row=node('sharing-step');row.append(node('sharing-number',String(i+1).padStart(2,'0')),node('',text));steps.append(row)});
  root.append(steps);if(print)return root;
  const quiz=deck.slides.find(item=>item.id==='game-sentences'),game=quiz?quizState(quiz):null;
  const actions=node('sharing-actions'),download=quizButton('완성한 게임 다운로드',()=>{
    if(!game?.gameHtml)return;
    const url=URL.createObjectURL(new Blob(['\ufeff',game.gameHtml],{type:'text/html;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='내가_만든_공룡게임.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });download.disabled=!game?.gameHtml;
  const status=node('sharing-hint');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const share=quizButton('공유하기',openShare,true);share.disabled=!game?.gameHtml;
  const board=document.createElement('a');board.className='sharing-board';board.textContent='게시판 보기 ↗';board.href='/board';board.target='_blank';board.rel='noopener noreferrer';
  const lastShared=sharedGames.get(game?.gameHtml);if(lastShared){board.href='/board?work='+lastShared;status.textContent='공유한 게임을 게시판에서 볼 수 있어요.'}
  actions.append(download,share,board);root.append(actions,status);
  if(!game?.gameHtml)status.textContent='6쪽에서 게임을 만들면 공유할 수 있어요.';
  let dialog=null,controller=null;
  function closeShare(){if(!dialog)return;dialog.close();dialog.remove();dialog=null;share.focus({preventScroll:true})}
  function openShare(){
    if(dialog||!game?.gameHtml)return;
    const html=game.gameHtml;
    dialog=document.createElement('dialog');dialog.className='sharing-dialog';dialog.setAttribute('aria-labelledby','sharing-dialog-title');
    const heading=document.createElement('h2');heading.id='sharing-dialog-title';heading.textContent='내 게임 공유하기';
    const hint=node('sharing-dialog-hint','작품 제목만 적으면 지금 완성한 HTML 게임이 익명으로 올라가요.');
    const form=document.createElement('form'),titleLabel=document.createElement('label');
    titleLabel.textContent='작품 제목';
    const title=document.createElement('input');
    title.name='title';title.required=true;title.maxLength=80;title.placeholder='예: 점프하는 고양이';
    try{title.value=(new DOMParser().parseFromString(html,'text/html').title||'내가 만든 공룡 게임').trim().slice(0,80)}catch{title.value='내가 만든 공룡 게임'}
    titleLabel.append(title);
    const message=node('sharing-dialog-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    const buttons=node('sharing-dialog-actions'),cancel=quizButton('취소',()=>{if(!controller)closeShare()}),submit=document.createElement('button');submit.type='submit';submit.className='quiz-primary';submit.textContent='게시판에 공유하기';buttons.append(cancel,submit);
    form.append(titleLabel,message,buttons);dialog.append(heading,hint,form);document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(!controller)closeShare()});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(controller||!form.reportValidity())return;
      if(!title.value.trim()){message.textContent='작품 제목을 적어 주세요.';return}
      if(location.protocol==='file:'){message.textContent='수업 사이트에서 열면 게시판에 공유할 수 있어요.';return}
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),30000);
      title.disabled=cancel.disabled=submit.disabled=true;submit.textContent='공유 중…';message.textContent='완성한 게임을 게시판에 저장하고 있어요.';
      try{
        const response=await fetch('/api/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.value.trim(),html}),signal:controller.signal});
        const data=await response.json();if(!response.ok)throw Error(data.error||'공유하지 못했어요. 다시 시도해 주세요.');
        if(!data.item?.id)throw Error('공유 결과를 확인하지 못했어요. 다시 시도해 주세요.');
        sharedGames.set(html,data.item.id);
        board.href='/board?work='+encodeURIComponent(data.item.id);status.textContent=data.duplicate?'이미 공유된 작품이에요. 게시판 보기에서 확인하세요.':'공유했어요! 게시판 보기에서 내 게임을 확인하세요.';
        closeShare();
      }catch(error){if(dialog){message.textContent=error.name==='AbortError'?'연결이 지연되고 있어요. 다시 누르면 같은 작품을 중복 등록하지 않고 확인해요.':error.message;title.disabled=cancel.disabled=submit.disabled=false;submit.textContent='게시판에 공유하기'}}
      finally{clearTimeout(timeout);controller=null}
    });
    dialog.showModal();title.focus();
  }
  root.dispose=()=>{controller?.abort();controller=null;closeShare()};
  return root;
}
