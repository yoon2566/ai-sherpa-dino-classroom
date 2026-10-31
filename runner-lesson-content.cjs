// Shared content updates for standalone builds and the two existing deployments.
const updates={
  cover:{title:'바이브 코딩 게임 만들기\n엔드리스 러너',accent:'엔드리스 러너'},
  'game-intro':{caption:'원작의 규칙을 살펴보고, 다음 장의 새 공룡 게임을 해 봅니다.'},
  'play-game':{title:'트리케라톱스 질주 해보기',accent:'해보기',notes:'새로 만든 트리케라톱스 게임입니다. 달리기·점프·숙이기·비행 장애물과 거리 점수를 구현했습니다.'}
};
function updateDeck(deck,gameDocument){
  deck.assets.gameDocument=gameDocument;
  for(const slide of [...deck.slides,...Object.values(deck.presets||{})]){
    if(updates[slide.id])Object.assign(slide,updates[slide.id]);
    if(slide.id==='game-sentences')for(const q of slide.questions)q.hint=q.hint.replaceAll('선인장','장애물');
  }
  return deck;
}
module.exports={updateDeck};
