# Task — KDT-Inventory 개발 진행 현황

> 기준 문서: [`KDT_작업계획서.md`](./KDT_작업계획서.md) / [`Blueprint.md`](./Blueprint.md)
> 현재 버전: **Ver 1.4.7** (다중 사용자 동시 작업 DB 정합성 안전장치: 이중 로그인 방지 + 수불이력 트랜잭션화 · Functions 재배포 완료)

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

## Excel ZONE 동기화 및 월별 보고서 안정화 (완료 — Ver 1.3.9, 배포 대기)
- [x] Excel 내보내기에서 기준정보에 등록된 모든 대분류를 동일한 이름의 데이터 시트로 생성하고 Main 요약 시트의 대분류도 고정 문자열로 기록
- [x] 요약 시트와 `Main` 대분류의 이름 충돌 방지, 품목이 없는 ZONE도 40개 슬롯으로 내보내기
- [x] Excel 품목 일괄등록 시 가져온 대분류/소분류를 서버 기준정보에 동기화
- [x] 수불부 이력 일괄등록에서 데이터 시트 이름과 품목 대분류가 일치할 때만 매칭해 타 ZONE 오등록 방지
- [x] Main 요약 시트가 KDT 입고 시트로 오인되지 않도록 날짜/수량 헤더 판별 추가
- [x] 병합된 대분류명을 40개 행에 전파해 Excel 품목 일괄등록 시 각 행의 ZONE 유지
- [x] `_user/KDT-Inventory-2026-20261119.xlsx` 32개 품목의 ZONE이 `ZONE16_Plus`/`ZONE18`로 파싱되는 것 확인
- [x] 품목명이 없는 수불부 슬롯은 직전 품목명을 상속하지 않고, 템플릿의 날짜별 거래 샘플값도 빈 슬롯으로 복제되지 않도록 수정
- [x] Main 및 ZONE별 내보내기 시트의 Excel 인쇄 배율을 40%로 고정
- [x] `_user/KDT-Inventory-2026-20261119.xlsx` 검수: Main/ZONE 품목명 일치, 미사용 슬롯 48곳의 샘플 수량 제거 정정본 생성, 실제 슬롯 데이터 보존 및 모든 시트 40% 확인
- [x] 월별 보고서의 한국 시간대 월 경계 보정, 대분류별 40행 고정 및 A3 세로 인쇄 규칙 적용
- [x] 월별 보고서 미리보기/인쇄를 대분류당 40슬롯으로 구성하고 페이지 번호를 대분류별로 표시
- [x] 월별 보고서 미리보기를 인쇄와 같은 A3 세로 용지 비율·여백으로 표시하고 화면에 맞게 축소
- [x] `npm run typecheck`, `npm run build` 통과; 클라우드 배포는 대기

## 공통 소분류 기준정보 (완료 — Ver 1.3.10, 배포 대기)
- [x] 새 소분류명을 모든 대분류(ZONE)의 `namesByCategory`에 동기화
- [x] 품목 레코드가 없는 ZONE에 현재고 0인 품목 생성, 기존 `(ZONE, 품명)` 항목은 중복 생성하지 않음
- [x] 자동 생성하던 0수량 `재고이월` 거래 제거; 신규 품목에 거래 이력이 남지 않도록 처리
- [x] 월별 보고서의 기존 무거래 품목 체크박스가 미리보기와 인쇄 모두에 적용되는 점을 유지하고, 라벨을 `선택 월 입출고 품목만`으로 명확화
- [x] `npm run typecheck`, `npm run build` 통과; Firebase 클라우드 배포는 대기

## 출고 사유 명확화 (완료 — Ver 1.3.11, 배포 대기)
- [x] 신규 출고 사유를 `불량교체`에서 `불량폐기`로 변경
- [x] 출고 유형에 따른 재고 차감 로직은 변경하지 않음
- [x] 운영 Firestore 거래 32건 확인; 기존 `불량교체` 기록 0건이라 이력 변경 대상 없음
- [x] 이력 사유 일괄 변경 시 수량 차감 없이 사유 필드만 변경하도록 경로 확인

