# Repository verification

## Production build

애플리케이션 코드, TypeScript 타입 검사 및 Next.js 프로덕션 번들이 정상적으로 생성되는지 확인합니다. 저장소 루트에서 의존성이 설치된 모든 코드 변경에 적용합니다.

```sh
npm run build
```

## Automated tests

`src/__tests__/unit/utils.test.ts`와 `src/__tests__/e2e/page.spec.ts`가 존재하지만, 현재 프로젝트 매니페스트에는 Vitest 및 Playwright 테스트 러너가 선언되어 있지 않고 테스트 실행 스크립트, 설정 및 CI 워크플로도 없습니다. 따라서 현재 지원되는 로컬 또는 CI 자동 테스트 명령은 없습니다. 테스트 인프라가 추가되기 전에는 관련 시나리오를 변경 범위에 맞게 수동 검토합니다.
