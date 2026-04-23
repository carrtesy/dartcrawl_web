# dartcrawl-web

Cloudflare Workers Static Assets 방식으로 프런트와 API를 한 번에 배포하는 DART 검색/엑셀 추출 앱입니다.

## 구조

- `public/`
  - 브라우저에 그대로 배포되는 정적 자산
- `src/index.js`
  - Cloudflare Worker 진입점
- `worker/index.js`
  - DART 검색, 보고서 파싱, 엑셀 생성 로직
- `wrangler.toml`
  - Cloudflare 배포 설정

## 배포 방식

이 프로젝트는 GitHub Pages를 쓰지 않습니다.

Cloudflare에서 아래 두 가지를 한 번에 배포합니다.

1. `public/` 정적 화면
2. `/api/search-companies`, `/api/export` Worker API

Cloudflare 공식 문서상 Static Assets를 사용하면 Worker 코드와 정적 자산을 한 번의 배포로 묶을 수 있습니다. 참고: [Cloudflare Static Assets docs](https://developers.cloudflare.com/workers/static-assets/), [Wrangler configuration docs](https://developers.cloudflare.com/workers/wrangler/configuration/)

## 현재 라우팅

- `/`
  - 기업 검색 화면
- `/api/search-companies`
  - 기업 검색 API
- `/api/export`
  - 엑셀 생성 API
- `/api/health`
  - 헬스체크

`wrangler.toml`에서 `/api/*`는 Worker가 먼저 처리하고, 나머지는 정적 자산을 우선 서빙하도록 설정했습니다.

## 로컬 개발

권장:

```bash
wrangler dev
```

그다음 브라우저에서:

```text
http://127.0.0.1:8787
```

정적 파일만 잠깐 확인하려면:

```bash
py -m http.server 8000
```

하지만 이 경우 `/api/*`는 동작하지 않습니다. 검색과 엑셀 추출까지 보려면 `wrangler dev`가 필요합니다.

## 배포

직접 배포:

```bash
wrangler deploy
```

GitHub Actions 배포:

- 워크플로: `.github/workflows/deploy-worker.yml`
- 필요한 secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

자세한 설정은 [CLOUDFLARE_SETUP.md](C:/Users/osa66/ChatChinese/dartcrawl-web/CLOUDFLARE_SETUP.md)에 정리했습니다.

## 현재 기능

- 기업명으로 DART 검색
- 최신 사업보고서 링크 리스트 표시
- 기업 선택 시 보고서 링크 자동 반영
- DART 상세표를 Excel XML `.xls`로 다운로드

## 참고

- 현재 엑셀 출력 형식은 라이브러리 없이 바로 생성 가능한 Excel XML `.xls`입니다.
- DART HTML 구조가 바뀌면 `worker/index.js`의 파싱 로직도 같이 수정해야 합니다.
