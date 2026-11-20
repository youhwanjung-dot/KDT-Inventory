# Blueprint — KDT Material Inventory Management System (KDT-Inventory)

> 작성: 경훈시스템 부설 자동화 연구소 수석연구원 최박사
> 기준 프로젝트: `Asan-Inventory_3400` (Ver 5.34.0) 기반 재고관리 파트 선별 이관

## 1. 버전 및 MODE Flags (`Version.json` 일괄 관리)

| Flag | 현재 값 | 설명 |
|---|---|---|
| `VERSION_MODE` | `1.3.38` | `Version.json` → Vite 빌드타임 주입 → 로그인 모달 표시 |
| `MOCKUP_MODE` | `false` | `true` 전환 시 초기 목업 데이터 분기 동작 (코드 보존) |
| `STORAGE_MODE` | `Cloud` | Firebase Firestore (`asia-northeast3` 서울) / 로컬 분기 보존 |

---

## 2. 필수 패키지 및 라이브러리 버전

### 루트 (Desktop Frontend)
- `react`: ^18.3.1 / `react-dom`: ^18.3.1
- `vite`: ^5.2.0 / `typescript`: ^5.2.2 / `tailwindcss`: ^3.4.3 / `eslint`: ^9.39.3
- `firebase`: ^12.10.0
- `exceljs`: ^4.4.0 / `xlsx`: ^0.18.5 / `file-saver`: ^2.0.5
- `recharts`: ^2.12.2 / `lucide-react`: ^0.344.0
- `html2canvas`: ^1.4.1 / `jspdf`: ^2.5.1 / `jspdf-autotable`: ^5.0.7 / `react-to-print`: ^3.3.0
- `qrcode`: ^1.5.4 / `react-markdown`: ^9.0.1

### functions (Firebase Cloud Functions v2 — Seoul `asia-northeast3`)
- `firebase-admin`: ^12.0.0
- `firebase-functions`: ^4.0.0
- `exceljs`: ^4.4.0
- `typescript`: ^5.4.0

---

## 3. 전체 소스트리

