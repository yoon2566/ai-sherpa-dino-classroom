const feedbackStates=new Map(),repairJobs=new Map();
function feedbackStorage(){return typeof lessonStorage==='undefined'?localStorage:lessonStorage}
function restoreFeedbackState(slide,saved){
  const questionVersion=slide.questionVersion||1,state={selections:{},customEntries:{},prompt:typeof saved?.prompt==='string'?saved.prompt.slice(0,16000):'',revisions:Number.isInteger(saved?.revisions)?saved.revisions:0,completed:saved?.completed===true,questionVersion};
  const shift=slide.id==='game-feedback'&&questionVersion>=2&&(saved?.questionVersion||1)<2?1:0;
  slide.questions.forEach((q,i)=>{const prior=i-shift;if(prior<0)return;const v=saved?.selections?.[prior];if(Number.isInteger(v)&&v>0&&v<=q.issues.length)state.selections[i]=v;if(typeof saved?.customEntries?.[prior]==='string')state.customEntries[i]=saved.customEntries[prior].slice(0,500)});
  return state;
}
function feedbackContext(slide){
  const quiz=deck.slides.find(s=>s.id==='game-sentences');if(!quiz)return null;
  const game=quizState(quiz);if(!game.gameHtml)return null;
  if(!game.gameSession){game.gameSession=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);saveQuiz(quiz,game)}
  const key='sherpa-feedback-'+slide.id+'-'+game.gameSession;
  if(!feedbackStates.has(key)){
    let saved=null;try{saved=JSON.parse(feedbackStorage().getItem(key))}catch{}
    const state=restoreFeedbackState(slide,saved);
    try{feedbackStorage().setItem(key,JSON.stringify(state))}catch{}
    feedbackStates.set(key,state);
  }
  if(!repairJobs.has(key))repairJobs.set(key,{phase:'idle',message:'',receivedLines:0,controller:null,onChange:null,resultPending:false});
  return {quiz,game,key,state:feedbackStates.get(key),job:repairJobs.get(key)};
}
function saveFeedback(context){try{feedbackStorage().setItem(context.key,JSON.stringify(context.state))}catch{}}
function bindErrorTextInput(input,context,index,onCommit){
  let composing=false;
  function commit(){
    if(composing||context.job.phase==='loading')return;
    context.state.customEntries[index]=input.value.slice(0,500);
    context.state.completed=false;context.job.message='';saveFeedback(context);onCommit();
  }
  input.addEventListener('compositionstart',()=>{composing=true});
  input.addEventListener('compositionend',()=>{composing=false;commit()});
  input.addEventListener('input',event=>{if(!event.isComposing)commit()});
  input.addEventListener('change',commit);
  input.addEventListener('keydown',event=>event.stopPropagation());
  input.addEventListener('keyup',event=>event.stopPropagation());
}
function selectedErrors(slide,state){return slide.questions.flatMap((q,i)=>{
  const value=state.selections[i],issue=Number.isInteger(value)&&value>0&&value<=q.issues.length?q.issues[value-1]:null,custom=state.customEntries?.[i]?.trim();
  if(!issue&&!custom)return [];
  return [{choice:issue?.label||'',custom:custom||'',question:q.q,freeText:!!q.freeText,preset:issue?.request||'',request:(slide.type==='design'?'디자인 질문: ':'점검 질문: ')+q.q+'\n'+[issue?.request,custom?(slide.type==='design'?(slide.id==='character-design'?'직접 적은 모습: ':'직접 적은 '+designCopy(slide).subject+': '):'직접 적은 오류: ')+custom:null].filter(Boolean).join('\n')}];
})}
async function convertErrorRequests(issues,signal){
  const items=issues.flatMap((issue,i)=>issue.custom?[{id:String(i),text:issue.custom,context:issue.question}]:[]);
  if(!items.length)return issues;
  const converted=new Map((await receivePromptRequests(items,'errors',signal)).map(item=>[item.id,item.request]));
  return issues.map((issue,i)=>!issue.custom?issue:{...issue,request:'점검 질문: '+issue.question+'\n'+[issue.preset,(issue.freeText?'직접 적은 요청: ':'직접 적은 오류의 수정 요청: ')+converted.get(String(i))].filter(Boolean).join('\n')});
}
async function convertDesignRequests(slide,issues,signal){
  const items=issues.flatMap((issue,i)=>issue.custom?[{id:String(i),text:issue.custom,context:issue.question}]:[]);if(!items.length)return issues;
  const converted=new Map((await receivePromptRequests(items,'rules',signal)).map(item=>[item.id,item.request]));
  return issues.map((issue,i)=>!issue.custom?issue:{...issue,request:'디자인 질문: '+issue.question+'\n'+(slide.id==='character-design'?'직접 적은 모습: ':'직접 적은 '+designCopy(slide).subject+': ')+converted.get(String(i))});
}
function changePrompt(slide,issues){const designer={'background-design':backgroundDesignPrompt,'obstacle-design':obstacleDesignPrompt}[slide.id]||characterDesignPrompt;return slide.type==='design'?(stageActivity(slide)?enhancementPrompt(slide,issues):designer(issues)):repairPrompt(issues)}
function repairPrompt(issues){return '현재 게임에서 아래에 선택한 오류들을 함께 수정하고, 직접 적은 요청도 반영해 줘.\n\n'+issues.map((issue,i)=>(i+1)+'. '+issue.request).join('\n')+'\n\n이번 요청에 없는 다른 게임 규칙과 정상 작동하는 기능, 캐릭터와 배경 디자인은 유지해 줘. 수정된 전체 HTML을 하나의 html 코드 블록으로 제공해 줘. 생략하거나 처음부터 다른 게임으로 바꾸지 마.'}
function characterDesignPrompt(issues){return '현재 게임에서 주인공의 생김새만 아래 요청대로 바꿔 줘.\n\n'+issues.map(issue=>issue.request).join('\n')+'\n\n직접 적은 모습이 선택지와 다르면 직접 적은 모습을 우선해 줘. 귀, 얼굴, 꼬리 또는 팔다리 등 특징이 게임 화면에서 알아보이도록 그려 줘. 이미지 생성 서비스나 외부 이미지 주소 없이 Canvas, CSS 또는 인라인 SVG로 그려 줘. 주인공의 실제 움직임과 충돌 영역 크기는 유지해 줘. 점프 높이, 이동 속도, 조작 키, 장애물, 배경, 점수 계산, 시작과 다시 시작 규칙은 바꾸지 마. 기존 게임을 유지하며 수정된 전체 HTML을 하나의 html 코드 블록으로 제공해 줘.'}
function backgroundDesignPrompt(issues){return '현재 게임에서 배경만 아래 요청대로 바꿔 줘.\n\n'+issues.map(issue=>issue.request).join('\n')+'\n\n직접 적은 배경이 선택지와 다르면 직접 적은 내용을 우선해 줘. 실제 게임 화면 안에 풍경이 보이도록 Canvas, CSS 또는 인라인 SVG로 그려 줘. 외부 이미지 주소나 이미지 생성 서비스는 사용하지 마. 이미 바꾼 주인공의 생김새, 색상, 크기, 애니메이션과 그리는 코드는 그대로 유지해 줘. 배경은 주인공과 장애물 뒤에 그리고, Canvas 그리기 상태는 save/restore로 분리해 줘. 주인공과 장애물, 바닥, 점수와 안내 글씨는 배경 위에서 잘 보여야 해. 점프 높이, 이동 속도, 충돌 영역, 조작 키, 장애물 생성, 점수 계산, 시작과 다시 시작 규칙은 바꾸지 마. 현재 게임을 유지하며 수정된 전체 HTML을 하나의 html 코드 블록으로 제공해 줘.'}
function obstacleDesignPrompt(issues){return '현재 게임에서 장애물의 생김새만 아래 요청대로 바꿔 줘.\n\n'+issues.map(issue=>issue.request).join('\n')+'\n\n직접 적은 장애물이 선택지와 다르면 직접 적은 내용을 우선해 줘. 기존 주인공과 배경의 그림, 색상, 애니메이션 및 그리는 코드는 그대로 유지해 줘. 장애물의 색과 그리는 코드만 바꾸고, 장애물 데이터의 너비와 높이, 위치, 충돌 영역, 이동 속도, 생성 간격과 개수는 유지해 줘. 점프 높이, 조작 키, 난이도, 점수 계산, 게임 종료와 다시 시작 규칙도 유지해 줘. Canvas, CSS 또는 인라인 SVG를 사용하고 외부 이미지 주소나 이미지 생성 서비스는 사용하지 마. Canvas 그리기 상태는 save/restore로 분리하고, 장애물이 배경과 구분되어 잘 보이게 해 줘. 수정된 전체 HTML을 하나의 html 코드 블록으로 제공해 줘.'}
function stageActivity(slide){return (typeof embedded!=='undefined'?embedded.slides.find(item=>item.id===slide.id)?.activity:null)||slide.activity}
function enhancementPrompt(slide,issues){const activity=stageActivity(slide),specific=issues.filter(issue=>!issue.custom&&issue.choice).map(issue=>activity.optionRules?.[issue.choice]).filter(Boolean).join('\n');return '현재 게임에 아래 요청을 적용해 줘.\n\n'+issues.map(issue=>(issue.choice?'사용자가 선택한 항목: '+issue.choice+'\n':'')+issue.request).join('\n')+'\n\n직접 적은 내용이 선택지와 다르면 직접 적은 내용을 우선해 줘.\n'+activity.rules+'\n'+specific+'\n\n이번 요청에 포함되지 않은 주인공, 배경, 장애물 디자인과 이미 적용한 난이도, 목숨, 아이템, 능력, 효과음은 유지해 줘. 입력 이벤트나 게임 루프를 중복 등록하지 마. 게임 화면과 점수, 안내, 버튼은 부모 화면 안에서 잘리지 않게 해 줘. 점수·목숨·수집 개수·능력 상태는 주인공의 점프 경로를 가리지 않도록 플레이 영역 바깥 상단의 상태 표시줄에 간단히 배치하고, 좁은 화면에서는 자연스럽게 줄바꿈해 줘. 외부 라이브러리나 이미지·음원 주소 없이 한 파일에서 실행되게 해 줘. 수정된 전체 HTML을 하나의 html 코드 블록으로 제공해 줘.'}
function designCopy(slide){const activity=stageActivity(slide);if(activity)return activity;return {
  'background-design':{subject:'배경',instruction:'이번에는 게임 배경을 바꿔 봅시다.',loading:'배경을 바꾸고 있어요…',done:'게임 배경을 바꿨어요.',popup:'바뀐 배경에서 게임 해보기'},
  'obstacle-design':{subject:'장애물',instruction:'이번에는 장애물의 모습을 바꿔 봅시다.',loading:'장애물의 모습을 바꾸고 있어요…',done:'장애물 디자인을 바꿨어요.',popup:'바뀐 장애물을 피하며 게임 해보기'}
}[slide.id]||{subject:'주인공',instruction:'먼저 주인공의 모습을 바꿔 봅시다.',loading:'주인공의 모습을 바꾸고 있어요…',done:'주인공 디자인을 바꿨어요.',popup:'바뀐 주인공으로 게임 해보기'}}
function goToCharacterDesign(){const next=deck.slides.findIndex(slide=>slide.id==='character-design');if(next>=0)go(next)}
function goToNextDesign(slide){const order=['character-design','background-design','obstacle-design','difficulty-tuning','lives-setting','item-collection','player-ability','jump-sound','game-sharing'],at=order.indexOf(slide.id);if(at<0)return;const target=order[at+1];if(!target)return;const next=deck.slides.findIndex(item=>item.id===target);if(next>=0)go(next)}
async function prepareRepairPrompt(slide,context){
  const {job,game,state}=context,issues=selectedErrors(slide,state);if(job.phase==='loading'||!game.gameHtml||!issues.length)return;
  const original=game.gameHtml,session=game.gameSession,snapshot=JSON.stringify(issues);
  if(state.prompt&&job.promptBaseHtml===original&&job.promptGameSession===session&&job.promptSelection===snapshot){job.view='prompt';job.phase='idle';job.message='';job.onChange?.();return}
  job.phase='loading';job.converting=true;job.resultPending=false;job.message='프롬프트로 바꾸고 있어요…';job.controller=new AbortController();job.onChange?.();
  try{
    const converted=await (slide.type==='design'?convertDesignRequests(slide,issues,job.controller.signal):convertErrorRequests(issues,job.controller.signal));
    if(job.controller.signal.aborted)throw Error('문장 변환을 중지했어요.');
    if(game.gameHtml!==original||game.gameSession!==session||JSON.stringify(selectedErrors(slide,state))!==snapshot)throw Error('게임이나 선택한 내용이 바뀌었어요. 다시 변환해 주세요.');
    const prompt=changePrompt(slide,converted);if(prompt.length>16000)throw Error('프롬프트가 너무 길어요. 입력한 문장을 조금 줄여 주세요.');
    state.prompt=prompt;job.promptBaseHtml=original;job.promptGameSession=session;job.promptSelection=snapshot;job.view='prompt';job.message='';job.phase='idle';saveFeedback(context);
  }catch(error){job.phase='error';job.message=job.controller?.signal.aborted?'문장 변환을 중지했어요. 선택과 입력은 그대로예요.':error.message||'프롬프트를 만들지 못했어요. 다시 시도해 주세요.'}
  finally{job.converting=false;job.controller=null;job.onChange?.()}
}
async function repairCurrentGame(slide,context){
  const {job,quiz,game,state}=context;let issues=selectedErrors(slide,state);const design=slide.type==='design';if(job.phase==='loading'||!game.gameHtml||!issues.length)return;
  {
    if(job.view!=='prompt'||!state.prompt?.trim())return;
    if(state.prompt.length>16000){job.message='프롬프트를 16,000자 이내로 줄여 주세요.';job.onChange?.();return}
    if(job.promptBaseHtml!==game.gameHtml||job.promptGameSession!==game.gameSession){job.message='게임이 바뀌었어요. 오류를 다시 선택하고 프롬프트를 만들어 주세요.';job.onChange?.();return}
  }
  const copy=designCopy(slide),original=game.gameHtml,originalSession=game.gameSession;job.phase='loading';job.resultPending=false;job.receivedLines=0;job.controller=new AbortController();job.message=design?copy.loading:issues.length+'개 오류를 함께 고치고 있어요…';job.onChange?.();
  try{
    const prompt=state.prompt;
    const result=await receiveGameHtml({prompt,baseHtml:original},job.controller.signal,(_length,lines)=>{if(job.phase!=='loading'||job.controller?.signal.aborted)return;job.receivedLines=lines;job.onChange?.()});
    if(game.gameSession!==originalSession||game.gameHtml!==original){job.phase='error';job.message='게임이 바뀌어 이전 수정 결과를 적용하지 않았어요. 현재 게임을 다시 점검해 주세요.';return}
    game.gameHtml=result.html;saveQuiz(quiz,game);state.revisions++;state.completed=false;saveFeedback(context);
    const generation=generatedGame(quiz,game);generation.html=result.html;generation.phase='ready';generation.message='수정된 게임을 직접 해 보세요.';generation.onChange?.();
    job.message=design?copy.done+' 팝업에서 게임을 해 보세요.':'수정했어요. 팝업에서 게임을 해 보세요.';job.phase='idle';job.resultPending=true;
  }catch(error){job.message=job.controller?.signal.aborted?'수정을 중지했어요. 선택한 항목과 이전 게임은 그대로예요.':(error.message||'수정을 마치지 못했어요. 다시 시도해 주세요.');job.phase='error'}
  finally{job.converting=false;job.controller=null;job.onChange?.()}
}
function buildErrorActivity(slide,print=false){
  const root=node('error-stage'),design=slide.type==='design',copy=designCopy(slide);
  if(print){root.classList.add('quiz-print');slide.questions.forEach((q,i)=>root.append(node('',(i+1)+'. '+q.q)));return root}
  const context=feedbackContext(slide);
  if(!context){root.append(node('error-empty',design?'6쪽에서 게임을 만든 뒤 디자인을 바꿔 보세요.':'6쪽에서 만든 게임의 오류를 여기서 고칠 수 있어요.'),quizButton('6쪽에서 게임 만들기',()=>go(deck.slides.findIndex(s=>s.id==='game-sentences')),true));return root}
  const {game,state,job}=context;state.customEntries??={};
  const speech=design?null:createFeedbackSpeech(root,()=>update());
  const instruction=node('error-instruction',design?copy.instruction:'고칠 부분을 고르거나 말로 입력해 주세요. 입력한 글은 확인하고 수정할 수 있어요.');root.append(instruction);
  const list=node('error-list');list.tabIndex=0;list.setAttribute('aria-label',design?copy.subject+' 디자인 선택':'게임 오류 점검 질문 목록');
  const groups=slide.questions.map((q,i)=>{
    const row=node('error-row'),heading=node('error-question',(design?'':(i+1)+'. ')+q.q);heading.id='error-question-'+i;
    const choices=node('error-choices');choices.setAttribute('role','group');choices.setAttribute('aria-labelledby',heading.id);
    q.issues.forEach((issue,option)=>{const label=issue.label,value=option+1;
      const button=quizButton(label,()=>{if(job.phase==='loading')return;if(state.selections[i]===value)delete state.selections[i];else state.selections[i]=value;state.completed=false;job.message='';saveFeedback(context);update()});choices.append(button);
    });const buttons=[...choices.children],input=document.createElement('textarea');input.className='error-custom';input.rows=q.freeText?3:design?3:2;input.maxLength=500;input.placeholder=q.freeText?'자유롭게 적어 주세요.':design?'원하는 '+copy.subject+' 직접 적기':'다른 오류 직접 적기';input.setAttribute('aria-label',q.freeText?'자유롭게 쓰기':design?input.placeholder:(i+1)+'번 오류 직접 적기');input.value=state.customEntries[i]||'';
    input.lang='ko';input.inputMode='text';input.spellcheck=false;
    bindErrorTextInput(input,context,i,update);
    const inputField=speech?speech.attach(input,q.freeText?'자유롭게 쓰기':(i+1)+'번 오류'):input;
    if(q.freeText)row.append(heading,inputField);else{choices.append(inputField);row.append(heading,choices)}list.append(row);return {buttons,input};
  });
  const footer=node('error-footer'),status=node('error-status'),count=node('error-count'),message=node('error-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');status.append(count,message);
  const actions=node('error-actions'),stop=quizButton('수정 중지',()=>job.controller?.abort()),noProblems=quizButton('문제가 없어요',()=>{
    if(job.phase==='loading'||selectedErrors(slide,state).length)return;
    state.completed=true;job.phase='idle';job.resultPending=false;job.message='문제 없이 잘 작동해요. 오류 점검을 마쳤어요.';saveFeedback(context);update();goToCharacterDesign();
  }),viewGame=quizButton('내 게임 보기',()=>openPopup(true)),submit=quizButton('프롬프트로 바꾸기',()=>prepareRepairPrompt(slide,context),true);noProblems.hidden=design;viewGame.hidden=!design;actions.append(stop,noProblems,viewGame,submit);footer.append(status,actions);root.append(list,footer);
  let promptDialog=null;
  function closePrompt(){promptDialog?.close(false);promptDialog=null}
  function showPrompt(){
    if(promptDialog||!root.isConnected)return;
    promptDialog=openPromptDialog({value:state.prompt,applyLabel:design?'적용하기':'게임 만들기',returnFocus:submit,onInput:value=>{state.prompt=value;job.message='';saveFeedback(context);update()},onApply:()=>repairCurrentGame(slide,context),onStop:()=>job.controller?.abort(),onClose:()=>{promptDialog=null;job.view='select';job.message='';update()}});
  }
  function nextStage(){
    const order=['game-feedback','character-design','background-design','obstacle-design','difficulty-tuning','lives-setting','item-collection','player-ability','jump-sound','game-sharing'];
    const next=deck.slides.findIndex(item=>item.id===order[order.indexOf(slide.id)+1]);
    if(next>=0&&!canVisitPage(next)){showClassroomBrake();return false}
    state.selections={};state.customEntries={};state.prompt='';job.view='select';groups.forEach(({input})=>{input.value=''});state.completed=true;saveFeedback(context);job.message=design?copy.done:'오류 수정을 마쳤어요.';closePrompt();update();if(!design)goToCharacterDesign();else goToNextDesign(slide);
  }
  function openPopup(previewOnly=false){
    if(job.phase==='loading'||!game.gameHtml)return;showPrompt();if(!promptDialog)return;
    promptDialog.showGame({html:game.gameHtml,title:previewOnly?'내 게임 보기':design?copy.popup:'수정된 게임 해보기',previewOnly,onNext:nextStage,onEdit:()=>{job.view='prompt';job.promptBaseHtml=game.gameHtml;job.promptGameSession=game.gameSession;job.message='';update()}});
  }
  function update(){
    const busy=job.phase==='loading',total=selectedErrors(slide,state).length;count.textContent=busy?(job.converting?'프롬프트로 바꾸고 있어요':design?'AI가 게임을 바꾸고 있어요':'AI가 게임을 수정하고 있어요'):design?(total?copy.subject+' 선택 완료':copy.choose||copy.subject+'을 골라 주세요'):'선택한 오류 '+total+'개';message.textContent=busy?(job.converting?'선택과 입력을 프롬프트로 정리하고 있어요…':job.receivedLines?'코드 '+job.receivedLines.toLocaleString()+'줄 작성 중…':'코드 0줄 · AI 응답을 기다리고 있어요…'):job.message||(state.completed?(design?copy.done:'오류 수정을 마쳤어요.'):(design?'원하는 내용을 직접 적어도 돼요.':'해당하는 항목만 선택해 주세요.'));message.classList.toggle('is-streaming',busy);message.title=message.textContent;
    speech?.setBusy(busy);
    viewGame.disabled=busy;noProblems.disabled=busy||total>0||!!speech?.listening;submit.disabled=busy||total===0||!!speech?.listening;submit.textContent=busy?(job.converting?'프롬프트로 바꾸는 중…':design?'적용 중…':'게임 만드는 중…'):'프롬프트로 바꾸기';stop.textContent=job.converting?'변환 중지':'수정 중지';stop.hidden=!busy;list.setAttribute('aria-busy',String(busy));
    groups.forEach(({buttons,input},i)=>{buttons.forEach((button,option)=>{button.disabled=busy;button.setAttribute('aria-pressed',String(state.selections[i]===option+1))});if(input.disabled!==busy)input.disabled=busy;input.classList.toggle('has-text',!!state.customEntries[i]?.trim())});
    if(job.resultPending&&root.isConnected){job.resultPending=false;job.view='result';openPopup()}
    else if(job.view==='prompt'&&root.isConnected){showPrompt();promptDialog?.update({value:state.prompt||'',busy,message:busy?(job.receivedLines?'코드 '+job.receivedLines.toLocaleString()+'줄 작성 중…':'코드 0줄 · AI 응답을 기다리고 있어요…'):job.message})}
  }
  const onChange=()=>{if(root.isConnected)update()};job.onChange=onChange;
  root.dispose=()=>{speech?.dispose();closePrompt();job.view='select';if(job.onChange===onChange)job.onChange=null};
  update();queueMicrotask(()=>{if(root.isConnected)update()});return root;
}
