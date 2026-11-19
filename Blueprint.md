# Blueprint — KDT Material Inventory Management System (KDT-Inventory)

> 작성: 경훈시스템 부설 자동화 연구소 수석연구원 최박사
> 기준 프로젝트: `Asan-Inventory_3400` (Ver 5.34.0) 기반 재고관리 파트 선별 이관

## 1. 버전 및 MODE Flags (`Version.json` 일괄 관리)

| Flag | 현재 값 | 설명 |
|---|---|---|
| `VERSION_MODE` | `1.3.7` | `Version.json` → Vite 빌드타임 주입 → 로그인 모달 표시 |
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
│        ├─ MonthlyReportModal.tsx    (월말 날짜 경계 보정·대분류당 40슬롯/A3 세로 1페이지 보고서)
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
| `types.ts` / `formatters.ts` | 모든 재고·수불은 **정수 EA 단일 기준**, 고정 소포장(`SET`/`BOX`)은 `eaPerUnit` 환산 병기 (`22,000 EA (11,000 SET)`). 2차 과제용 `qtyPerProduct`, `setGroup`, `zoneMeta.plannedProductionQty` 필드 선반영 |
| `users.ts` / `auth.ts` / `UserManagerModal` | 관리자(`ALL`), 김수현 팀장(`IN_ONLY` 입고전용), 현장 반장·조장·계장 4명(`OUT_ONLY` 출고전용) 권한 분리 |
| `TransactionModal.tsx` | 로그인 사용자 `txPermission`에 따라 입고 또는 출고 탭/버튼 비활성화 (Phase 3 반영) |
| `InventoryList` | Rule 5(1,000라인 초과 폴더 분리) 준수 리팩토링 완료. 대분류별 40개 고정 슬롯(미등록 품목용 빈 슬롯 포함), 기준정보 ZONE명 동기화, 인쇄 배율 40% 적용 |
| `KDT template.xlsx` & Import/Export | 요약 시트 + ZONE별 40슬롯 일자별 수불부 양방향 동기화. 미사용 슬롯 품명 초기화, 템플릿 날짜별 샘플 입출고값 비복제, 초기 입고 데이터 적재 지원 |
| `MonthlyReportModal` | 로컬 달력 기준 월 선택 및 `[월초, 다음 달 1일)` 경계 적용(월말 포함). 대분류마다 40행을 고정하고 A3 세로 1페이지씩 출력 (현재 2개 대분류 = 2페이지) |

---

## 5. 배포 및 인프라 정보

- **Firebase Project**: `kdt-inventory` (Project #932423332610, Blaze 요금제)
- **Web App**: `KDT-Inventory-Web` (`1:932423332610:web:099bcdb45fc4535df1481b`)
- **Region**: `asia-northeast3` (서울) — Firestore & Cloud Functions v2
- **Hosting URL**: `https://kdt-inventory.web.app/login`
- **Local Port**: `3500`
- **GitHub**: `https://github.com/youhwanjung-dot/KDT-Inventory.git`

---

## 6. 향후 개발 일정 (Roadmap)

- **Phase 1~4 (Ver 1.0.0~1.3.2)**: 기반 이식, 권한·UI·데이터 시드, 서울 리전 배포 및 운영 검증, KDT 용어·매뉴얼 정비 완료
- **Excel/월별 보고서 (Ver 1.3.4~1.3.8)**: 대분류 양방향 동기화, 40슬롯 고정, 빈 슬롯 이력 오등록 방지, Excel 인쇄 40%, 월별 보고서 대분류별 40행·A3 세로 1페이지 및 월말 경계 보정 완료
- **클린빌드/배포**: Ver 1.3.8 타입검사 및 프로덕션 빌드 완료; Firebase 배포는 대기
- **2차 과제 (Ver 2.0.0)**: ZONE 목표 생산수량 × `qtyPerProduct` 기반 필요/부족 자재 자동 산출