```text
KDT-Inventory_3500/
├─ _agent/
│  └─ tools/
│     └─ backup_ver.ps1               (버전별 롤백 백업, 최근 5개 자동 유지)
├─ _user/                             (사용자 원본 자료 및 QnA 소통 채널)
│  ├─ KDT-Inventory.xlsx              (ZONE16_Plus / ZONE18 입고자재 원본)
│  ├─ Asan-Inventory.xlsx             (아산 공동작업 양식 참조본)
│  ├─ ZONE16_Plus_Inbound.pdf
│  ├─ ZONE18_Inbound.pdf
│  └─ QmA.md                          (1차~3차 설계 질의응답 누적)
├─ STORAGE/                           (파일시스템 영구 스토리지 영역)
├─ backup/                            (롤백용 버전별 백업 아카이브, 최근 5개 유지)
│  ├─ Ver1.0.0/
│  └─ Ver1.1.0/
├─ dist/                              (Vite 빌드 출력, .gitignore)
├─ firestore/
│  ├─ firestore.rules                 (KDT 재고 전용 보안 규칙)
│  └─ firestore.indexes.json
├─ frontend/
│  ├─ index.html                      (/desktop/ 자동 리다이렉트)
│  ├─ common/
│  │  ├─ styles.css
│  │  └─ types.js
│  └─ desktop/
│     ├─ index.html                   (KDT 메인 HTML)
│     ├─ index.tsx                    (앱 진입점 — 윈도우 역할)
│     ├─ index.css                    (전역 CSS + @media print)
│     ├─ constants.ts                 (MODE Flags, KDT 6명 초기 사용자, KDT 필드 정의)
│     ├─ types.ts                     (KDT 확장 스키마 + 2차 BOM 필드 선반영 + TxPermission)
│     ├─ initialData.ts               (목업/초기 자재 데이터)
│     ├─ initialTransactions.ts       (목업/초기 입출고 데이터)
│     ├─ vite-env.d.ts
│     ├─ public/
│     │  └─ template.xlsx             (공동작업 엑셀 수불부 템플릿)
│     ├─ index/                       (전역 상태·이펙트·핸들러·레이아웃 분리)
│     │  ├─ index.ts
│     │  ├─ useAppState.ts
│     │  ├─ useAppEffects.ts
│     │  ├─ useAppHandlers.tsx
│     │  └─ AppLayout.tsx
│     ├─ utils/
│     │  ├─ api.ts                    (REST API 클라이언트 + MODE Flag 분기)
│     │  ├─ firebaseClient.ts         (kdt-inventory Firestore 실시간 리스너)
│     │  ├─ formatters.ts             (정수 EA 포맷, SET/BOX 환산 병기, 고유 표시키)
│     │  ├─ cacheBuster.ts
│     │  ├─ logger.ts
│     │  └─ sourceExporter.ts
│     └─ components/
│        ├─ Login.tsx                 (KDT 로그인 모달 — 버전/빌드타임/입출고 권한 표시)
│        ├─ Dashboard.tsx             (메인 대시보드)
│        ├─ InventoryList.tsx         (Rule 5 윈도우 쉘 — Ver 1.1.0 리팩토링)
│        ├─ InventoryList/            (재고 목록·툴바·테이블·대분류별 40슬롯 엑셀 내보내기 모듈)
│        │  ├─ index.tsx
│        │  ├─ types.ts
│        │  ├─ InventoryToolbar.tsx
│        │  ├─ InventoryTable.tsx
│        │  └─ excelExport.ts
│        ├─ StockForm.tsx             (KDT 자재 등록/수정 폼 — 도금/규격/단위/환산/2차 BOM)
│        ├─ TransactionModal.tsx      (입출고 권한 비활성화·정수 EA·SET/BOX 환산 입력 모달)
│        ├─ MasterDataManagerModal.tsx (Rule 5 윈도우 쉘 — Ver 1.1.0 리팩토링)
│        ├─ MasterDataManagerModal/   (ZONE 별칭 이력·목표 생산수량·기준정보 CRUD 모듈)
│        │  ├─ index.tsx
│        │  ├─ types.ts
│        │  ├─ ZoneMetaModal.tsx
│        │  └─ AnalysisConfirmModal.tsx
│        ├─ UserManagerModal.tsx      (사용자 및 입출고 권한 ALL/IN_ONLY/OUT_ONLY 관리)
│        ├─ DataMigrationModal.tsx    (DB 백업/복원 모달)
│        ├─ InventoryReport.tsx       (재고 현황 보고서)
│        ├─ MonthlyReportModal.tsx    (월말 날짜 경계 보정·대분류당 40슬롯/A3 세로 미리보기·인쇄)
│        ├─ MonthlyUsageReportModal.tsx (연간 사용현황 보고서)
│        ├─ ReportModal.tsx
│        ├─ ConfirmationModal.tsx
│        ├─ ProgressModal.tsx
│        ├─ ExcelImport/              (엑셀 일괄등록 모달 — 7개 서브파일)
│        ├─ TransactionHistoryImport.tsx (일자별 수불부 양방향 임포트)
│        └─ ManualModal/              (사용자 매뉴얼 모달)
├─ functions/
│  ├─ src/
│  │  ├─ index.ts                     (서울 리전 globalOptions + 엔트리)
│  │  ├─ auth.ts                      (로그인/세션/권한 반환)
│  │  ├─ users.ts                     (KDT 기본 사용자 6명 + txPermission CRUD)
│  │  ├─ inventory.ts                 (자재 CRUD — 정수 EA + 확장 필드)
│  │  ├─ transactions.ts              (수불 CRUD — 정수 EA 원자적 갱신)
│  │  ├─ masterData.ts                (ZONE 목록·정렬·zoneMeta CRUD)
│  │  ├─ migration.ts                 (청크 삭제 안전 백업/복원)
│  │  ├─ excel.ts                     (엑셀 배치 임포트)
│  │  └─ types.ts
│  ├─ package.json
│  └─ tsconfig.json
├─ Version.json                       (버전 및 MODE Flag 일괄 관리)
├─ .firebaserc                        (kdt-inventory)
├─ firebase.json                      (Hosting rewrites — asia-northeast3 명시)
├─ _Local_run_KDT.bat                 (표준 로컬 클린빌드/실행, 포트 3500)
├─ _Cloud_run_KDT.bat                 (표준 클라우드 빌드/배포, kdt-inventory)
├─ package.json / tsconfig.json / vite.config.ts / eslint.config.js
├─ KDT_작업계획서.md                   (마스터 작업계획서)
├─ Blueprint.md                       (이 문서)
├─ Revision_history.md                (개정이력 누적)
└─ Task.md                            (세부 작업 진행 현황)
```

