# Task — KDT-Inventory 개발 진행 현황

> 기준 문서: [`KDT_작업계획서.md`](./KDT_작업계획서.md) / [`Blueprint.md`](./Blueprint.md)
> 현재 버전: **Ver 1.0.0**

## Phase 0: 기획 및 요구사항 확정 (완료)
- [x] `Asan-Inventory_3400` 아키텍처·스키마·엑셀 구조 분석
- [x] `_user/KDT-Inventory.xlsx` 및 PDF 2종 분석
- [x] 1차·2차·3차 QnA 완료 (`_user/QmA.md`) 및 `KDT_작업계획서.md` 확정

## Phase 1: Ver 1.0.0 기반 구축 및 소스 선별 이식 (완료 — 1차 중간보고)
- [x] Firebase `kdt-inventory` 웹 앱(`KDT-Inventory-Web`) 생성 및 `firebaseConfig` 반영
- [ ] Firebase Firestore 데이터베이스 생성 (서울 `asia-northeast3` — 콘솔에서 Cloud Firestore API 활성화/DB 생성 필요)
- [x] 루트 설정(`Version.json`, `.firebaserc`, `firebase.json`, `firestore.rules`, `package.json`, `vite.config.ts`) 생성
- [x] 표준 빌드/배포 스크립트(`_Local_run_KDT.bat`, `_Cloud_run_KDT.bat`) 및 백업 스크립트(`backup_ver.ps1`) 생성
- [x] Asan 재고관리 소스 선별 복사 (요양원 플러그인 4종 + AIAdvisor 제외)
- [x] Cloud Functions v2 서울 리전(`asia-northeast3`) 및 KDT 스키마/6명 사용자/입출고 권한 백엔드 구축
- [x] 프론트엔드 코어(`types.ts`, `constants.ts`, `formatters.ts`, `firebaseClient.ts`, `api.ts`, `index/*`, `Login.tsx`) KDT 개편
- [x] 연구소 문서 3종(`Blueprint.md`, `Revision_history.md`, `Task.md`) 최초 작성
- [x] 패키지 설치, TypeScript 검사(`tsc`), 프론트/백엔드 클린 빌드 0 에러 검증 (`main-BjjBIrim.js` 내 `1.0.0` 확인)
- [x] `backup/Ver1.0.0` 롤백 백업 및 GitHub(`youhwanjung-dot/KDT-Inventory`) 1차 푸시

## Phase 2: KDT UI 컴포넌트·권한·리팩토링 (예정 — Ver 1.1.0)
- [ ] `TransactionModal.tsx`: 로그인 사용자 `txPermission`(`IN_ONLY` / `OUT_ONLY` / `ALL`)에 따른 입고/출고 탭 비활성화 및 정수 EA 입력 적용
- [ ] `UserManagerModal.tsx`: 사용자별 `txPermission`(입고전용/출고전용/전체) 편집 UI 추가
- [ ] `StockForm.tsx`: 도금(`plating`), 규격(`spec`), 단위(`EA`/`SET`/`BOX`), 단위당 EA(`eaPerUnit`), 1대당 소요량(`qtyPerProduct`), 보관위치, 비고 입력 폼 개편
- [ ] `InventoryList.tsx` → `InventoryList/` 폴더 분리 리팩토링 (Rule 5, 1,000라인 초과 해소) + KDT 컬럼(ZONE/품명/도금/규격/현재고 EA+환산/보관위치/비고) 적용
- [ ] `MasterDataManagerModal.tsx`: ZONE(대분류) 명칭 변경 시 불변 `zoneId` 기반 별칭 이력 보존 + 2차 목표 생산수량 필드 UI 반영

## Phase 3: 보고서·대시보드·엑셀 양방향 동기화 & 초기 데이터 (예정 — Ver 1.2.0)
- [ ] `KDT template.xlsx` (현 재고 + ZONE별 30슬롯 일자별 수불부) 생성 및 Export/Import 양방향 정합성 구현
- [ ] `_user/KDT-Inventory.xlsx` (`ZONE16_Plus` 10품목 + `ZONE18` 22품목/23입고건, 평와셔 M8 2건 입고 합산) 초기 데이터 파서 및 `initialData.ts`·DB 적재 기능 구현
- [ ] `Dashboard.tsx`, `InventoryReport.tsx`, `MonthlyReportModal.tsx`, `MonthlyUsageReportModal.tsx` KDT 용어/정수 EA/인쇄 최적화 반영
- [ ] `ManualModal` KDT 매뉴얼 정비

## Phase 4: 클라우드 배포 및 최종 검증 (예정 — Ver 1.3.0)
- [ ] `_Local_run_KDT.bat` 로컬 클린빌드 및 동작 검증
- [ ] `_Cloud_run_KDT.bat` 클라우드 배포 (`functions`, `firestore`, `hosting`)
- [ ] `https://kdt-inventory.web.app/login` 브라우저 실접속 및 로그인/권한/입출고/엑셀 검증
