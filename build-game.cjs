const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function replaceOnce(text,from,to){
  if(text.split(from).length!==2)throw Error('Expected one runner integration anchor: '+from);
  return text.replace(from,to);
}
function webpDimensions(bytes){
  if(bytes.length<30||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Invalid triceratops WebP');
  for(let offset=12;offset+8<=bytes.length;){
    const kind=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;
    if(start+size>bytes.length)throw Error('Truncated triceratops WebP');
    if(kind==='VP8L'&&size>=5&&bytes[start]===0x2f){const bits=bytes.readUInt32LE(start+1);return[1+(bits&0x3fff),1+((bits>>>14)&0x3fff)];}
    if(kind==='VP8X'&&size>=10)return[1+bytes.readUIntLE(start+4,3),1+bytes.readUIntLE(start+7,3)];
    offset=start+size+(size%2);
  }
  throw Error('Unsupported triceratops WebP header');
}
module.exports=function buildGame(){
  const source=fs.readFileSync(path.join(dir,'assets','source-runner.html'),'utf8');
  const atlas=fs.readFileSync(path.join(dir,'assets','triceratops.webp'));
  const adapter=fs.readFileSync(path.join(dir,'game-adapter.js'),'utf8');
  const dimensions=webpDimensions(atlas);
  if(dimensions[0]!==704||dimensions[1]!==94)throw Error('Triceratops atlas must be 704 x 94');
  const uri='data:image/webp;base64,'+atlas.toString('base64');
  let output=replaceOnce(source,"const dinosaurAtlasSource='assets/triceratops.webp';",'const dinosaurAtlasSource='+JSON.stringify(uri)+';');
  // A single embedded atlas keeps srcdoc independent of the parent URL. The
  // approved procedural character still handles unsupported/failed image loads.
  output=replaceOnce(output,"const sources=[...new Set([dinosaurAtlasSource,'assets/triceratops.png'])];",'const sources=[dinosaurAtlasSource];');
  const closing=output.lastIndexOf('})();');
  if(closing<0)throw Error('Runner closure boundary not found');
  output=output.slice(0,closing)+'\n'+adapter+'\n'+output.slice(closing);
  const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'\">";
  output=replaceOnce(output,'<meta charset="utf-8">','<meta charset="utf-8">\n'+csp);
  const scripts=[...output.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if(scripts.length!==1)throw Error('Expected one self-contained runner script');
  new Function(scripts[0][1]);
  if(/assets\/triceratops\.(?:webp|png)/.test(output))throw Error('Unembedded character dependency');
  const reference={url:'https://github.com/wayou/t-rex-runner',commit:'5455bfa408ec6b707c7300ff194b7390733a766d',license:'BSD-3-Clause',usage:'Numeric mechanics and collision reference only; upstream runtime and visual/audio assets are not bundled.'};
  const provenance={implementation:'Independent Canvas runner',source:'assets/source-runner.html',approvedPrototype:'50_저작권확인/독자게임_v2/runner.html',sourceSha256:sha256(source),adapter:'game-adapter.js',adapterSha256:sha256(adapter),reference,artwork:{file:'assets/triceratops.webp',sha256:sha256(atlas),bytes:atlas.length,width:704,height:94,frames:8,source:'Approved triceratops design 1; newly generated animation atlas',embedded:true},changes:'Embed the approved WebP and add the lounge-dino parent controls inside the copied runner closure. Approved physics, collision, rendering and input functions are unchanged.',outputSha256:sha256(output)};
  fs.writeFileSync(path.join(dir,'game-provenance.json'),JSON.stringify(provenance,null,2)+'\n','utf8');
  const notice=[
    '공룡 게임 — 실행 코드와 자산 출처',
    '',
    '이 실행 파일은 승인된 독자게임_v2/runner.html의 별도 Canvas 구현을 사용합니다.',
    '보관된 원본: assets/source-runner.html',
    '원본 SHA-256: '+provenance.sourceSha256,
    '수업 조작 연결: game-adapter.js (lounge-dino 메시지 및 페이지 이동)',
    '캐릭터: 승인된 트리케라톱스 1번 디자인을 바탕으로 새로 생성한 8프레임 시트.',
    '이미지: assets/triceratops.webp / 704×94 / 실행 HTML에 내장.',
    '배경·장애물·숫자는 자체 Canvas 도형이며 효과음은 Web Audio 합성입니다.',
    '',
    '게임 수치와 충돌 좌표 검증에 참고한 프로젝트:',
    reference.url,
    'Commit: '+reference.commit,
    '참고 프로젝트 라이선스: '+reference.license,
    '참고 원본의 실행 코드·스프라이트·이미지·음원·폰트는 이 실행 파일에 포함하지 않습니다.',
    '참고 프로젝트의 라이선스 표기는 독자 구현이나 생성 이미지의 별도 라이선스 부여가 아닙니다.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir,'게임_출처와라이선스.txt'),notice,'utf8');
  return output;
};
