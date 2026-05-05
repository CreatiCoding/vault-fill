# vault-fill

HashiCorp Vault를 백엔드로 사용하는 브라우저 비밀번호 자동완성 Chrome 확장 프로그램.

Yarn Berry PnP 기반 모노레포로 구성되어 있습니다.

---

## 기능

- Vault KV v2에 저장된 크리덴셜을 브라우저 로그인 폼에 자동 입력
- 현재 탭 URL과 시크릿의 `url` 필드를 매칭해 관련 크리덴셜 자동 표시
- 팝업 UI에서 검색 및 클립보드 복사 지원
- 별도 비밀번호 DB 없이 기존 Vault를 그대로 활용

---

## Vault 시크릿 구조

확장이 인식하는 KV v2 포맷:

```
secret/data/web/github.com
  username = "myid"
  password = "mypassword"
  url      = "https://github.com"   ← URL 매칭 기준
```

기존 시크릿에 `url` 필드만 추가하면 동작합니다.

---

## 프로젝트 구조

```
vault-fill/
├── package.json              # 루트 워크스페이스 (yarn berry 4.6)
├── .yarnrc.yml               # PnP 설정
└── services/
    └── extension/            # Chrome Extension (Manifest V3)
        ├── src/
        │   ├── manifest.json
        │   ├── background/   # 서비스 워커 — Vault API, 메시지 허브
        │   ├── content/      # 폼 감지 + 자동완성 주입
        │   ├── popup/        # Preact UI (Matched / Search 탭)
        │   └── lib/          # vault.ts, storage.ts, matcher.ts, types.ts
        ├── src/__tests__/
        │   ├── unit/         # vitest 유닛 테스트 (38개)
        │   └── e2e/          # Playwright E2E 테스트
        ├── vite.config.ts
        ├── vitest.config.ts
        └── playwright.config.ts
```

---

## 시작하기

### 요구사항

- Node.js 22+
- Corepack 활성화: `corepack enable`

### 설치

```bash
corepack yarn install
```

### 빌드

```bash
corepack yarn build
```

`services/extension/dist/` 디렉토리가 생성됩니다.

### 크롬에 설치

1. `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `services/extension/dist/` 디렉토리 선택

---

## 개발

```bash
# watch 모드 빌드 (저장 시 자동 재빌드)
corepack yarn dev
```

---

## 테스트

### 유닛 테스트 (vitest)

```bash
corepack yarn test            # 단발 실행
corepack yarn test:watch      # watch 모드
corepack yarn test:ui         # 브라우저 UI
corepack yarn test:coverage   # 커버리지 리포트
```

| 파일 | 테스트 수 | 내용 |
|------|----------|------|
| `matcher.test.ts` | 11 | URL 매칭 로직, 점수 정렬 |
| `storage.test.ts` | 5 | chrome.storage 래퍼 |
| `vault.test.ts` | 8 | Vault KV API (fetch mock) |
| `Setup.test.tsx` | 6 | 설정 폼 컴포넌트 |
| `CredentialList.test.tsx` | 8 | 크리덴셜 목록 컴포넌트 |

### E2E 테스트 (Playwright)

빌드 후 실제 Chrome에 익스텐션을 로드해 실행합니다.

```bash
corepack yarn test:e2e        # 빌드 + E2E 실행
corepack yarn test:e2e:ui     # Playwright UI 모드
```

### 전체 테스트

```bash
corepack yarn test:all
```

---

## 기술 스택

| 항목 | 선택 |
|------|------|
| 플랫폼 | Chrome Extension (Manifest V3) |
| UI | Preact |
| 빌드 | Vite + vite-plugin-web-extension |
| Vault 통신 | Vault HTTP API (KV v2) |
| 저장소 | `chrome.storage.local` |
| 패키지 매니저 | Yarn Berry 4.6 (PnP) |
| 유닛 테스트 | vitest + happy-dom + jest-webextension-mock |
| E2E 테스트 | Playwright |

---

## 보안 모델

- 비밀번호는 백그라운드 서비스 워커에서만 보유 — 팝업에는 전달하지 않음
- 자동완성 시 백그라운드가 크리덴셜을 직접 콘텐츠 스크립트에 주입
- 토큰은 `chrome.storage.local` 저장 (HTTPS Vault 엔드포인트만 허용)
- 팝업이 닫히면 메모리 내 시크릿 즉시 폐기

---

## Chrome Web Store 배포

### 사전 준비

1. [Google Developer Dashboard](https://chrome.google.com/webstore/devconsole) 계정 등록 (최초 1회 $5 등록비)
2. 아이콘 준비: `public/icons/` 에 PNG 형식으로
   - `icon16.png` (16×16)
   - `icon48.png` (48×48)
   - `icon128.png` (128×128)
3. 스크린샷 최소 1장 (1280×800 또는 640×400)

### 1. 프로덕션 빌드

```bash
corepack yarn build
```

`services/extension/dist/` 디렉토리가 생성됩니다.

### 2. ZIP 패키징

```bash
cd services/extension/dist
zip -r ../vault-fill.zip .
```

또는 프로젝트 루트에서:

```bash
cd services/extension && zip -r vault-fill.zip dist/
```

> `dist/` 디렉토리 안의 파일들을 직접 압축해야 합니다. `dist/` 폴더 자체를 압축하면 업로드 시 오류가 납니다.

### 3. Developer Dashboard 업로드

1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속
2. **새 항목 추가** 클릭
3. `vault-fill.zip` 업로드
4. 스토어 등록 정보 작성:
   - 설명, 카테고리 (`생산성`), 언어
   - 스크린샷, 프로모션 이미지 업로드
5. **개인정보 처리방침** URL 입력 (필수)
6. **권한 정당성** 작성 — 요청한 권한(`storage`, `activeTab`, `tabs`)의 사용 목적 명시

### 4. 심사 제출

- **검토를 위해 제출** 클릭
- 최초 심사: 영업일 기준 1~3일 소요
- 업데이트 심사: 수 시간 ~ 1일

### 업데이트 배포

```bash
# 1. package.json 과 manifest.json 의 version bump
# 2. 재빌드
corepack yarn build

