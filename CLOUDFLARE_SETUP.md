# Cloudflare 배포 가이드

이 프로젝트는 Cloudflare Workers Static Assets 방식으로 배포합니다.

즉:

- `public/`은 정적 사이트로 배포
- `src/index.js`와 `worker/index.js`는 API Worker로 배포

둘 다 `wrangler deploy` 한 번으로 같이 올라갑니다.

## 1. Cloudflare에서 준비할 것

필요한 값:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 2. GitHub Actions Secrets 설정

저장소 `carrtesy/dartcrawl_web`에서:

- `Settings > Secrets and variables > Actions`

아래 secrets를 추가합니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 3. 앱 이름 확인

현재 루트 [wrangler.toml](C:/Users/osa66/ChatChinese/dartcrawl-web/wrangler.toml) 설정:

```toml
name = "dartcrawl-web"
main = "src/index.js"

[assets]
directory = "./public"
run_worker_first = ["/api/*"]
```

배포 후 기본 주소는 대체로 아래 형태입니다.

```text
https://dartcrawl-web.<your-subdomain>.workers.dev
```

예시 경로:

- 메인 화면: `https://dartcrawl-web.<your-subdomain>.workers.dev/`
- 검색 API: `https://dartcrawl-web.<your-subdomain>.workers.dev/api/search-companies`
- 엑셀 API: `https://dartcrawl-web.<your-subdomain>.workers.dev/api/export`

## 4. GitHub Actions로 배포

저장소 `Actions` 탭에서:

1. `Deploy Cloudflare App` 워크플로 선택
2. `Run workflow` 실행

또는 아래 파일들이 바뀐 채로 `main`에 푸시되면 자동 배포됩니다.

- `public/**`
- `src/**`
- `worker/**`
- `wrangler.toml`

## 5. 로컬 실행

Cloudflare 방식 전체를 보려면:

```bash
wrangler dev
```

브라우저:

```text
http://127.0.0.1:8787
```

## 6. 헬스체크

먼저 아래 주소를 열어 Worker가 정상인지 확인합니다.

```text
https://dartcrawl-web.<your-subdomain>.workers.dev/api/health
```

정상 예시:

```json
{
  "ok": true,
  "service": "dartcrawl-export-worker"
}
```

## 참고

- 이 환경에는 `wrangler`가 설치되어 있지 않아 여기서 직접 Cloudflare 배포까지 실행하지는 못했습니다.
- 대신 GitHub Actions에서 바로 배포할 수 있게 워크플로를 맞춰두었습니다.
