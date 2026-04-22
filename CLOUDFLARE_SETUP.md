# Cloudflare Worker 배포

이 프로젝트의 실제 엑셀 변환은 `worker/` 폴더의 Cloudflare Worker가 담당합니다.

## 1. Cloudflare에서 준비할 것

Cloudflare 계정이 있어야 합니다.

필요한 값:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 2. GitHub 저장소에 Secrets 넣기

저장소 `carrtesy/dartcrawl_web`에서 아래 위치로 들어갑니다.

- `Settings > Secrets and variables > Actions`

추가할 Repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 3. Worker 이름 확인

현재 [worker/wrangler.toml](C:/Users/osa66/ChatChinese/dartcrawl-web/worker/wrangler.toml)의 이름은 아래와 같습니다.

```toml
name = "dartcrawl-export-worker"
```

배포되면 기본 주소는 대체로 아래 형태입니다.

```text
https://dartcrawl-export-worker.<your-subdomain>.workers.dev
```

실제 API 주소는:

```text
https://dartcrawl-export-worker.<your-subdomain>.workers.dev/api/export
```

헬스체크 주소는:

```text
https://dartcrawl-export-worker.<your-subdomain>.workers.dev/api/health
```

## 4. GitHub Actions로 배포

저장소 `Actions` 탭에서:

1. `Deploy Cloudflare Worker` 워크플로 선택
2. `Run workflow` 실행

또는 `worker/` 아래 파일을 수정해서 `main`에 푸시해도 자동 배포됩니다.

## 5. GitHub Pages 화면에 연결

배포가 끝나면 아래 페이지로 접속합니다.

```text
https://carrtesy.github.io/dartcrawl_web/
```

그리고 `API 엔드포인트` 칸에 다음 형식의 주소를 넣습니다.

```text
https://dartcrawl-export-worker.<your-subdomain>.workers.dev/api/export
```

## 6. 동작 확인

먼저 브라우저에서 헬스체크를 확인합니다.

- `GET /api/health`

정상 예시:

```json
{
  "ok": true,
  "service": "dartcrawl-export-worker"
}
```

그다음 GitHub Pages 화면에서 DART 보고서 링크를 넣고 엑셀 다운로드를 시도하면 됩니다.

## 참고

- 이 환경에서는 `wrangler`가 설치되어 있지 않아 로컬에서 바로 배포하지는 못했습니다.
- 대신 GitHub Actions로 배포할 수 있게 워크플로를 추가했습니다.