## 소품목 추가 입력 안내 (완료 — Ver 1.3.12, Firebase Hosting 반영)
- [x] 빈 품명으로 추가 버튼을 누르면 안내를 표시하고 품명 입력란으로 포커스 이동
- [x] 신규 품목은 모든 ZONE 기준정보에 등록, 재고수량 0, 거래 이력 없음 원칙 유지
- [x] 프로덕션 빌드와 Firebase Hosting 배포 확인

## 공통 소품목 동기화 및 삭제 경고 (완료 — Ver 1.3.13, 배포 대기)
- [x] 기준정보 저장이 성공한 뒤 모든 ZONE별 0재고 품목 레코드 생성
- [x] 소품목 삭제 시 다른 ZONE 동일 품목의 거래 이력 건수 확인
- [x] 이력이 있으면 영향 범위와 함께 커스텀 확인 모달에서 삭제 재확인
- [x] Firebase 테스트 품목을 모든 ZONE에 0재고로 정렬하고 자동 생성된 0수량 `재고이월` 이력 제거

## 월별 수불·재고분석 보고서 (완료 — Ver 1.3.14, Hosting 배포 대기)
- [x] 월별 보고서에서 최신 유효 `재고이월`을 기준으로 선택월 기초재고 계산
- [x] `재고이월`을 월 입고량 및 선택월 입출고 품목 필터에서 제외
- [x] 월별 수불 보고서의 대분류별 40행 높이·글꼴을 확대하고 A3 세로 페이지 최적화
- [x] 재고분석에서 미입력 적정재고는 현재고를 기준값으로 사용; 레거시 Excel 기본값 `1` 보정 및 신규 Import 누락값 `0` 처리
- [x] 재고분석 표의 각 열 너비와 줄바꿈을 최적화하고 A3 세로 미리보기/PDF 적용
- [x] `npm run typecheck`, `npm run build` 통과; Firebase Hosting 배포는 대기

## 재고현황 메뉴 반응형 개선 (구현·빌드 검증 완료 — Ver 1.3.15)
- [x] 노트북 폭에서는 필터와 액션 버튼을 별도 행에 배치하고, 액션 버튼은 자동 줄바꿈 적용
- [x] 넓은 화면에서는 두 그룹을 나란히 배치하고 액션 버튼 영역이 남는 폭을 사용하도록 조정
- [x] 운영 Hosting Ver 1.3.14 번들에 관련 메뉴 코드가 포함됨을 확인
- [x] `npm run typecheck`, `npm run build` 통과
- [ ] 수정 화면의 데스크톱·노트북 실기기 확인 및 Firebase Hosting 반영

## 재고현황 툴바 메뉴 정리 (구현·빌드 검증 완료 — Ver 1.3.16)
- [x] 부족재고 및 공통자재 합산보기 버튼을 기본 비활성 분기로 감싸고 기존 처리 로직 보존
- [x] 중복되는 상단 분석 리포트 버튼과 전용 콜백 경로 제거; 사이드 메뉴 진입 유지
- [x] 공통 품목 범례에서 숨긴 버튼을 안내하던 문구 정리
- [x] `npm run typecheck`, `npm run build` 통과
- [ ] Firebase Hosting 반영

## 세션 유휴 로그아웃·수불부 품목 동기화 (구현 완료 — Ver 1.3.17)
- [x] 로그인 세션에서 포인터·키보드·터치 입력이 5분간 없으면 로그아웃; 탭 복귀 시 유휴 시간 재확인
- [x] 수불부 품목이 특정 ZONE에 없으면 다른 ZONE의 품목 정의로 미리보기 매칭
- [x] 등록 확인 후 모든 대분류 기준정보에 품명을 반영하고 누락된 ZONE별 재고 품목을 현재고 0으로 생성
- [x] 거래 이력은 각 대분류의 실제 품목 ID에 연결하며 자동 재고이월 이력은 생성하지 않음
- [x] `npm run typecheck`, `npm run build` 통과
- [ ] Firebase Hosting 반영

## 보고서 메뉴 통합 (구현 완료 — Ver 1.3.18)
- [x] 사이드 메뉴의 `재고 보고서`를 `재고 분석보고서`로 통일
- [x] `재고현황 보고서`와 `사용현황 보고서`를 사이드 메뉴로 이동
- [x] 툴바에서 해당 보고서 버튼을 제거하고 `[신규 등록]`을 액션 행 첫 위치에 배치
- [x] 좁은 화면에서도 툴바 액션 버튼을 한 줄로 유지하고 가로 스크롤을 제공
- [x] `npm run typecheck`, `npm run build`, 수정 컴포넌트 ESLint 통과
- [ ] Firebase Hosting 반영

