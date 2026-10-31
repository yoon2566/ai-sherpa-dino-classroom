const generatedGames=new Map();
function generatedGame(slide,state){if(!generatedGames.has(slide.id))generatedGames.set(slide.id,{phase:state.gameHtml?'ready':'idle',html:state.gameHtml||'',controller:null,received:0,message:state.gameHtml?'완성된 게임을 직접 해 보세요.':'',onChange:null,usage:null});return generatedGames.get(slide.id)}
function extractedGame(text){
  const blocks=[...text.matchAll(/```(?:html|htm)?[ \t]*\r?\n([\s\S]*?)```/gi)];
  for(const match of blocks.reverse())if(/<html(?:\s|>)/i.test(match[1])&&/<\/html\s*>/i.test(match[1]))return match[1].trim();
  const plain=text.trim();if(/^(?:<!doctype\s+html\s*>\s*)?<html(?:\s|>)/i.test(plain)&&/<\/html\s*>\s*$/i.test(plain))return plain;
  return null;
}
function gameCodeLineCount(text){
  const start=text.search(/<!doctype\s+html(?:\s|>)|<html(?:\s|>)/i);if(start<0)return 0;
  let code=text.slice(start);const end=code.match(/<\/html\s*>/i);if(end)code=code.slice(0,end.index+end[0].length);
  code=code.trim();return code?code.split(/\r\n|\r|\n/).length:0;
}
async function receiveGameHtml(payload,signal,onProgress=()=>{}){
    let raw='',finish='',done=false,lastNotify=0,usage=null;
    let response;try{response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal})}catch(error){
      if(signal?.aborted)throw error;
      if(typeof location!=='undefined'&&location.protocol==='file:')throw Error('AI 생성·수정은 수업 서버에서 사용할 수 있어요. http://127.0.0.1:8876/ 주소로 열어 주세요.');
      throw Error('수업 서버와 연결이 끊겼어요. 서버가 실행 중인지 확인한 뒤 다시 시도해 주세요. 기존 게임은 그대로 유지됩니다.');
    }
    if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'게임을 만들지 못했습니다. 다시 시도해 주세요.')}
    if(!response.body)throw Error('게임 코드가 도착하지 않았습니다. 다시 시도해 주세요.');
    const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    function line(text){
      if(!text.startsWith('data:'))return;const payload=text.slice(5).trim();if(!payload)return;if(payload==='[DONE]'){done=true;return}
      let value;try{value=JSON.parse(payload)}catch{return}
      if(value.error)throw Error('생성 도중 응답이 끊겼습니다. 프롬프트를 확인하고 다시 시도해 주세요.');
      if(value.usage)usage=value.usage;const choice=value.choices?.[0];if(choice?.finish_reason)finish=choice.finish_reason;
      const content=choice?.delta?.content;if(typeof content==='string')raw+=content;
      if(Date.now()-lastNotify>180){lastNotify=Date.now();onProgress(raw.length,gameCodeLineCount(raw))}
    }
    try{for(;;){const {done:end,value}=await reader.read();if(end)break;pending+=decoder.decode(value,{stream:true});let at;while((at=pending.indexOf('\n'))!==-1){line(pending.slice(0,at).replace(/\r$/,''));pending=pending.slice(at+1)}}pending+=decoder.decode();if(pending)line(pending)}finally{reader.releaseLock()}
    if(finish==='length')throw Error('코드가 길어 생성을 끝내지 못했습니다. 프롬프트를 줄여 다시 시도해 주세요.');
    if(finish==='content_filter')throw Error('이 요청으로는 게임을 만들지 못했습니다. 프롬프트를 고쳐 다시 시도해 주세요.');
    if(!done&&!['stop','end_turn'].includes(finish))throw Error('생성 완료를 확인하지 못했습니다. 다시 시도해 주세요.');
    const html=extractedGame(raw);if(!html)throw Error('완성된 HTML 코드를 받지 못했습니다. 다시 시도해 주세요.');
    const lines=gameCodeLineCount(html);onProgress(raw.length,lines);return {html,usage,lines};
}
async function requestGeneratedGame(slide,state){
  const job=generatedGame(slide,state);if(job.phase==='loading')return;
  const originalHtml=state.gameHtml,originalSession=state.gameSession,nextSession=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  job.phase='loading';job.received=0;job.receivedLines=0;job.message='코드 0줄 · AI 응답을 기다리고 있어요…';job.usage=null;job.started=Date.now();job.controller=new AbortController();state.mode='game';saveQuiz(slide,state);
  const notify=()=>job.onChange?.();notify();
  try{
    const {html,usage}=await receiveGameHtml({prompt:state.prompt},job.controller.signal,(length,lines)=>{job.received=length;job.receivedLines=lines;job.message=lines?'코드 '+lines.toLocaleString()+'줄 작성 중…':'코드 0줄 · AI 응답을 기다리고 있어요…';notify()});job.usage=usage;
    if(state.gameHtml!==originalHtml||state.gameSession!==originalSession)throw Error('게임이 바뀌어 이전 생성 결과를 적용하지 않았어요. 다시 확인해 주세요.');
    job.html=html;state.gameHtml=html;state.gameSession=nextSession;job.phase='ready';job.message='완성된 게임을 직접 해 보세요.';job.elapsedMs=Date.now()-job.started;saveQuiz(slide,state);
  }catch(error){job.phase=job.controller?.signal.aborted?'stopped':'error';job.message=job.phase==='stopped'?'생성을 중지했어요. 프롬프트를 고치거나 다시 만들 수 있어요.':error.message||'연결을 확인하고 다시 시도해 주세요.'}
  finally{job.controller=null;notify()}
}
function generatedPreview(html,token){
  const boot=`<script>(()=>{const token=${JSON.stringify(token)};const report=message=>parent.postMessage({type:'sherpa-game-error',token,message:String(message).slice(0,350)},'*');addEventListener('error',e=>report(e.message));addEventListener('unhandledrejection',e=>report(e.reason?.message||e.reason));for(const name of ['localStorage','sessionStorage']){try{window[name].getItem('sherpa-check')}catch{const data=new Map();try{Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}}})}catch{}}}})();<\/script>`;
  if(/<head(?:\s[^>]*)?>/i.test(html))return html.replace(/<head(?:\s[^>]*)?>/i,head=>head+'<meta charset="utf-8">'+boot);
  return html.replace(/<html(?:\s[^>]*)?>/i,tag=>tag+'<head><meta charset="utf-8">'+boot+'</head>');
}
