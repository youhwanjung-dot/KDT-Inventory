# Task — KDT-Inventory 개발 진행 현황

> 기준 문서: [`KDT_작업계획서.md`](./KDT_작업계획서.md) / [`Blueprint.md`](./Blueprint.md)
> 현재 버전: **Ver 1.3.2** (Phase 1 ~ Phase 4 전 과정 100% 완료 + Hotfix + 마이그레이션 정리 반영)

## Phase 0: 기획 및 요구사항 확정 (완료)
- [x] `Asan-Inventory_3400` 아키텍처·스키마·엑셀 구조 분석
- [x] `_user/KDT-Inventory.xlsx` 및 PDF 2종 분석
- [x] 1차·2차·3차 QnA 완료 (`_user/QmA.md`) 및 `KDT_작업계획서.md` 확정

## Phase 1: Ver 1.0.0 기반 구축 및 소스 선별 이식 (완료 — 1차 중간보고)
- [x] Firebase `kdt-inventory` 웹 앱(`KDT-Inventory-Web`) 생성 및 `firebaseConfig` 반영
- [x] Firebase Firestore 데이터베이스 생성 완료 (서울 `asia-northeast3`, 상무님 콘솔 생성 확인)
- [x] 루트 설정(`Version.json`, `.firebaserc`, `firebase.json`, `firestore.rules`, `package.json`, `vite.config.ts`) 생성
- [x] 표준 빌드/배포 스크립트(`_Local_run_KDT.bat`, `_Cloud_run_KDT.bat`) 및 백업 스크립트(`backup_ver.ps1`) 생성
- [x] Asan 재고관리 소스 선별 복사 (요양원 플러그인 4종 + AIAdvisor 제외)
- [x] Cloud Functions v2 서울 리전(`asia-northeast3`) 및 KDT 스키마/6명 사용자/입출고 권한 백엔드 구축
- [x] 프론트엔드 코어(`types.ts`, `constants.ts`, `formatters.ts`, `firebaseClient.ts`, `api.ts`, `index/*`, `Login.tsx`) KDT 개편
- [x] 연구소 문서 3종(`Blueprint.md`, `Revision_history.md`, `Task.md`) 최초 작성
- [x] 패키지 설치, TypeScript 검사(`tsc`), 프론트/백엔드 클린 빌드 0 에러 검증
- [x] `backup/Ver1.0.0` 롤백 백업 및 GitHub(`youhwanjung-dot/KDT-Inventory`) 1차 푸시

## Phase 2: KDT UI 컴포넌트·권한·리팩토링 + 50슬롯/연도캘린더/혼입합산·정산 (완료 — Ver 1.1.0 / 2차 중간보고)
- [x] `TransactionModal.tsx`: 로그인 사용자 `txPermission`(`IN_ONLY` / `OUT_ONLY` / `ALL`)에 따른 입고/출고 메뉴 비활성화 및 정수 EA·SET/BOX 환산 보조 입력 구현
- [x] `UserManagerModal.tsx`: 사용자별 `txPermission`(입고전용/출고전용/전체) 편집 UI 추가
- [x] `StockForm.tsx`: 도금(`plating`), 규격(`spec`), 단위(`EA`/`SET`/`BOX`), 단위당 EA(`eaPerUnit`), 1대당 소요량(`qtyPerProduct`), 보관위치, 비고 입력 폼 개편
- [x] `InventoryList.tsx` → `InventoryList/` 폴더 분리 리팩토링 (Rule 5, 1,039라인 해소) + KDT 컬럼 + **50슬롯 동적 확장** + **연도별 동적 캘린더(2026→2027 자동 갱신 & 전년 잔고 Row 4 자동 이월)** + **공통자재 합산보기(`CONSOLIDATED`)** + **ZONE 반납/타 ZONE 이관 정산 모달(`ZoneSettlementModal.tsx`)**
- [x] `MasterDataManagerModal.tsx` → `MasterDataManagerModal/` 폴더 분리 리팩토링 (Rule 5, 1,089라인 해소) + `ZoneMetaModal` ZONE 별칭 이력 및 2차 목표 생산수량 UI 구현
- [x] `TransactionHistoryImport.tsx` (`ZONE + 품명 [도금/규격]` 스코프 매칭 및 연도 자동 감지) & `ReportModal.tsx` KDT 컬럼 개편