---

## 4. 주요 컴포넌트 및 KDT 도메인 설계 요약

| 구성요소 | 핵심 역할 및 KDT 특화 설계 |
|---|---|
| `types.ts` / `formatters.ts` | 모든 재고·수불은 **정수 EA 단일 기준**, 고정 소포장(`SET`/`BOX`)은 `eaPerUnit` 환산 병기 (`22,000 EA (11,000 SET)`). 현재고 정합성은 최신 `재고이월` 이후 입고 합계에서 출고 합계를 차감해 판단하며, 입고 이력 없이 출고만 기록된 음수 재고는 허용하고 이력과의 일치 여부로 검증. 2차 과제용 `qtyPerProduct`, `setGroup`, `zoneMeta.plannedProductionQty` 필드 선반영 |
| `MasterDataManagerModal` / `migration.ts` | 서버 즉시 동기화 시 전체 재고·거래를 마이그레이션으로 재저장. 거래는 `itemId`로 현재 품목을 찾아 `itemName`만 동기화하며, 연결 품목이 없는 과거 이력은 변경하지 않음 |
| `AppLayout` | 모든 사용자가 `재고현황` 목록에 접근할 수 있도록 사이드 메뉴에 추가. 사용현황은 월간·연간·ZONE 유형을 제공하며 월간은 `MonthlyReportModal`을 재사용. 일괄등록·수불부 등록은 관리자만 노출하고 권한 없는 저장 화면 접근을 차단 |
| `ReportModal` / `MonthlyUsageReportModal` | 재고현황 및 사용현황 보고서의 미리보기·인쇄를 A3 세로로 설정하고 페이지당 40행으로 최적화. 재고현황은 ZONE 단위로 페이지를 구분하고 실제 품목이 40개 미만이면 빈 슬롯 행을 추가해 정확히 40행을 채움(행 높이 33px). 사용현황은 ANNUAL 모드(12개월 입고/출고 월별 분해)와 ZONE 모드(월별 수불부와 동일한 기초재고·입고·출고·기말재고 컬럼, 선택 연도 전체 집계, 40행 패딩)를 제공. `MonthlyReportModal`과 `InventoryReport`도 A3 세로 사용 |
| `users.ts` / `auth.ts` / `UserManagerModal` | 관리자(`ALL`), 김수현 팀장(`IN_ONLY` 입고전용), 현장 반장·조장·계장 4명(`OUT_ONLY` 출고전용) 권한 분리 |
| `TransactionModal.tsx` | 로그인 사용자 `txPermission`에 따라 입고 또는 출고 탭/버튼 비활성화 (Phase 3 반영) |
| `InventoryList` | Rule 5(1,000라인 초과 폴더 분리) 준수 리팩토링 완료. Excel 내보내기는 ZONE별 40개 단위로 수불 시트를 늘리고 Main 요약도 대응하는 40행 블록을 생성해 전체 품목·수불을 연결. 기준정보 ZONE명 동기화 및 인쇄 배율 40% 적용 |
| `ExcelImport` / `migration.ts` | 표시용 Excel 탭과 별개로 품목·거래·기준정보 원본 탭을 보존하고, 검증된 DB 백업은 일반 일괄등록의 ZONE 확대 선택을 거치지 않는 전체 복구 경로로 처리. 일반 일괄등록은 기본적으로 파일의 ZONE만 반영하며 신규 정의의 전체 ZONE 확대는 명시 선택 시에만 수행. JSON 분할/재조립, 레코드 ID·필수값·거래 참조 검증 및 복구 건수 확인 지원 |
| `MasterDataManagerModal` / `StockForm` | 신규 품목은 기본적으로 선택한 ZONE에만 추가하고, 전체 ZONE 확대는 사용자 확인 후 누락 품목을 현재고 0으로 생성. 새 ZONE는 모든 기존 ZONE에 존재하는 공통 품목 정의만 초기화하며, 상세 화면에서 기존 ZONE 품목을 선택해 대상 ZONE에만 추가 가능. 관리자의 별도 `공통 품목 동기화`는 기존 데이터 정규화 작업으로 유지하며 신규 등록 선택과 분리 |
| `MonthlyReportModal` | 월별 수불부는 ZONE별 품목을 40행 단위로 나누고 마지막 페이지를 패딩해 41번째 이후 품목도 보고서에 포함. ZONE 2개가 각각 40개 초과이면 총 4페이지 출력 |
| `KDT template.xlsx` & Import/Export | 요약 시트 + ZONE별 40슬롯 일자별 수불부 양방향 동기화. 미사용 슬롯 품명 초기화, 템플릿 날짜별 샘플 입출고값 비복제, 초기 입고 데이터 적재 지원 |
| `MonthlyReportModal` | 로컬 달력 기준 월 선택 및 `[월초, 다음 달 1일)` 경계 적용(월말 포함). 화면 미리보기와 인쇄를 A3 세로로 통일하고 대분류별 40행 단위로 전체 페이지를 출력 |

