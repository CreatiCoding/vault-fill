# 사전 준비 가이드

> Step 1~9 구현을 시작하기 전에 **사용자가 직접** 완료해야 하는 작업 목록입니다.
> 자동화할 수 없는 외부 서비스 설정, 인증 정보 발급 등을 포함합니다.

## [선택] 1. GitHub OAuth App 생성

> 로그인 기능이 필요한 경우, GHO 기반의 인증을 이용한다.

로컬 개발용과 프로덕션용, **2개의 OAuth App**을 각각 생성해야 합니다.

### 생성 위치

[GitHub Settings > Developer settings > OAuth Apps > New OAuth App](https://github.com/settings/developers)

### 로컬 개발용

| 항목                       | 값                                               |
| -------------------------- | ------------------------------------------------ |
| Application name           | `example.com (dev)`                              |
| Homepage URL               | `http://localhost:3000`                          |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

생성 후 확보할 값:

- **Client ID** → `.env.local`의 `AUTH_GITHUB_ID`
- **Client Secret** (Generate) → `.env.local`의 `AUTH_GITHUB_SECRET`

### 프로덕션용

| 항목                       | 값                                             |
| -------------------------- | ---------------------------------------------- |
| Application name           | `example.com`                                  |
| Homepage URL               | `https://example.com`                          |
| Authorization callback URL | `https://example.com/api/auth/callback/github` |

생성 후 확보할 값:

- **Client ID** → GitHub Secrets `AUTH_GITHUB_ID`
- **Client Secret** (Generate) → GitHub Secrets `AUTH_GITHUB_SECRET`

---

## [선택] 2. MinIO 버킷 및 키 설정

> 이미지를 업로드 하거나 다운로드가 필요한 경우, MinIO를 이용합니다.

### 버킷 생성

1. [MinIO Console](https://s3-console.dokploy.creco.dev) 접속
2. Buckets > Create Bucket
3. Bucket Name: `hello-world-images`
4. Access Policy: `public` (이미지 공개 접근용)

### Access Key 확보

1. MinIO Console > Access Keys
2. 기존 키 사용 또는 Create Access Key
3. 확보할 값:
   - **Access Key** → `S3_ACCESS_KEY`
   - **Secret Key** → `S3_SECRET_KEY`

---

## 3. DNS 레코드 설정

도메인 관리 패널에서 `example.com`이 Dokploy 서버를 가리키도록 설정합니다.

| 타입 | 호스트 | 값              |
| ---- | ------ | --------------- |
| A    | `xxxx` | Dokploy 서버 IP |

또는 CNAME을 사용하는 경우 기존 Dokploy 도메인을 가리킵니다.

> DNS 전파에 최대 24~48시간 소요될 수 있으므로 **가능한 빨리** 설정하세요.

---

## 4. AUTH_SECRET 생성

Auth.js 세션 암호화에 사용할 랜덤 키를 생성합니다.

```bash
openssl rand -base64 32
```

이 값을 `.env.local`과 GitHub Secrets 양쪽에 사용합니다.

---

## [선택] 5. Dokploy PostgreSQL 생성

> DB 가 필요한 경우, PostgreSQL를 이용합니다.

> 이 작업은 Step 9 배포 직전에 해도 됩니다. MCP 도구로 자동화 가능하지만, 연결 문자열 확인은 직접 해야 합니다.

Dokploy 대시보드 또는 MCP 도구로 PostgreSQL을 생성한 뒤, 연결 문자열을 확보합니다.

```
postgresql://<user>:<password>@<host>:5432/hello-world
```

- **로컬 개발용**: Docker로 실행 (Step 진행 시 자동 안내)
- **프로덕션용**: Dokploy에서 생성 → `DATABASE_URL`

---

## 6. GitHub Secrets 등록

> `DATABASE_URL`은 Dokploy PostgreSQL 생성 후에야 확보 가능하므로, 배포 직전에 등록해도 됩니다.

### 등록 위치

리포지토리 > Settings > Secrets and variables > Actions > New repository secret

### 등록할 Secrets

| Secret Name          | 값 출처                            | 언제 필요 |
| -------------------- | ---------------------------------- | --------- |
| `DATABASE_URL`       | Dokploy PostgreSQL 연결 문자열     | 배포 직전 |
| `AUTH_SECRET`        | `openssl rand -base64 32` 결과     | 지금 가능 |
| `AUTH_GITHUB_ID`     | 프로덕션용 OAuth App Client ID     | 지금 가능 |
| `AUTH_GITHUB_SECRET` | 프로덕션용 OAuth App Client Secret | 지금 가능 |
| `S3_ENDPOINT`        | `https://s3.dokploy.creco.dev`     | 지금 가능 |
| `S3_ACCESS_KEY`      | MinIO Access Key                   | 지금 가능 |
| `S3_SECRET_KEY`      | MinIO Secret Key                   | 지금 가능 |

---

## 체크리스트

```
지금 바로:
  [ ] GitHub OAuth App 로컬용 생성 → Client ID, Secret 확보
  [ ] GitHub OAuth App 프로덕션용 생성 → Client ID, Secret 확보
  [ ] MinIO hello-world-images 버킷 생성
  [ ] MinIO Access Key / Secret Key 확보
  [ ] AUTH_SECRET 생성 (openssl rand -base64 32)
  [ ] DNS 레코드 설정 (example.com → Dokploy 서버 IP)
  [ ] GitHub Secrets 등록 (DATABASE_URL 제외 6개)

배포 직전 (Step 9):
  [ ] Dokploy PostgreSQL 생성 → DATABASE_URL 확보
  [ ] GitHub Secrets에 DATABASE_URL 등록
```
