# 공룡게임 2

AI 셰르파 공룡 수업·교실 포털의 비공개 소스 저장소입니다. 승인된 트리케라톱스 러너, 16장 수업, 교실 관리와 작품 게시판을 포함합니다.

- 운영: https://ai-sherpa-dino-classroom.yoon2566.workers.dev/
- 수업: https://ai-sherpa-dino-classroom.yoon2566.workers.dev/lesson
- Node.js와 Cloudflare Wrangler CLI를 사용합니다. 외부 프로젝트 폴더 없이 빌드할 수 있습니다.

```powershell
node build-classroom.cjs
wrangler dev --config wrangler.jsonc
```

빌드 결과는 `.classroom-build/`에 있습니다. 이 폴더도 초기 백업에 포함했습니다. `wrangler.jsonc`는 공룡게임 2용 설정입니다. 기존 Cloudflare 계정의 D1·Durable Object 바인딩을 사용하며 DB 데이터와 로그인 세션은 저장소에 포함하지 않습니다. 운영 변경이 필요할 때만 인증된 계정으로 `wrangler deploy --config wrangler.jsonc --keep-vars`를 실행합니다. 이 저장소 생성 작업은 사이트를 재배포하지 않습니다.

서버 비밀값 `SHERPA_OPENROUTER_KEY`, `TEACHER_PASSWORD_HASH`는 Cloudflare Secrets에서 관리합니다. `.env`, `.dev.vars`, 키 파일, 런타임 저장소는 Git에 넣지 않습니다. 새 계정으로 옮길 때는 바인딩과 스키마 및 Secrets를 별도로 준비해야 합니다.

원본은 모두의AI라운지 프로젝트의 `25_PPT제작/PPT양식/HTML_템플릿`이며, 공룡 1·2 공유 폴더에서 공룡 2에 필요한 파일만 복사했습니다. 원본 작업 폴더와 Git 이력은 변경하지 않았습니다. 파일 출처는 `COPY_PROVENANCE.json`에 기록했습니다.
