const quizStates=new Map(),promptConversions=new Map();
function quizStorage(){return typeof lessonStorage==='undefined'?localStorage:lessonStorage}
function freshQuizState(){return {version:1,position:0,answered:0,mode:'quiz',sentences:[],prompt:'',gameHtml:'',gameSession:''}}
function quizState(slide){
  if(quizStates.has(slide.id))return quizStates.get(slide.id);
  let state=freshQuizState();
  try{
    const saved=JSON.parse(quizStorage().getItem('sherpa-quiz-'+slide.id));
    if(saved?.version===1&&Number.isInteger(saved.answered)&&saved.answered>=0&&saved.answered<=slide.questions.length&&Number.isInteger(saved.position)&&saved.position>=0&&saved.position<slide.questions.length&&saved.position<=saved.answered){
      state={...state,position:saved.position,answered:saved.answered,mode:saved.answered===slide.questions.length&&['review','prompt','game'].includes(saved.mode)?saved.mode:'quiz',sentences:slide.questions.map((q,i)=>typeof saved.sentences?.[i]==='string'?saved.sentences[i].slice(0,1000):q.sentence),prompt:typeof saved.prompt==='string'?saved.prompt.slice(0,16000):'',gameHtml:typeof saved.gameHtml==='string'?saved.gameHtml.slice(0,1500000):'',gameSession:typeof saved.gameSession==='string'?saved.gameSession:''};
    }
  }catch{}
  quizStates.set(slide.id,state);return state;
}
function saveQuiz(slide,state){try{quizStorage().setItem('sherpa-quiz-'+slide.id,JSON.stringify(state))}catch{}}
function quizButton(text,action,primary=false){const button=document.createElement('button');button.type='button';button.textContent=text;if(primary)button.className='quiz-primary';button.onclick=action;return button}
function makeGamePrompt(questions,sentences,converted=new Map()){
  const rules=questions.map((question,i)=>{const text=sentences[i].trim();return (i+1)+'. '+(converted.get(String(i))||(text===question.sentence?question.request:text))});
  return '아래 규칙대로 웹에서 실행되는 공룡 게임을 하나의 HTML 파일로 만들어 줘.\n\n'+rules.join('\n')+'\n\nHTML, CSS, JavaScript를 한 파일에 모두 넣고, 브라우저에서 바로 실행할 수 있게 해 줘.';
}
async function convertQuizPrompt(questions,sentences){
  const changed=questions.flatMap((question,i)=>sentences[i].trim()===question.sentence?[]:[{id:String(i),text:sentences[i].trim(),context:question.q}]);
  const converted=changed.length?await receivePromptRequests(changed,'rules'):[];
  const prompt=makeGamePrompt(questions,sentences,new Map(converted.map(item=>[item.id,item.request])));
  if(prompt.length>16000)throw Error('프롬프트가 너무 길어요. 문장을 조금 줄여 주세요.');
  return prompt;
}
function buildQuizActivity(slide,print=false){
  const host=node('quiz-stage');
  if(print){host.classList.add('quiz-print');slide.questions.forEach((q,i)=>host.append(node('',(i+1)+'. '+q.sentence)));return host}
  const state=quizState(slide),questions=slide.questions,total=questions.length;
  if(!promptConversions.has(slide.id))promptConversions.set(slide.id,{busy:false,error:'',onChange:null});
  const conversion=promptConversions.get(slide.id);conversion.onChange=()=>{if(host.isConnected)redraw()};
  let promptDialog=null;const gameJob=generatedGame(slide,state);
  host.dispose=()=>{promptDialog?.close(false);promptDialog=null;if(gameJob.onChange===syncGeneration)gameJob.onChange=null};
  function showResult(){
    if(!state.gameHtml)return;if(!promptDialog)showPrompt(true);if(!promptDialog)return;
    promptDialog.showGame({html:state.gameHtml,title:'내가 만든 공룡 게임',onEdit:()=>{state.mode='prompt';saveQuiz(slide,state)},onNext:()=>{const next=deck.slides.findIndex(item=>item.type==='feedback');if(next>=0&&!canVisitPage(next)){showClassroomBrake();return false}state.mode='game';saveQuiz(slide,state);promptDialog.close(false);promptDialog=null;if(next>=0)go(next)}});
  }
  function syncGeneration(){
    if(!host.isConnected)return;
    if(!promptDialog){if(state.mode==='game')redraw();return}
    if(gameJob.phase==='ready'&&state.mode==='game')showResult();
    else{promptDialog.showPrompt();promptDialog.update({value:state.prompt,busy:gameJob.phase==='loading',message:gameJob.phase==='loading'||['error','stopped'].includes(gameJob.phase)?gameJob.message:''})}
  }
  gameJob.onChange=syncGeneration;
  function showPrompt(forResult=false){
    if(promptDialog||!host.isConnected||!forResult&&state.mode!=='prompt')return;
    promptDialog=openPromptDialog({value:state.prompt,onInput:value=>{state.prompt=value;saveQuiz(slide,state)},onApply:value=>{state.prompt=value;return requestGeneratedGame(slide,state)},onStop:()=>gameJob.controller?.abort(),onClose:phase=>{promptDialog=null;state.mode=phase==='result'?'game':'review';saveQuiz(slide,state);redraw()},returnFocus:host.querySelector('.quiz-primary')});
  }
  function redraw(focusNext=false){draw();if(focusNext)host.querySelector('.quiz-primary')?.focus({preventScroll:true})}
  function draw(){
    host.replaceChildren();
    if(state.mode==='quiz'){
      const q=questions[state.position],answered=state.position<state.answered;
      const progress=node('quiz-progress');progress.append(node('','문제 '+(state.position+1)+' / '+total),node('','모은 문장 '+state.answered+' / '+total));
      const heading=document.createElement('h2');heading.className='quiz-question';heading.textContent=q.q;
      const options=node('quiz-options');options.setAttribute('role','group');options.setAttribute('aria-label','보기 네 개');
      const feedback=node('quiz-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
      if(answered){feedback.append(node('quiz-sentence-label','모은 문장'),node('quiz-sentence',state.sentences[state.position]||q.sentence))}else feedback.textContent='게임에서 본 모습을 떠올려 골라 보세요.';
      q.options.forEach((text,i)=>{
        const button=document.createElement('button');button.type='button';button.className='quiz-option';button.append(node('option-number',['①','②','③','④'][i]),node('',text));button.disabled=answered;button.setAttribute('aria-pressed',String(answered&&i===q.answer));
        if(answered&&i===q.answer)button.classList.add('correct');
        button.onclick=()=>{
          if(state.position<state.answered)return;
          if(i!==q.answer){for(const choice of options.children)choice.classList.remove('wrong');button.classList.add('wrong');feedback.classList.add('is-wrong');feedback.textContent='다시 살펴볼까요?\n'+q.hint;return}
          state.sentences[state.position]=q.sentence;state.answered=state.position+1;saveQuiz(slide,state);redraw(true);
        };options.append(button);
      });
      const footer=node('quiz-footer');
      const previous=quizButton('← 이전 문제',()=>{state.position--;saveQuiz(slide,state);redraw()});previous.disabled=state.position===0;
      const next=quizButton(state.position===total-1?'문장 '+total+'개 모아 보기 →':'다음 문제 →',()=>{if(state.position>=state.answered)return;if(state.position===total-1)state.mode='review';else state.position++;saveQuiz(slide,state);redraw()},true);next.disabled=!answered;
      footer.append(previous,next);host.append(progress,heading,options,feedback,footer);
    }else if(state.mode==='review'||state.mode==='prompt'){
      const heading=node('quiz-question','문장 '+total+'개를 모았어요');
      const instruction=node('quiz-instruction','문장을 읽고, 바꾸고 싶은 내용을 고쳐 보세요.');instruction.setAttribute('role','status');instruction.setAttribute('aria-live','polite');
      const list=node('quiz-review-list');list.setAttribute('aria-label','모은 문장 다듬기');
      const footer=node('quiz-footer');
      const reset=quizButton('처음부터 다시 풀기',()=>{if(conversion.busy)return;conversion.error='';Object.assign(state,freshQuizState());saveQuiz(slide,state);redraw()});reset.disabled=conversion.busy;
      const convert=quizButton(conversion.busy?'명령문으로 바꾸는 중…':'프롬프트로 바꾸기',async()=>{
        if(conversion.busy||state.sentences.some(text=>!text.trim()))return;
        if(state.prompt&&conversion.promptSource===JSON.stringify(state.sentences)){state.mode='prompt';saveQuiz(slide,state);showPrompt();return}
        const snapshot=state.sentences.slice();conversion.busy=true;conversion.error='';redraw();
        try{const prompt=await convertQuizPrompt(questions,snapshot);if(JSON.stringify(state.sentences)!==JSON.stringify(snapshot))throw Error('문장이 바뀌었어요. 다시 변환해 주세요.');state.prompt=prompt;state.mode='prompt';conversion.promptSource=JSON.stringify(snapshot);saveQuiz(slide,state)}
        catch(error){conversion.error=error.message||'문장을 변환하지 못했어요. 다시 시도해 주세요.'}
        finally{conversion.busy=false;conversion.onChange?.()}
      },true);
      function validate(){const empty=state.sentences.some(text=>!text.trim());convert.disabled=conversion.busy||empty;instruction.textContent=conversion.busy?'입력한 뜻을 살려 명령문으로 바꾸고 있어요…':conversion.error||(empty?'빈 문장이 있어요. 내용을 채워 주세요.':'문장을 읽고, 바꾸고 싶은 내용을 고쳐 보세요.')}
      questions.forEach((q,i)=>{const row=node('quiz-review-row');const input=document.createElement('textarea');input.className='quiz-review-input';input.setAttribute('aria-label','모은 문장 '+(i+1));input.maxLength=1000;input.rows=2;input.value=state.sentences[i]??q.sentence;input.disabled=conversion.busy;input.oninput=()=>{state.sentences[i]=input.value;conversion.error='';saveQuiz(slide,state);validate()};row.append(node('quiz-review-number',String(i+1).padStart(2,'0')),input);list.append(row)});
      validate();footer.append(reset,convert);host.append(heading,instruction,list,footer);
      if(state.mode==='prompt')queueMicrotask(showPrompt);
    }else if(state.mode==='game'){
      host.append(node('quiz-question',state.gameHtml?'내가 만든 공룡 게임':'게임 만들기'),node('quiz-instruction',gameJob.phase==='loading'?gameJob.message:'팝업에서 게임을 확인하고 다음 단계로 이동하세요.'));
      const footer=node('quiz-footer'),edit=quizButton('다시 만들기',()=>{state.mode='prompt';saveQuiz(slide,state);showPrompt()}),download=quizButton('HTML 다운로드',()=>downloadGameHtml(state.gameHtml)),view=quizButton('내 게임 보기',showResult,true);edit.disabled=gameJob.phase==='loading';download.disabled=!state.gameHtml;view.disabled=!state.gameHtml;footer.append(edit,download,view);host.append(footer);
    }
  }
  draw();return host;
}
