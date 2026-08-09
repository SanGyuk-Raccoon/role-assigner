# Repository verification

## Unit and contract tests

이름·역할 정규화와 상한, 역할 수 검증, 결정적 Fisher–Yates·Sattolo 배정, 개인·공용 결과 링크 codec과 엄격한 오류 거부 계약을 확인합니다.

```sh
npm test
```

## Browser flows

Chromium에서 base path 직접 진입, 결과 기본 숨김, 전체·참가자별 공개, dialog 초점, 개인·공용 링크 새로고침, 공유·복사 대체 동작, 역할 데이터 네트워크 무전송, 320px 반응형과 axe 접근성 검사를 실행합니다. Playwright 브라우저가 처음 필요한 환경에서는 먼저 `npx playwright install chromium`을 실행합니다.

```sh
npm run test:e2e
```

## Production build

별도 백엔드 환경 변수 없이 Next.js 타입 검사와 프로덕션 번들이 생성되고 기존 `/role-assigner` base path 설정이 유지되는지 확인합니다.

```sh
npm run build
```

## Removed backend boundary

런타임 패키지, 잠금 파일과 소스에 역할 데이터 API, 서버 방 코드, 데이터베이스 SDK 및 관련 환경 변수 참조가 남지 않았는지 확인합니다.

```sh
! rg -i "firebase|firebase-admin|NEXT_PUBLIC_FIREBASE|FIREBASE_SERVICE_ACCOUNT|/api/rooms|room-manager" package.json package-lock.json src
```
