// Update only old lesson defaults. Keep learner answers, prompts and generated games.
{
  const previous={
    cover:{title:'바이브 코딩으로\n공룡 게임 만들기',accent:'공룡 게임'},
    'game-intro':{caption:'스페이스바로 점프하며 장애물을 피합니다.'},
    'play-game':{title:'공룡 게임 해보기',notes:'Chromium에서 추출한 wayou/t-rex-runner를 이 HTML에 포함했습니다. https://github.com/wayou/t-rex-runner | BSD-3-Clause 라이선스와 저작권 고지는 내장 게임 문서에 포함됩니다.'}
  };
  for(const slide of [...deck.slides,...Object.values(deck.presets||{})]){
    const fresh=embedded.slides.find(s=>s.id===slide.id);if(!fresh)continue;
    const prior=previous[slide.id]||{},customTitle=prior.title&&slide.title!==prior.title&&slide.title!==fresh.title;
    for(const [key,value] of Object.entries(prior))if(!(key==='accent'&&customTitle)&&slide[key]===value)slide[key]=fresh[key];
    if(slide.id==='game-sentences'&&Array.isArray(slide.questions))slide.questions.forEach((question,i)=>{
      if(question.hint?.includes('선인장')&&question.hint.replaceAll('선인장','장애물')===fresh.questions[i]?.hint)question.hint=fresh.questions[i].hint;
    });
  }
}
