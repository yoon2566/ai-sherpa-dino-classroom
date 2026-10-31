async function receivePromptRequests(items,mode,signal){
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,45000);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try{
    const response=await fetch('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,mode}),signal:controller.signal});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||'문장을 변환하지 못했어요. 다시 시도해 주세요.');
    if(!Array.isArray(result.items)||result.items.length!==items.length||result.items.some((item,i)=>item.id!==items[i].id||typeof item.request!=='string'||!item.request.trim()))throw Error('변환한 문장을 확인하지 못했어요. 다시 시도해 주세요.');
    return result.items;
  }catch(error){if(controller.signal.aborted)throw Error('문장 변환이 중지되었거나 시간이 초과됐어요. 다시 시도해 주세요.');if(error instanceof TypeError)throw Error('문장 변환 서버에 연결하지 못했어요. 원문은 그대로예요.');throw error}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