## 일괄등록 공통 품목 동기화 (구현·검증 완료 — Ver 1.3.19)
- [x] Excel 일괄등록에서 가져온 품목 정의를 모든 대분류 기준정보에 반영
- [x] 원본에 없는 대분류에 현재고 0인 재고 품목 레코드 생성
- [x] 기존 품목·원본 ZONE 재고는 유지하고 자동 보충 건수를 완료 안내에 표시
- [x] `npm run typecheck`, `npm run build`, 수정 컴포넌트 ESLint 통과
- [ ] Firebase Hosting 반영

## 기준정보 품명 변경 이력 동기화 (Ver 1.3.20)
- [x] `[서버 즉시 동기화]`에서 전체 재고·수불 데이터를 마이그레이션 방식으로 재저장
- [x] `itemId`로 연결된 거래의 `itemName`만 현재 품목명으로 갱신하고, 수량·일자·유형 등은 유지
- [x] 동기화 완료 건수 표시 및 저장 실패 시 성공으로 오인하지 않도록 처리
- [x] `npm run typecheck`, `npm run build`, 관련 파일 ESLint 검증 (오류 0건; 기존 Hook 의존성 경고 1건)
- [ ] Firebase Hosting 반영

## 사이드 메뉴·보고서 출력 통일 (Ver 1.3.21)
- [x] 사이드 메뉴를 대시보드 → 재고분석 보고서 → 재고현황 보고서 → 사용현황 보고서 → 일괄등록 → 수불부 등록 순으로 정렬
- [x] 일괄등록·수불부 등록을 관리자 전용으로 표시하고 일반 사용자 화면 접근도 제한
- [x] 재고현황·사용현황 보고서를 A3 세로 미리보기·인쇄로 맞추고 페이지당 50행으로 최적화
- [x] 재고분석 보고서와 월별 재고 수불 보고서의 기존 A3 세로 설정 확인
- [x] 기존 재고목록 기능은 재고현황 보고서 창을 닫은 뒤 그대로 사용 가능
- [x] `npm run typecheck`, `npm run build`, 관련 파일 ESLint 최종 검증
- [ ] Firebase Hosting 반영

## 사용현황 보고서 선택 (Ver 1.3.22)
- [x] 사용현황 사이드 메뉴를 월간·연간·ZONE 선택형으로 확장
- [x] 월간은 상단 툴바의 월별 수불부와 동일한 `MonthlyReportModal`을 사용
- [x] 연간은 전체 ZONE 사용량, ZONE은 선택한 대분류의 연간 사용량으로 필터
- [x] `npm run typecheck`, `npm run build`, 관련 파일 ESLint 검증
- [ ] Firebase Hosting 반영

## 재고현황 메뉴 전체 사용자 허용 (Ver 1.3.23)
- [x] 사이드 메뉴에 `재고현황`을 추가해 모든 사용자가 재고목록으로 바로 진입
- [x] 사용자별 입고·출고 권한 제어는 기존 로직 유지
- [x] `npm run typecheck`, `npm run build`, 관련 파일 ESLint 검증
- [ ] Firebase Hosting 반영

## Ver 1.3.24 ~ Ver 1.3.32 진행분 정리 (2026-11-22)
- [x] 일괄등록·수불부 등록 후 클라이언트 재고 갱신 및 기초재고 계산 보정
- [x] 신규 품목의 전체 ZONE 공통 적용과 Excel 전체 시트 파싱·도금/규격 매핑 보정
- [x] 기준정보 동기화 시 과거 수불 이력 품명 갱신
- [x] 메뉴 권한·보고서 구성 통일, 수량 정수 EA 표기 및 A3 세로 40행 출력 최적화
- [x] ZONE 사용현황 보고서에 연간 기초·입고·출고·기말 합계와 빈 행 패딩 적용
- [x] 상세 변경 내역은 [`Revision_history.md`](./Revision_history.md)의 Ver 1.3.24~1.3.32 항목 참조
- [ ] Firebase Hosting 반영 및 현장 화면 최종 확인

