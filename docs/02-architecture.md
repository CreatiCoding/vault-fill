# 프로젝트 설계서

## 빌드 원칙

### Next.js standalone 모드 사용 금지

- **`output: "standalone"`을 사용하지 않는다.**
- Yarn Berry PnP 환경에서는 `node_modules`가 존재하지 않고, 의존성이 `.pnp.cjs` + zip 아카이브로 관리된다.
- Next.js standalone 모드는 `node_modules` 기반의 파일 트레이싱에 의존하므로, PnP 환경과 호환되지 않아 Dockerfile에서 정상적인 빌드를 구성할 수 없다.
- Docker 빌드 시에는 PnP 의존성 구조를 그대로 활용하여 이미지를 구성한다.
