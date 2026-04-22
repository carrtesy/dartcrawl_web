# dartcrawl-web

GitHub Pages에 올릴 정적 프런트엔드와, DART 본문을 대신 읽어 줄 서버리스 Worker 초안입니다.

프로젝트 페이지 기준 목표 주소:

- `https://carrtesy.github.io/dartcrawl_web/`

## 구성

- `index.html`, `styles.css`, `app.js`
  - GitHub Pages에 그대로 올릴 수 있는 정적 화면
- `worker/index.js`
  - DART 보고서 URL을 받아 상세표를 Excel XML `.xls` 파일로 반환하는 Worker
- `worker/wrangler.toml`
  - Cloudflare Workers 배포용 최소 설정

## 왜 이렇게 나눴나

GitHub Pages는 정적 호스팅이라 브라우저에서 `https://dart.fss.or.kr/...`를 직접 읽으면 CORS 제한을 받을 가능성이 큽니다. 그래서:

1. GitHub Pages는 입력 폼과 다운로드 UI 담당
2. Worker는 DART 요청과 표 파싱 담당

## 프런트엔드 배포

정적 파일은 루트 그대로 GitHub Pages에 배포하면 됩니다.

이 저장소에는 `.github/workflows/deploy-pages.yml`이 포함되어 있어서, GitHub 저장소 이름을 `dartcrawl_web`로 만들고 `main` 브랜치에 푸시하면 Pages 배포에 바로 사용할 수 있습니다.

### 사용 방법

1. `index.html`, `styles.css`, `app.js`를 GitHub Pages에 올립니다.
2. 사이트를 열고 `API 엔드포인트`에 Worker 주소를 넣습니다.
3. DART 사업보고서 URL을 붙여 넣고 `엑셀 다운로드`를 누릅니다.

현재 목표 예시:

- 페이지 주소: `https://carrtesy.github.io/dartcrawl_web/`
- Worker 주소: `https://dartcrawl-export-worker.<subdomain>.workers.dev/api/export`

## Worker 배포

Cloudflare Workers 기준 예시입니다.

1. `worker/` 폴더를 별도 프로젝트로 배포합니다.
2. 배포 후 생성된 URL의 `/api/export`를 GitHub Pages 화면에 넣습니다.

이 저장소에는 GitHub Actions용 Worker 배포 워크플로도 포함되어 있습니다.

- 워크플로: `.github/workflows/deploy-worker.yml`
- 설정 가이드: [CLOUDFLARE_SETUP.md](C:/Users/osa66/ChatChinese/dartcrawl-web/CLOUDFLARE_SETUP.md)

헬스체크:

- `GET /api/health`

내보내기:

- `POST /api/export`
- JSON body:

```json
{
  "reportUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250312001148"
}
```

## 현재 구현 범위

Worker는 기존 `../dartcrawl/dart_detail_tables.py` 흐름을 순수 JS로 옮긴 버전입니다.

- `main.do?rcpNo=...`에서 `XII. 상세표` 목차를 찾음
- `viewer.do`로 상세표 본문을 가져옴
- 아래 표를 추출함
  - 연결대상 종속회사 현황
  - 계열회사 현황
  - 타법인출자 현황
- 결과를 여러 시트의 Excel XML `.xls` 파일로 응답함

## 참고

- 현재 출력 형식은 의존성 없이 배포하기 쉬운 Excel XML `.xls`입니다.
- 나중에 Node 환경을 붙일 수 있으면 `.xlsx`로 바꾸는 것도 가능합니다.
- DART HTML 구조가 바뀌면 Worker의 정규식/파싱 로직을 함께 손봐야 합니다.