## 소품목 기준정보 수정 모달 (요구사항 확인, 미구현)
- [ ] 신규 자재 등록에 사용하는 `StockForm` 모달을 소품목 기준정보 수정에도 재사용
- [ ] 수정 모드 제목은 `수정`으로 표시

## 입고 색상 및 수불부 재고 재산정 (Ver 1.3.33)
- [x] 입고 선택 버튼, 이력 배지, 수량 표기를 청색으로 변경하고 출고는 적색 유지
- [x] 재고 중복 원인 수정: 기존 현재고를 기초로 모든 수불을 다시 더하던 계산 제거
- [x] 수불 이력이 포함된 품목은 최신 `재고이월`과 이후 입출고 증감으로 재계산
- [x] 수불 이력이 없는 품목의 현재고는 유지하고, 확인창에 재산정 대상 수 표시
- [x] `npm run typecheck`, `npm run build`, 변경 파일 ESLint 검증
- [x] Firebase 운영 DB 90개 품목·70건 거래 대조 후 정확히 2배인 28개 품목의 `currentStock` 정정
- [x] 변경 전 28건의 값과 근거를 `backup/Ver1.3.33/firestore_stock_correction_20261122.json`에 저장, 거래 이력 70건 보존 확인
- [x] 인코딩으로 손상된 28개 Firebase 품목명을 변경 전 백업의 UTF-8 값으로 복구, 정정된 재고수량 유지
- [x] Firebase 품목 90건 및 기준정보 전체 품명에서 `?` 깨짐 0건 확인
- [x] 출고만 기록된 음수 재고 3건이 수불 이력과 일치함을 확인하고 유지 (음수 여부만으로 오류 처리하지 않음)
- [x] 전체 백업으로 Firebase 복구 (품목 90개·거래 70건·기준정보 일치), 복구 전 테스트 DB는 `backup/Ver1.3.33/firestore_before_restore_20261122.json`에 보존
- [x] 복구 후 기존 28개 중복재고 정정값 재적용; 거래이력이 있는 48개 품목 재고 48/48 일치, 이력 없는 42개는 백업 현재고 유지
- [x] 샤프트 (ABB) 1,900 EA 및 강력방습제 1,600 EA는 동일 일자 입고·출고 순합계 0으로 확인되어 현재고 0으로 정정
- [x] 최종 검증 데이터 `backup/Ver1.3.33/firestore_restored_validated_20261122.json` 저장, 음수 재고 3건도 수불 이력과 일치 확인
- [ ] Firebase Hosting 배포 상태 확인 및 운영 화면 최종 점검

## Firebase 읽기 API 보안 후속 (미구현)
- [ ] Firestore `inventory`·`transactions` 공개 읽기 규칙과 인증 없는 Cloud Function GET을 점검하고, 로그인 사용자의 정상 조회 흐름을 유지하면서 접근 제어 적용

