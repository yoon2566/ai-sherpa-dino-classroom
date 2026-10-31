// Voice only fills the editable draft. Applying a prompt always needs another click.
function createFeedbackSpeech(root,onChange){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const fields=[];let active=null,busy=false,disposed=false;
  const errorMessages={
    'not-allowed':'마이크 사용이 허용되지 않았어요. 브라우저의 마이크 권한을 확인하거나 직접 입력해 주세요.',
    'service-not-allowed':'이 브라우저에서는 음성 인식을 사용할 수 없어요. 직접 입력해 주세요.',
    'audio-capture':'마이크를 찾지 못했어요. 마이크 연결을 확인해 주세요.',
    'network':'음성 인식 연결이 끊겼어요. 인터넷을 확인하거나 직접 입력해 주세요.',
    'no-speech':'목소리를 듣지 못했어요. 다시 누르고 말해 주세요.',
    'language-not-supported':'한국어 음성 인식을 지원하지 않아요. 직접 입력해 주세요.'
  };
  function refresh(){
    for(const field of fields){
      const listening=active?.field===field;
      field.button.textContent=listening?'■ 말하기 멈추기':'🎤 말로 입력';
      field.button.setAttribute('aria-label',field.label+(listening?' 말하기 멈추기':' 말로 입력'));
      field.button.setAttribute('aria-pressed',String(listening));
      field.button.disabled=busy||!Recognition||!window.isSecureContext||!!active&&!listening;
      field.input.readOnly=listening;
    }
  }
  function finish(session,message){
    if(active!==session)return;
    clearTimeout(session.timer);clearTimeout(session.stopTimer);active=null;
    if(message)session.field.status.textContent=message;
    refresh();if(!disposed)onChange?.();
  }
  function stop(){
    const session=active;if(!session||session.stopping)return;
    session.stopping=true;session.field.status.textContent='말하기를 마치고 있어요…';
    try{session.recognition.stop()}catch{finish(session,'입력된 글을 확인하고 수정해 주세요.')}
    session.stopTimer=setTimeout(()=>{
      if(active!==session)return;
      try{session.recognition.abort()}catch{}
      finish(session,'입력된 글을 확인하고 수정해 주세요.');
    },2000);
  }
  function start(field){
    if(disposed||busy||active||!Recognition||!window.isSecureContext)return;
    let recognition;try{recognition=new Recognition()}catch{field.status.textContent='음성 인식을 시작하지 못했어요. 직접 입력해 주세요.';return}
    const session={field,recognition,finals:new Set(),received:false};active=session;
    recognition.lang='ko-KR';recognition.continuous=true;recognition.interimResults=true;
    field.status.textContent='마이크를 준비하고 있어요…';refresh();onChange?.();
    recognition.onstart=()=>{if(active===session&&!disposed)field.status.textContent='듣고 있어요. 짧게 말한 뒤 멈추기를 눌러 주세요.'};
    recognition.onresult=event=>{
      if(active!==session||disposed||busy||!field.input.isConnected)return;
      let interim='',full=false;
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i],text=result[0]?.transcript?.trim()||'';
        if(!result.isFinal){interim+=text;continue}
        if(session.finals.has(i))continue;session.finals.add(i);if(!text)continue;
        const value=(field.input.value+(field.input.value&&!/\s$/.test(field.input.value)?' ':'')+text);
        field.input.value=value.slice(0,field.input.maxLength>0?field.input.maxLength:500);
        field.input.dispatchEvent(new Event('input',{bubbles:true}));session.received=true;
        full=value.length>=field.input.maxLength;
      }
      field.status.textContent=full?'500자까지 입력했어요. 글을 확인해 주세요.':interim?'인식 중: '+interim:'글로 입력했어요. 계속 말하거나 멈추기를 눌러 주세요.';
      if(full)stop();
    };
    recognition.onerror=event=>{
      if(active!==session||disposed)return;
      const message=errorMessages[event.error]||'음성 인식을 마쳤어요. 입력된 글을 확인하거나 직접 입력해 주세요.';
      try{recognition.abort()}catch{}finish(session,message);
    };
    recognition.onend=()=>{
      if(active!==session||disposed)return;
      finish(session,session.received?'입력된 글을 확인하고 수정한 뒤 프롬프트로 바꿔 주세요.':'인식된 글이 없어요. 다시 말하거나 직접 입력해 주세요.');
    };
    session.timer=setTimeout(stop,60000);
    try{recognition.start()}catch{finish(session,'음성 인식을 시작하지 못했어요. 다시 누르거나 직접 입력해 주세요.')}
  }
  return {
    get listening(){return !!active},
    attach(input,label){
      const wrapper=node('speech-input'),bar=node('speech-bar'),button=document.createElement('button'),status=node('speech-status');
      button.type='button';button.className='speech-button';button.setAttribute('aria-label',label+' 말로 입력');
      status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      status.textContent=!Recognition?'이 브라우저는 음성 입력을 지원하지 않아요. 직접 입력해 주세요.':!window.isSecureContext?'음성 입력은 localhost 또는 HTTPS에서 사용할 수 있어요.':'음성은 브라우저의 인식 서비스로 전송될 수 있어요. 입력 후 확인해 주세요.';
      const field={input,button,status,label};fields.push(field);button.onclick=()=>active?.field===field?stop():start(field);
      bar.append(button,status);wrapper.append(input,bar);refresh();return wrapper;
    },
    setBusy(value){busy=value;if(busy&&active){const session=active;try{session.recognition.abort()}catch{}finish(session,'입력된 글을 확인해 주세요.')}refresh()},
    dispose(){disposed=true;if(active){const session=active;active=null;clearTimeout(session.timer);clearTimeout(session.stopTimer);try{session.recognition.abort()}catch{}}}
  };
}