## Phase 3: 초기 32품목/33건 데이터 시드·KDT 입고시트 전용 파서·대시보드 정비 (완료 — Ver 1.2.0)
- [x] `initialData.ts` & `initialTransactions.ts`: `_user/KDT-Inventory.xlsx` 기반 32품목(`ZONE16_Plus` 10품목 + `ZONE18` 22품목, 평와셔 M8 46,100 EA 통합) 및 33건 입고 이력 정식 탑재
- [x] `DataMigrationModal.tsx`: `zoneMeta` 백업/복원 포함 + **[KDT 초기 입고 데이터 일괄 적재]** 원클릭 시드 버튼 추가
- [x] `ExcelImport/LegacyParser.ts` & `index.tsx` & `StepPreview.tsx` & `AnalysisModal.tsx`: `_user/KDT-Inventory.xlsx` 입고시트(`ZONE16_Plus_Inbound`, `ZONE18_Inbound`, `육각볼트 SET` + `ㅁ` 구성품 분리, 비고 실검수 수량 반영) 직접 파싱 및 4요소 키(`ZONE+품명+도금+규격`) 중복 판별 적용
- [x] `Dashboard.tsx` & `InventoryReport.tsx`: 정수 EA 포맷 및 `itemId` 기준 통계 집계 정비

## Phase 4: 클라우드 배포 및 운영 DB 실데이터 적재·검증 (완료 — Ver 1.3.0)
- [x] 프론트엔드(50개 모듈 ESM 컴파일) 및 백엔드(`functions/lib` 10개 모듈, Node.js 22 2nd Gen, Lazy Admin SDK) 클린 빌드
- [x] Firebase(`kdt-inventory`, 서울 리전 `asia-northeast3`) Firestore Rules/Indexes, Cloud Functions v2 (8개 엔드포인트), Hosting(`https://kdt-inventory.web.app/login`) 정식 배포 완료
- [x] 운영 Firestore DB 초기 32품목(`ZONE16_Plus` 10품목 + `ZONE18` 22품목), 33건 입고 이력, 6명 기본 사용자(`관리자` ALL, `김수현 팀장` IN_ONLY, `현장 4명` OUT_ONLY), `masterData.zoneMeta` 시드 적재 및 라이브 API 200 OK 검증 완료
- [x] `backup/Ver1.3.0` 롤백 아카이브 생성 및 GitHub(`origin/main`) 최종 푸시

## Phase 4 Hotfix: 빌드/배포 안정화 및 누락 심볼 정비 (완료 — Ver 1.3.1)
- [x] `StepPreview.tsx`와 `formatters.ts`의 `formatStockWithRef` 누락 심볼 호환성 에일리어스 추가 및 정비
- [x] `functions/src` TypeScript 엄격 타입 검사(`inventory.ts`, `migration.ts`, `transactions.ts`) 수정 완료
- [x] 프론트엔드 Vite 클린 빌드(0 에러) 및 Functions 컴파일(0 에러) 통과
- [x] Firebase Hosting 정식 재배포 완료 (`https://kdt-inventory.web.app/login`)
- [x] 라이브 Hosting 에셋 7종 200 OK 및 Cloud Functions 8개 엔드포인트 200 OK 검증 완료

## Phase 4 Cleanup: 마이그레이션 마무리 정리 및 운영 품질 정비 (완료 — Ver 1.3.2)
- [x] `LegacyParser.ts`, `InventoryList/excelExport.ts` 프론트엔드 `typecheck` 오류 수정
- [x] `tailwind.config.cjs`, `postcss.config.cjs` 추가 및 `frontend/desktop/index.html`의 프로덕션 `tailwind CDN` 제거
- [x] `ManualModal/UserManual.tsx`, `ManualModal/index.tsx`, `ManualModal/SharedComponents.tsx`를 KDT 기준 매뉴얼로 정리
- [x] `sourceExporter.ts`를 KDT용 최소 내장 템플릿으로 교체하고 아산노블/미사용 컴포넌트 참조 제거
- [x] `StepUpload.tsx`, `StepMapping.tsx`, `TransactionHistoryImport.tsx`, 보고서 하단 표기 등 UI 문구를 KDT 기준으로 정비
- [x] `_Cloud_run_KDT.bat` 재실행으로 클린빌드 및 Firebase Functions/Hosting 재배포 확인 완료