## ZONE 40개 초과 Excel·보고서 및 공통 품목 정합성 (로컬 검증 완료 — Ver 1.3.35)
- [x] 복구된 90개 품목·70건 거래는 모두 2026년 11월이며, 월별 수불부와 ZONE 합산의 품목별 기초·입고·출고·기말 계산값이 일치함을 확인
- [x] PDF에서 ZONE16_Plus 40+6=46개, ZONE18 40+4=44개가 모두 출력됨을 확인; 행 누락이 아니라 원본 DB의 ZONE별 품목 정의 차이
- [x] Excel 내보내기 40슬롯 제한, 표시용 품명과 원본 품명 혼용, 일괄등록의 전 ZONE 공통 보충으로 61개씩 생성된 경로 확인
- [x] Excel Main 및 ZONE 수불부를 40개 단위로 자동 연장하고 모든 품목·수불을 해당 ZONE 페이지에 연결
- [x] 표시용 시트와 별도로 품목·거래·기준정보 원본 탭을 추가하고, 전용 복구 파서가 일반 일괄등록/전 ZONE 보충 경로를 우회
- [x] 긴 JSON을 30,000자 셀 단위로 분할·재조립하고 레코드 수, 필수값, 중복 ID, 거래-품목 참조를 검증
- [x] 월별 수불부를 ZONE별 40행 페이지로 자동 분할하고 마지막 페이지를 빈 행으로 패딩
- [x] 검증 백업으로 Excel 내보내기→복구 파서를 시험: 품목 90건·거래 70건·기준정보 완전 일치, 65,000자 필드 왕복, Main 90행, ZONE16_Plus 46개/ZONE18 44개 각 2페이지 확인
- [x] 프론트엔드 타입검사·프로덕션 빌드·변경 파일 ESLint·Functions 타입검사 통과
- [x] 기준정보 관리자에 확인형 `공통 품목 동기화` 기능 추가; 품명·도금·규격 합집합 기준으로 누락 레코드를 현재고 0으로 보충하고 기준정보 이름 목록을 ZONE 간 통일
- [x] 검증 데이터 정규화 시뮬레이션: ZONE16_Plus +2, ZONE18 +4, 각각 48개·총 96개; 기존 90개 품목 데이터와 70건 거래 보존 확인
- [x] 동기화는 전용 관리자 작업으로 분리하고 Excel DB 복구는 원본 그대로 복원하도록 유지
- [x] 새 동기화 기능 타입검사·프로덕션 빌드 통과 및 변경 파일 ESLint 오류 없음 (MasterDataManagerModal 기존 Hook 의존성 경고 1건)
- [ ] 운영자가 별도 백업 후 기준정보에서 공통 품목 동기화를 실행하고 PDF 재출력으로 ZONE별 48개 확인
- [ ] 운영 Firebase에서 초기화→Excel DB 복구를 실제 실행하고 복구 후 데이터 건수·재고를 대조 (운영 DB 변경은 사용자 승인 전 미실행)
- [ ] 브라우저 인쇄 결과 및 Hosting 배포 후 현장 확인

## 신규 품목 ZONE 적용 범위 선택 (로컬 검증 완료 — Ver 1.3.36)
- [x] 재고현황 신규 품목 저장 전 현재 ZONE만 등록 또는 전체 대분류 확대 적용을 선택
- [x] Excel 일괄등록에서 기본은 파일에 지정된 ZONE만 등록하고, 체크 시 이번 업로드에서 새로 추가되는 품목 정의만 누락 ZONE에 보충
- [x] 수불부 등록 및 기준정보 품목 추가도 같은 기본 원칙으로 선택 제공
- [x] 전체 확대 시 추가 레코드는 현재고·적정재고 0으로 생성하며 기존 품목·재고·수불 이력은 보존
- [x] DB 원본 탭 복구 경로는 사용자 선택 확장과 분리하여 백업 내용을 그대로 복원
- [x] `npm run typecheck`, `npm run build`, 수정 파일 ESLint 검증 (오류 0건; 기준정보 모달 기존 Hook 경고 1건)
- [x] `backup/Ver1.3.36` 로컬 소스 백업 생성
- [ ] 로컬 UI에서 선택별 등록 확인 및 Hosting 배포 후 현장 확인
- [ ] 운영 DB 변경은 별도 요청 전 수행하지 않음

## 신규 ZONE 공통 품목 초기화 (로컬 검증 완료 — Ver 1.3.37)
- [x] 새 대분류 추가 시 기존 전체 ZONE 품목 정의를 `품명+도금+규격` 기준으로 중복 제거
- [x] 새 ZONE에만 품목 레코드를 생성하고 현재고·적정재고를 0으로 초기화
- [x] 거래 이력은 생성하지 않고 기존 ZONE의 품목·재고·거래 데이터는 수정하지 않음
- [x] 새 ZONE 메타데이터와 품목 문서를 별도 저장하고 저장 성공·실패 건수를 표시
- [x] `npm run typecheck`, `npm run build`, 수정 파일 ESLint 검증 (오류 0건; 기존 Hook 의존성 경고 1건)
- [x] `backup/Ver1.3.37` 로컬 소스 백업 생성
- [ ] 로컬 UI에서 새 ZONE 생성 후 품목 수·0재고·기존 거래 불변 확인
- [ ] Firebase Hosting 반영 및 운영 적용은 별도 승인 전 미실행