---

## 5. 배포 및 인프라 정보

- **Firebase Project**: `kdt-inventory` (Project #932423332610, Blaze 요금제)
- **Web App**: `KDT-Inventory-Web` (`1:932423332610:web:099bcdb45fc4535df1481b`)
- **Region**: `asia-northeast3` (서울) — Firestore & Cloud Functions v2
- **Hosting URL**: `https://kdt-inventory.web.app/login`
- **Local Port**: `3500`
- **GitHub**: `https://github.com/youhwanjung-dot/KDT-Inventory.git`

---

## 6. 전체 로드맵 (Phase 단위 큰 그림)

> 버전별 세부 변경 이력은 [`Revision_history.md`](./Revision_history.md)를 참조하십시오.

| Phase | 범위 | 주요 내용 | 상태 |
|---|---|---|---|
| **Phase 0** | 사전 설계 | 1~3차 QnA, DB 스키마 및 입출고 권한(C1~C4) 확정 | 완료 |
| **Phase 1** | 기반 이식 | Firebase `kdt-inventory` 웹앱·서울 설정, Asan 재고 코어 선별 이식, Functions v2 + KDT 스키마/6명 사용자, 빌드 스크립트 2종 | 완료 (Ver 1.0.0) |
| **Phase 2** | KDT 핵심 UI·권한 | `UserManagerModal`, `TransactionModal`, `StockForm`, `InventoryList/`(50슬롯·연도캘린더·공통자재 합산·ZONE 정산), `MasterDataManagerModal/`(ZONE 별칭·생산수량) | 완료 (Ver 1.1.0) |
| **Phase 3** | 데이터 시드 & 입고 파서 | 초기 32품목/33건 데이터 시드, 입고시트 전용 파서, 대시보드 정수 EA 최적화 | 완료 (Ver 1.2.0) |
| **Phase 4** | 배포·운영·보고서·Excel | 클라우드 배포, 운영 DB 초기 적재·백업 복구, 보고서 A3 세로 및 40행 통일, ZONE 40개 초과 Excel 자동 확장, 품목·거래·기준정보 원본 보존 및 전용 DB 복구, 공통 품목 정합성 동기화, 신규 품목 ZONE 적용 범위 선택, 공통 품목 교집합 초기화 및 기존 품목 선택 추가 | Ver 1.3.38 Hosting 배포 완료; 운영 동기화·복구 확인 대기 |
| **2차 과제** | 자동 소요량 산출 | ZONE 목표 생산수량 × `qtyPerProduct`(1대당 소요량) 기반 필요/부족 자재 자동 산출 (DB 스키마 선반영 완료) | 예정 (Ver 2.0.0) |
