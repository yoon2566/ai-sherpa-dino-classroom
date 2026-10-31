import {handleClassroom,teacherSessionExpiry} from './classroom-cloud.mjs';
import {handleBoard} from './board-api.mjs';
import {handleGame} from './ai-gateway.mjs';
import {handlePrompt} from './prompt-gateway.mjs';
import {slides} from './classroom-deck.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function asset(request,env,pathname){
  const url=new URL(request.url);url.pathname=pathname;
  const response=await env.ASSETS.fetch(new Request(url,request));
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,headers});
}
export default {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try{
    const events=/^\/api\/classroom\/([A-F0-9]{6})\/events$/.exec(path);
    if(events){
      if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'실시간 연결을 확인해 주세요.'},426);
      if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'같은 수업 화면에서 연결해 주세요.'},403);
      if(!env.CLASSROOM_EVENTS)return json({error:'실시간 연결을 준비하고 있어요.'},503);
      const stateUrl=new URL(url);stateUrl.pathname='/api/classroom/'+events[1];
      const response=await handleClassroom(new Request(stateUrl,{headers:request.headers}),env,slides);
      if(!response.ok)return response;
      const state=await response.json(),headers=new Headers(request.headers);
      headers.set('X-Classroom-State',encodeURIComponent(JSON.stringify(state)));
      headers.set('X-Classroom-Code',events[1]);headers.set('X-Classroom-Can-Manage',String(state.canManage));
      headers.set('X-Classroom-Auth-Until',String(state.canManage?await teacherSessionExpiry(request,env.CLASSROOM_DB,Date.now()):0));
      headers.delete('Cookie');headers.delete('Authorization');
      return await env.CLASSROOM_EVENTS.getByName(events[1]).fetch(new Request(request,{headers}));
    }
    if(path==='/api/classroom'||path.startsWith('/api/classroom/'))return await handleClassroom(request,env,slides);
    if(path==='/api/board'||path.startsWith('/api/board/'))return await handleBoard(request,env);
    if(path==='/api/health'&&['GET','HEAD'].includes(request.method)){
      await env.CLASSROOM_DB.prepare('SELECT code FROM classrooms LIMIT 1').all();
      return json({ok:true,classroom:true,portal:true,storage:'d1',realtime:Boolean(env.CLASSROOM_EVENTS),aiConfigured:Boolean(env.SHERPA_OPENROUTER_KEY&&env.GAME_RATE_LIMIT),aiBackend:'direct'});
    }
    if(path==='/api/game'||path==='/api/prompt'){
      if(request.method!=='POST')return json({error:'허용되지 않은 요청입니다.'},405);
      if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'수업 화면에서 실행해 주세요.'},403);
      if(!env.SHERPA_OPENROUTER_KEY||!env.GAME_RATE_LIMIT)return json({error:'AI 연결을 확인해 주세요.'},503);
      return await (path==='/api/prompt'?handlePrompt:handleGame)(request,{apiKey:env.SHERPA_OPENROUTER_KEY,checkRate:async()=>{
        const response=await env.GAME_RATE_LIMIT.get(env.GAME_RATE_LIMIT.idFromName('shared')).fetch('https://internal/limit');
        if(!response.ok)return response;await response.body?.cancel();return null;
      }});
    }
    if(path.startsWith('/api/'))return json({error:'없는 기능입니다.'},404);
    if(!['GET','HEAD'].includes(request.method))return json({error:'허용되지 않은 요청입니다.'},405);
    if(path==='/favicon.ico')return new Response(null,{status:204});
    if(path==='/teacher')return Response.redirect(url.origin+'/classes',302);
    if(['/','/index.html','/classes'].includes(path)){
      if(url.searchParams.has('room'))return Response.redirect(url.origin+'/lesson'+url.search,302);
      return await asset(request,env,'/index.html');
    }
    if(path==='/lesson')return await asset(request,env,'/lesson.html');
    if(path==='/board')return await asset(request,env,'/board.html');
    return await env.ASSETS.fetch(request);
  }catch(error){console.error(JSON.stringify({event:'classroom-worker-error',type:error.name||'Error'}));return json({error:'연결을 확인한 뒤 다시 시도해 주세요.'},503)}
}};
