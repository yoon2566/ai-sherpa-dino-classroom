function createLessonStorage(storage,room='',sample=false){
  const prefix=(sample?'dino-local-feedback:':'')+(room?'sherpa-room-'+room.toUpperCase()+':':'');
  return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};
}
const lessonStorage=createLessonStorage(localStorage,new URLSearchParams(location.search).get('room')||'',location.pathname==='/feedback-test');
