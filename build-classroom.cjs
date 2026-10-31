const fs=require('node:fs'),path=require('node:path');
require('./build.cjs');
let source=fs.readFileSync(path.join(__dirname,'AI셰르파_수업16장.html'),'utf8');
const dataTag=/<script id="deck-data" type="application\/json">([\s\S]*?)<\/script>/;
const deck=JSON.parse(source.match(dataTag)[1]);
fs.writeFileSync(path.join(__dirname,'classroom-deck.mjs'),'export const slides='+JSON.stringify(deck.slides.map(({id,title})=>({id,title})))+';\n');
const output=path.join(__dirname,'.classroom-build');fs.mkdirSync(output,{recursive:true});
const font=source.match(/src:url\(data:font\/ttf;base64,([A-Za-z0-9+/=]+)\)/);
if(!font)throw Error('내장 글꼴을 찾지 못했습니다.');
const webFont=path.join(__dirname,'assets','Lounge-Korean.woff2');
if(fs.existsSync(webFont)){
  fs.copyFileSync(webFont,path.join(output,'lesson-font.woff2'));source=source.replace(font[0]+" format('truetype')","src:url(/lesson-font.woff2) format('woff2')");
  const unused=path.join(output,'lesson-font.ttf');if(fs.existsSync(unused))fs.unlinkSync(unused);
}else{fs.writeFileSync(path.join(output,'lesson-font.ttf'),Buffer.from(font[1],'base64'));source=source.replace(font[0],'src:url(/lesson-font.ttf)')}
for(const name of ['cover','practice','chromeDino']){
  const image=/^data:image\/(\w+);base64,([\s\S]+)$/.exec(deck.assets[name]);if(!image)throw Error('내장 이미지를 찾지 못했습니다: '+name);
  const file='lesson-'+name+'.'+image[1];fs.writeFileSync(path.join(output,file),Buffer.from(image[2],'base64'));deck.assets[name]='/'+file;
}
source=source.replace(dataTag,()=>'<script id="deck-data" type="application/json">'+JSON.stringify(deck).replace(/</g,'\\u003c')+'</script>');
fs.writeFileSync(path.join(output,'lesson.html'),source);
const assets={'index.html':'lounge-portal.html','lounge-portal.css':'lounge-portal.css','lounge-portal.js':'lounge-portal.js','board.html':'board.html','board.js':'board.js'};
for(const [name,file] of Object.entries(assets))fs.copyFileSync(path.join(__dirname,file),path.join(output,name));
console.log(JSON.stringify({classroomAssets:output,slides:deck.slides.length,lessonHtmlBytes:Buffer.byteLength(source),files:fs.readdirSync(output)}));