# 3. 재패키징
cd services/extension && zip -r vault-fill.zip dist/

# 4. Dashboard → 기존 항목 선택 → 패키지 업로드 → 새 ZIP 업로드 → 제출
```

### 심사 거절 주요 사유 및 대응

| 사유 | 대응 |
|------|------|
| 과도한 권한 요청 | `host_permissions`를 `<all_urls>` 대신 특정 도메인으로 제한 |
| 개인정보 처리방침 미비 | 외부 URL 또는 GitHub Pages로 정책 페이지 추가 |
| 원격 코드 실행 | `eval`, `new Function()` 사용 금지 (이미 준수) |
| 설명과 기능 불일치 | 스토어 설명에 Vault 연동 방식 명확히 기재 |

---

### CLI 배포 (chrome-webstore-upload-cli)

대시보드 UI 대신 CLI로 업로드 및 게시할 수 있습니다. CI/CD 파이프라인에 적합합니다.

#### 패키지 설치

```bash
npm install -g chrome-webstore-upload-cli
```

#### Google Cloud 인증 설정

Chrome Web Store API는 OAuth2를 사용합니다. 최초 1회 설정이 필요합니다.

1. [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보
2. **OAuth 2.0 클라이언트 ID** 생성 (애플리케이션 유형: **데스크톱 앱**)
3. `CLIENT_ID`, `CLIENT_SECRET` 메모
4. Refresh Token 발급:

```bash
npx chrome-webstore-upload-cli@latest init
# → 브라우저가 열리고 Google 계정 인증 후 REFRESH_TOKEN 출력
```

5. 환경변수 저장 (`.env` 또는 CI secrets):

```bash
EXTENSION_ID=abcdefghijklmnopqrstuvwxyz  # 대시보드 URL의 확장 ID
CLIENT_ID=xxxx.apps.googleusercontent.com
CLIENT_SECRET=xxxx
REFRESH_TOKEN=xxxx
```

#### 업로드 (심사 대기 상태로만 등록)

```bash
corepack yarn build
cd services/extension && zip -r vault-fill.zip dist/

chrome-webstore-upload upload \
  --source vault-fill.zip \
  --extension-id $EXTENSION_ID \
  --client-id $CLIENT_ID \
  --client-secret $CLIENT_SECRET \
  --refresh-token $REFRESH_TOKEN
```

#### 업로드 + 즉시 게시

```bash
chrome-webstore-upload upload \
  --source vault-fill.zip \
  --extension-id $EXTENSION_ID \
  --client-id $CLIENT_ID \
  --client-secret $CLIENT_SECRET \
  --refresh-token $REFRESH_TOKEN \
  --auto-publish
```

#### package.json 스크립트로 등록

`services/extension/package.json`에 추가:

```json
{
  "scripts": {
    "release": "yarn build && cd dist && zip -r ../vault-fill.zip . && cd .. && chrome-webstore-upload upload --source vault-fill.zip --extension-id $EXTENSION_ID --client-id $CLIENT_ID --client-secret $CLIENT_SECRET --refresh-token $REFRESH_TOKEN --auto-publish"
  }
}
```

```bash
EXTENSION_ID=xxx CLIENT_ID=xxx CLIENT_SECRET=xxx REFRESH_TOKEN=xxx corepack yarn workspace @vault-fill/extension release
```

#### GitHub Actions 예시

```yaml
# .github/workflows/release.yml
name: Release to Chrome Web Store

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: corepack enable && corepack yarn install --immutable

      - run: corepack yarn build

      - run: cd services/extension && zip -r vault-fill.zip dist/

      - run: npx chrome-webstore-upload-cli upload
          --source services/extension/vault-fill.zip
          --extension-id ${{ secrets.EXTENSION_ID }}
          --client-id ${{ secrets.CLIENT_ID }}
          --client-secret ${{ secrets.CLIENT_SECRET }}
          --refresh-token ${{ secrets.REFRESH_TOKEN }}
          --auto-publish
```

> Secrets는 GitHub 레포 → Settings → Secrets and variables → Actions 에서 등록합니다.

---

## 빌드 원칙 (Yarn Berry PnP)

### Docker 배포 시

standalone 모드 대신 PnP 의존성 구조를 그대로 활용합니다:

```dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare yarn@4.6.0 --activate
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY services/extension/package.json services/extension/package.json
COPY tsconfig.json ./
COPY services/extension services/extension
RUN yarn install --immutable
RUN yarn workspace @vault-fill/extension build
```

`.pnp.cjs`, `.yarn/cache` 등 PnP 런타임이 유지된 상태에서 실행해야 합니다.
