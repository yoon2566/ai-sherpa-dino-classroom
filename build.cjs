const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const png=name=>'data:image/png;base64,'+fs.readFileSync(path.join(dir,'assets',name)).toString('base64');
const cover=png('cover-art.png'),practice=png('practice-example.png');
const presets={
cover:{id:'cover',type:'cover',brand:'',title:'바이브 코딩으로\n공룡 게임 만들기',accent:'공룡 게임',body:'게임을 직접 해 보고,\nAI와 함께 만들어 봅니다.'},
explanation:{id:'explanation',type:'explanation',title:'바이브 코딩이란?',accent:'이란?',body:'만들고 싶은 것을 말로 설명하고,\nAI와 함께 실행하고 수정합니다.',flow:['관찰','문장','프롬프트','실행']},
prompt:{id:'prompt',type:'prompt',title:'1단계 · 점프 만들기',accent:'점프',body:'스페이스바를 누르면 공룡이 점프했다가\n바닥으로 내려오게 해 줘.\n공중에서는 다시 점프하지 않게 해 줘.',caption:'입력한 뒤, 미리보기에서 실행하세요.'},
practice:{id:'practice',type:'practice',title:'점프 확인하기',accent:'점프',steps:['게임 화면을 클릭하세요.','스페이스바를 누르세요.','바닥으로 돌아오는지\n확인하세요.'],exampleScore:true}
};
const goals={id:'goals',type:'goals',title:'학습목표',accent:'학습',goals:['게임을 관찰하고 게임 구성 요소를 문장으로 적어본다','문장을 인공지능 프롬프트로 만들어본다','인공지능을 활용하여 게임을 만들어본다']};
const gameIntro={id:'game-intro',type:'gameIntro',title:'구글 크롬 공룡 게임',accent:'공룡 게임',body:'인터넷 연결이 끊겼을 때\n크롬에서 만나는 게임입니다.',caption:'스페이스바로 점프하며 장애물을 피합니다.',notes:'게임 소개 및 이미지 출처: Google 공식 블로그, As the Chrome dino runs, we caught up with the Googlers who built it (2018-09-06). https://blog.google/products-and-platforms/products/chrome/chrome-dino/ | 이미지: https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/Dino_non-birthday_version.gif'};
const chromeDino='data:image/gif;base64,'+fs.readFileSync(path.join(dir,'assets','chrome-dino-official.gif')).toString('base64');
const playGame={id:'play-game',type:'playGame',title:'공룡 게임 해보기',accent:'해보기',caption:'스페이스바·↑ 점프　 /　 ↓ 숙이기　 /　 Enter 다시 시작',notes:'Chromium에서 추출한 wayou/t-rex-runner를 이 HTML에 포함했습니다. https://github.com/wayou/t-rex-runner | BSD-3-Clause 라이선스와 저작권 고지는 내장 게임 문서에 포함됩니다.'};
const gameDocument=require('./build-game.cjs')();
const quiz={id:'game-sentences',type:'quiz',title:'게임을 문장으로',accent:'문장으로',questions:require('./quiz-questions.cjs')};
const feedback={id:'game-feedback',type:'feedback',title:'게임 오류 고치기',accent:'오류',questionVersion:3,questions:require('./error-questions.cjs')};
const design={id:'character-design',type:'design',title:'게임 디자인 바꾸기',accent:'디자인',questions:[{q:'주인공을 어떤 모습으로 바꿀까요?',issues:[{label:'고양이',request:'주인공을 귀와 꼬리가 있는 고양이 모습으로 바꿔 줘.'},{label:'로봇',request:'주인공을 얼굴과 팔다리가 있는 로봇 모습으로 바꿔 줘.'}]}]};
const background={id:'background-design',type:'design',title:'게임 배경 바꾸기',accent:'배경',questions:[{q:'배경을 어디로 바꿀까요?',issues:[{label:'숲속',request:'게임 화면의 배경을 나무와 풀, 하늘이 보이는 숲속으로 바꿔 줘.'},{label:'우주',request:'게임 화면의 배경을 별과 행성이 보이는 우주로 바꿔 줘.'}]}]};
const obstacle={id:'obstacle-design',type:'design',title:'게임 장애물 바꾸기',accent:'장애물',questions:[{q:'어떤 장애물을 피하게 할까요?',issues:[{label:'바위',request:'장애물을 울퉁불퉁한 바위 모습으로 바꿔 줘.'},{label:'상자',request:'장애물을 나뭇결과 테두리가 보이는 나무 상자 모습으로 바꿔 줘.'}]}]};
const enhancements=require('./enhancement-stages.cjs');
const sharing={id:'game-sharing',type:'sharing',title:'내 게임 공유하기',accent:'공유하기'};
const lessonPresets={cover:presets.cover,goals,explanation:presets.explanation,gameIntro,playGame,quiz,feedback,design,background,obstacle,...Object.fromEntries(enhancements.map(stage=>[stage.id,stage])),sharing};
const deck={id:'vibe-lesson-intro-three-pages-20261023',schemaVersion:13,updatedAt:0,activeId:'cover',assets:{cover,practice,chromeDino,gameDocument},presets:lessonPresets,slides:Object.values(lessonPresets).map(s=>structuredClone(s))};
require('./runner-lesson-content.cjs').updateDeck(deck,gameDocument);
const source=fs.readFileSync(path.join(dir,'template-shell.html'),'utf8');
const fontFile=path.join(dir,'assets','NotoSansKR-VF.ttf');if(!fs.existsSync(fontFile))fs.copyFileSync('C:/Windows/Fonts/NotoSansKR-VF.ttf',fontFile);
const font=fs.readFileSync(fontFile).toString('base64');
const output=source.replace('__LESSON_STORAGE__',()=>fs.readFileSync(path.join(dir,'lesson-storage.js'),'utf8')).replace("__RUNNER_LESSON_REFRESH__",()=>fs.readFileSync(path.join(dir,"runner-lesson-refresh.js"),"utf8")).replace('__FONT_DATA__',font).replace('__QUIZ_CSS__',()=>fs.readFileSync(path.join(dir,'quiz-activity.css'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'error-activity.css'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'sharing-activity.css'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'classroom-lesson.css'),'utf8')).replace('__QUIZ_RUNTIME__',()=>['prompt-dialog.js','prompt-conversion.js','game-generation.js','quiz-activity.js','speech-input.js','error-activity.js','sharing-activity.js','classroom-client.js'].map(file=>fs.readFileSync(path.join(dir,file),'utf8')).join('\n')).replace('__DECK_DATA__',()=>JSON.stringify(deck).replace(/</g,'\\u003c'));
const target=path.join(dir,'모두의AI라운지_HTML템플릿.html');
const backup=path.join(dir,'기본4종_템플릿.html');if(!fs.existsSync(backup)&&fs.existsSync(target))fs.copyFileSync(target,backup);
fs.writeFileSync(target,output,'utf8');const lesson=path.join(dir,'AI셰르파_수업16장.html');fs.writeFileSync(lesson,output,'utf8');const deployDir=path.join(dir,'cloudflare');fs.mkdirSync(deployDir,{recursive:true});fs.writeFileSync(path.join(deployDir,'index.html'),output,'utf8');for(const file of ['board.html','board.js'])fs.copyFileSync(path.join(dir,file),path.join(deployDir,file));new Function(output.match(/<script>([\s\S]*?)<\/script>/)[1]);console.log(JSON.stringify({path:lesson,deploy:path.join(deployDir,'index.html'),bytes:Buffer.byteLength(output),slides:deck.slides.length,standaloneUi:true,aiRequiresServer:true}));
