'use strict';
const $=id=>document.getElementById(id),cursors=[null];let page=0,nextCursor=null,busy=false,viewerRequest=null,returnFocus=null;
const date=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(value);
function element(tag,cls,text){const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el}
async function getJson(url,options){const response=await fetch(url,{cache:'no-store',...options}),data=await response.json();if(!response.ok)throw Error(data.error||'불러오지 못했어요. 다시 시도해 주세요.');return data}
async function loadPage(target){
  if(busy)return;busy=true;$('refresh').disabled=$('previous').disabled=$('next').disabled=true;$('status').textContent='공유한 작품을 불러오고 있어요.';$('works').setAttribute('aria-busy','true');
  try{
    const data=await getJson('/api/board'+(cursors[target]?'?cursor='+encodeURIComponent(cursors[target]):''));
    page=target;nextCursor=data.nextCursor;$('works').replaceChildren();
    for(const work of data.items){
      const card=element('button','card');card.type='button';card.setAttribute('aria-label',work.title+' · '+work.author+' · 게임 해보기');
      const top=element('div','card-top');top.append(element('span','card-mark','↗'),element('span','card-size',Math.max(1,Math.round(work.bytes/1000))+' KB'));
      card.append(top,element('h3','',work.title),element('div','card-meta',work.author+' · '+date(work.created_at)),element('div','card-play','게임 해보기 →'));
      card.addEventListener('click',()=>openWork(work.id,card));$('works').append(card);
    }
    if(!data.items.length){const empty=element('div','empty');empty.append(element('strong','','아직 공유된 작품이 없어요.'),element('div','','수업 마지막 화면에서 첫 번째 게임을 공유해 보세요!'));$('works').append(empty)}
    $('status').textContent=data.items.length?('최신순 · 이 페이지에 작품 '+data.items.length+'개'):'';$('page').textContent=(page+1)+' 페이지';
  }catch(error){$('status').textContent=error.message}
  finally{busy=false;$('refresh').disabled=false;$('previous').disabled=page===0;$('next').disabled=!nextCursor;$('works').setAttribute('aria-busy','false')}
}
async function openWork(id,source){
  if(!/^[a-f0-9]{32}$/.test(id))return;
  returnFocus=source||$('refresh');viewerRequest?.abort();const controller=new AbortController();viewerRequest=controller;
  const timer=setTimeout(()=>controller.abort(),20000);
  $('work-title').textContent='공유한 게임';$('work-by').textContent='';$('play').replaceChildren(element('div','viewer-loading','게임을 불러오고 있어요.'));$('download').hidden=true;$('play-hint').textContent='게임 화면을 클릭한 뒤 조작해 보세요.';
  if(!$('viewer').open)$('viewer').showModal();
  const url=new URL(location.href);url.searchParams.set('work',id);history.replaceState(null,'',url);
  try{
    const {item}=await getJson('/api/board/'+id,{signal:controller.signal});
    if(viewerRequest!==controller||!$('viewer').open)return;
    $('work-title').textContent=item.title;$('work-by').textContent=item.author+' · '+date(item.created_at);
    const frame=document.createElement('iframe');frame.title=item.title;frame.setAttribute('sandbox','allow-scripts allow-pointer-lock');frame.setAttribute('allow','fullscreen');frame.referrerPolicy='no-referrer';frame.srcdoc=item.html;
    frame.addEventListener('load',()=>{if(frame.isConnected)frame.focus({preventScroll:true})});$('play').replaceChildren(frame);
    $('download').href='/api/board/'+id+'/download';$('download').hidden=false;
  }catch(error){if(viewerRequest===controller&&$('viewer').open)$('play').replaceChildren(element('div','viewer-loading',error.name==='AbortError'?'연결이 지연되고 있어요. 닫은 뒤 다시 열어 주세요.':error.message))}
  finally{clearTimeout(timer)}
}
function closeWork(){viewerRequest?.abort();viewerRequest=null;$('play').replaceChildren();$('viewer').close();const url=new URL(location.href);url.searchParams.delete('work');history.replaceState(null,'',url);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true})}
$('close').addEventListener('click',closeWork);$('viewer').addEventListener('cancel',event=>{event.preventDefault();closeWork()});
$('refresh').addEventListener('click',()=>{if(busy)return;cursors.splice(1);loadPage(0)});
$('previous').addEventListener('click',()=>loadPage(page-1));$('next').addEventListener('click',()=>{if(!nextCursor||busy)return;cursors[page+1]=nextCursor;loadPage(page+1)});
loadPage(0);const initialWork=new URLSearchParams(location.search).get('work');if(initialWork)openWork(initialWork);
