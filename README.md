# vibe-project-template

Yarn Berry PnP + Next.js 16 + Tailwind 4 기반의 모노레포 프로젝트 템플릿.

Dokploy 배포를 전제로 설계되었으며, Claude Code와 함께 빠르게 프로젝트를 시작할 수 있습니다.

## 빌드 원칙

### Next.js `output: "standalone"` 사용 금지

이 템플릿은 Yarn Berry PnP를 패키지 매니저로 사용합니다.

Next.js의 `standalone` 모드는 **`node_modules` 기반 파일 트레이싱**에 의존하는데, PnP 환경에서는 `node_modules`가 존재하지 않고 의존성이 `.pnp.cjs` + zip 아카이브로 관리됩니다. 이로 인해 다음과 같은 문제가 발생합니다:

1. **standalone 빌드 실패** — `outputFileTracingRoot`를 설정하더라도, PnP의 가상 패키지 경로(`__virtual__`)를 standalone 트레이서가 올바르게 추적하지 못합니다.
2. **Docker 런타임 크래시** — 빌드가 성공하더라도, standalone 출력의 `server.js`가 PnP 없이 의존성을 찾지 못해 컨테이너 시작 시 즉시 크래시합니다.
3. **모노레포 경로 불일치** — 워크스페이스 구조에서 standalone 출력의 디렉토리 구조가 실제 프로젝트 구조와 달라, `COPY` 경로 매핑이 깨집니다.

#### 올바른 Docker 빌드 방식

standalone 대신, 멀티스테이지 없이 PnP 의존성 구조를 그대로 활용합니다:

```dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare yarn@4.6.0 --activate
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY services/web/package.json services/web/package.json
COPY tsconfig.json ./
COPY services/web services/web
RUN yarn install --immutable
RUN yarn workspace @my-app/service build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["yarn", "workspace", "@my-app/service", "start"]
```

핵심: `.pnp.cjs`, `.yarn/cache` 등 PnP 런타임이 유지된 상태에서 `yarn start`를 실행합니다. standalone처럼 런타임을 분리할 필요가 없습니다.

### Supply Chain 보안

`.yarnrc.yml`에 `npmMinimalAgeGate: "7d"` 설정이 적용되어 있습니다. npm에 게시된 지 7일 미만인 패키지 버전은 설치 대상에서 제외되어, 악성 패키지가 올라온 직후 설치되는 supply chain 공격을 방어합니다.