## 공통 품목 자동 초기화 및 ZONE별 선택 추가 (로컬 검증 완료 — Ver 1.3.38)
- [x] 신규 ZONE 자동 초기화를 모든 기존 ZONE 품목 정의의 교집합으로 제한
- [x] 상세 품목 화면에 원본 ZONE 선택, 품명·도금·규격 검색, 복수 선택 기능 추가
- [x] 선택한 품목 정의만 대상 ZONE에 추가하고 현재고·적정재고 0, 거래 이력 미복사
- [x] 중복 판정은 `품명+도금+규격` 기준이며 기존 ZONE 재고·품목·이력은 변경하지 않음
- [x] `npm run typecheck`, `npm run build`, 수정 파일 ESLint 검증 (오류 0건; 기존 Hook 의존성 경고 1건)
- [x] `backup/Ver1.3.38` 로컬 소스 백업 생성
- [ ] UI에서 공통 교집합 초기화 및 AAA 선택 추가를 확인
- [x] Firebase Hosting Ver 1.3.38 배포 완료 (사용자 확인)
- [ ] 운영 DB 공통 품목 동기화 실행은 사전 백업 및 미리보기 검토 후 진행
- [x] 관리자 동기화 경로 확인: 좌측 메뉴 하단 `ZONE·기준정보 관리` → 모달 하단 `공통 품목 동기화`
- [x] Excel 내보내기·DB 초기화·원본 복구는 기존 ZONE 품목 차이를 정규화하지 않음을 확인

## 연간 사용현황 ZONE 통합 (로컬 검증 완료 — Ver 1.3.39)
- [x] ANNUAL 보고서에서 모든 ZONE의 출고량만 품목별·월별로 합산
- [x] 집계 키는 `품명+도금+규격`으로 하고 ZONE은 제외; 서로 다른 도금·규격은 별도 행으로 유지
- [x] 현재 재고 품목과 선택 연도 거래 이력만 남은 품목을 함께 표시
- [x] 정수 EA 표시, A3 세로 페이지당 40행 및 빈 슬롯 패딩 적용
- [x] ZONE 모드의 기존 선택 대분류 입고·출고·기초·기말 집계 유지
- [x] `npm run typecheck`, `npm run build`, 수정 파일 ESLint 통과
- [x] `Version.json`, `Revision_history.md`, `Blueprint.md`, `Task.md` 갱신
- [ ] Firebase Hosting 배포 및 실제 출력 확인

## 사용현황·월별 수불부 역할 분리 (로컬 검증 완료 — Ver 1.3.40)
- [x] 사이드바 월간을 상단 수불부 재사용에서 별도 사용현황 보고서 모드로 분리
- [x] 월간은 전체 ZONE의 선택월 품목별 출고량, 연간은 전체 ZONE의 월별 출고량으로 통합
- [x] ZONE별은 선택 연도·ZONE·시작월~종료월의 품목별 누적 출고량만 표시
- [x] 사용현황은 `품명+도금+규격`으로 집계하고 A3 세로 40행 페이지 규칙 유지
- [x] 상단 월별 수불부는 기존 ZONE별 기초·입고·출고·기말재고 보고서로 유지
- [x] `npm run typecheck`, `npm run build`, 수정 파일 ESLint 통과
- [x] `Version.json`, `Revision_history.md`, `Blueprint.md`, `Task.md`, `KDT_작업계획서.md` 갱신
- [ ] Firebase Hosting 배포 및 브라우저·실제 인쇄 확인

## 월간·ZONE 사용현황 재고 흐름 포함 (로컬 검증 완료 — Ver 1.3.41)
- [x] 전체 ZONE 통합 월간 보고서에 품목별 기초재고·입고·출고·기말재고 포함
- [x] 선택 ZONE 기간 보고서에 동일한 재고 흐름 집계 적용
- [x] 과거 기초재고 계산을 상단 월별 수불부의 재고이월·거래 역산 규칙과 일치시킴
- [x] 통합 월간은 대분류 `전체 ZONE`, 여러 장소가 있으면 `ZONE별 상이` 표시
- [x] 연간은 제한된 A3 공간을 고려해 월별 소모량 전용 양식을 유지
- [x] A3 세로 40행 규격 및 기존 사용자 설정 필드 라벨 유지
- [x] `npm run typecheck`, `npm run build`, 수정 파일 ESLint 통과
- [x] `Version.json`, `Revision_history.md`, `Blueprint.md`, `Task.md`, `KDT_작업계획서.md` 갱신
- [ ] Firebase Hosting 배포 및 실제 브라우저·인쇄 확인
