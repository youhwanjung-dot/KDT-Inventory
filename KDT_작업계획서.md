# KDT 자재 재고관리 시스템 구축 작업계획서 (KDT-Inventory)

> 작성: 경훈시스템 부설 자동화 연구소 수석연구원 최박사
> 최초 작성: 2026-11-19 / 최종 개정: 2026-11-19 (2차 QnA 반영 — 확정안)
> 기준 프로젝트: `D:\M_PROJECT\Asan-Inventory_3400` (Ver 5.34.0, 읽기 전용 참조)
> 대상 프로젝트: `D:\M_PROJECT\KDT-Inventory_3500`
> Firebase Project: `kdt-inventory` (#932423332610) / 리전: `asia-northeast3` (서울) / Blaze 요금제
> GitHub: `https://github.com/youhwanjung-dot/KDT-Inventory.git` (예정)
> 질의응답 채널: [`_user/QmA.md`](./_user/QmA.md)

---

## 1. 개요 및 기본 원칙

아산노블 재고관리 시스템(Asan-Inventory, Ver 5.34.0)에서 운영 검증된 아키텍처와 코딩 기법을 그대로 계승하여,
KDT 제조 현장의 **ZONE(대분류) 단위 자재 입출고 및 재고관리 시스템**을 구축합니다.

| 원칙 | 확정 내용 |
|---|---|
| **아키텍처 동일성** | React 18 + Vite 5 + TypeScript + Tailwind / Firebase Hosting + Cloud Functions(v2) + Firestore |
| **검증 코드 재활용** | 아산노블 **재고관리 파트**만 선별 이관, 스키마·도메인 용어 등 불가피한 부분만 수정 (재활용률 ~85%) |
| **이관 제외** | 요양원 전용 플러그인 4종(일정표·어르신 관리카드·기능회복훈련·설문지), AI 어드바이저, Python 서버 |
| **수량 관리 원칙** | **실수량만 반영** (비고는 참고용), **최종 개수(`EA`, 정수) 단일 기준** 관리 (소포장 단위 참고/환산 병기) |
| **2차 확장 선반영** | ZONE별 목표 생산수량 및 제품 1대당 소요량(`1 SET`)은 2차 과제로 두되 **DB 스키마에 선반영** |
| **연구소 규약 준수** | `Ver 1.0.0` 시작 / `Version.json` / `_Local_run_KDT.bat`·`_Cloud_run_KDT.bat` / 1,000라인 리팩토링 / backup / MODE Flag |

---

## 2. 확정 도메인 요구사항 요약

1. **대분류 = ZONE**: 독립 대분류이며 고객사별 별칭 변경 가능(`ZONE+숫자`, `Fluid+숫자` 등) → **불변 `zoneId` + 변경 가능한 표시명** 구조로 이력 보존
2. **ZONE별 분리 수불**: 공통 자재(예: 부스바)가 많으나 대분류 단위로 공급·소모되므로 입고·출고·재고 이력은 ZONE별 분리 관리
3. **품목 식별 확장**: `품명 + 도금(3가/SUS) + 규격(M6*16 등)` 3요소로 품목 식별
4. **SET 구성품 개별 관리**: `육각볼트 SET`의 총 SET 수량·구성비율은 무시하고, 실제 관리 대상인 **구성품(볼트/너트/스프링와셔/평와셔)**별로 개별 입출고 관리
5. **입출고 항목**: 작업자, 일자, 품목, 수량, 입고/출고 + 보관위치(`location`), 비고(`note`) — 기본 화면은 아산노블 기준
6. **엑셀 공동작업 양방향**: 아산노블과 동일한 **일자별 수불부 시트 (`현 재고` + ZONE별 30슬롯 시트)** 양방향 Import/Export + `_user/KDT-Inventory.xlsx` 입고 리스트 초기 이관 지원
7. **초기 사용자 (6명)**: `관리자`, `김수현 팀장`, `황호동 반장`, `문자운 조장`, `김민기 조장`, `이호준 계장` (사용자관리에서 추가/수정/삭제)

---

## 3. 재활용 매트릭스 (Asan → KDT)

| 구분 | 대상 | 처리 방침 |
|---|---|---|
| **그대로 재사용** | `Login`, `ConfirmationModal`, `UserManagerModal`, `DataMigrationModal`, `ManualModal` 골격, `utils/*`(api, logger, cacheBuster, formatters), `functions/auth.ts`·`users.ts`·`migration.ts`, Vite/ESLint/TS 설정, `backup_ver.ps1` | 명칭(`KDT`)·포트(`3500`)·리전(`asia-northeast3`)·기본 사용자 치환 |
| **스키마 반영 수정** | `types.ts`, `InventoryList`(**1,000라인 초과→폴더 분리 리팩토링**), `StockForm`, `TransactionModal`, `Dashboard`, `MasterDataManagerModal`(대분류→ZONE + 별칭/생산수량), `ReportModal`·`MonthlyReportModal`·`MonthlyUsageReportModal`, `ExcelImport/*`, `TransactionHistoryImport`, `functions/inventory.ts`·`transactions.ts`·`masterData.ts`·`excel.ts`, `firestore.rules`/`indexes` | 도금·규격·단위·eaPerUnit·보관위치·2차 BOM 필드 반영, 정수 EA 처리 |
| **신규 작성** | `KDT template.xlsx` (현 재고 + ZONE별 30슬롯 수불부), `KDT-Inventory.xlsx` 입고시트 파서(초기 데이터 임포트), `_Local_run_KDT.bat`, `_Cloud_run_KDT.bat` | KDT 전용 리소스 및 스크립트 |
| **제외 (미이관)** | `_plugin/*` 4종, `AIAdvisor`, `scripts/*_server.py`, `hwp_generator.py`, `functions/schedule.ts`·`survey.ts` | 완전 제거 |

---

## 4. 최종 DB 스키마 (Firestore — `asia-northeast3`)

> 아산노블 컬렉션 구조(`inventory`, `transactions`, `masterData`, `config/users`, `metadata`)를 그대로 유지하여 기존 실시간 구독(`onSnapshot`) 및 Cloud Functions 로직을 최대한 재활용합니다.

### 4.1. `inventory/{itemId}` — 자재 마스터 및 ZONE별 현재고

| 필드 | 타입 | 필수 | 설명 | 비고 |
|---|---|:---:|---|---|
| `id` | string | O | Firestore 문서 ID | Asan 동일 |
| `category` | string | O | ZONE 표시명 (예: `ZONE16_Plus`, `ZONE18`) | Asan `category` 호환 |
| `zoneId` | string | O | **[신규]** 불변 ZONE ID (예: `Z001`) | 별칭 변경 시 이력 유지 |
| `name` | string | O | 품명 (소분류) | Asan 동일 |
| `plating` | string | - | **[신규]** 도금 (예: `3가`, `SUS`, `""`) | 품목 식별 요소 |
| `spec` | string | - | **[신규]** 규격 (예: `M6*25`, `M8`, `""`) | 품목 식별 요소 |
| `unit` | `'EA' \| 'SET' \| 'BOX'` | O | 공급/표시 단위 (기본 `EA`) | 참고 환산용 |
| `eaPerUnit` | number | O | **[신규]** 1단위당 EA 수량 (기본 `1`, 가스켓 `2`, 스티커 `3`, 드라이업 `60`) | 화면 환산 병기 |
| `currentStock` | number | O | 현재고 (**정수 EA 기준**) | Asan 동일 |
| `safeStock` | number | O | 적정재고 (EA) | Asan 동일 |
| `location` | string | - | 보관위치 (랙/선반 등) | Asan `location` |
| `note` | string | - | 비고 (소포장 pkg 내역 등 참고용) | Asan `note` |
| `qtyPerProduct` | number | - | **[2차 선반영]** 완제품 1대당 소요 수량 (엑셀 `1 SET` 열) | 2차 BOM 자동계산용 |
| `setGroup` | string | - | **[2차 선반영]** 소속 SET 그룹명 (예: `육각볼트 SET M6*25`) | 2차 BOM 그룹핑용 |
| `orderCategory` / `orderName` | number | - | 정렬 순서 | Asan 동일 |
| `lastUpdated` | string | O | 최종수정일 (`YYYY-MM-DD`) | Asan 동일 |

### 4.2. `transactions/{txId}` — ZONE별 입출고 수불 이력

| 필드 | 타입 | 설명 |
|---|---|---|
| `id`, `itemId`, `date`, `type` (`'IN' \| 'OUT'`) | string | Asan 동일 |
| `category`, `zoneId` | string | ZONE 표시명 + 불변 ID |
| `itemName`, `plating`, `spec` | string | 품목 스냅샷 |
| `quantity` | number | 입출고 실수량 (**정수 EA**) |
| `worker` | string | 작업자 (기본 사용자 연동) |
| `department`, `reason` | string | 부서 / 사유·비고 (소포장 참고 메모 포함) |
| `currentStockSnapshot` | number | 거래 직후 현재고 스냅샷 (EA) |

### 4.3. `masterData/custom` — ZONE 목록 및 정렬·메타정보

```ts
{
  categories: string[];                   // ZONE 표시명 순서 (Asan 호환)
  namesByCategory: Record<string, string[]>; // ZONE별 품목 표시키 순서 (Asan 호환)
  nameOrder: string[];                    // 전역 정렬 보조 (Asan 호환)
  zoneMeta: Record<string, {              // [신규 + 2차 선반영] key = zoneId
    zoneId: string;                       // 불변 내부 ID (예: "Z001")
    displayName: string;                  // 현재 표시명 (예: "ZONE18" → "Fluid18")
    customer?: string;                    // 고객사명
    plannedProductionQty?: number;        // [2차 선반영] 목표 생산 수량 (예: 9600)
    actualProductionQty?: number;         // [2차 선반영] 실적 수량
    aliasHistory?: { name: string; changedAt: string }[];
  }>;
}
```

### 4.4. `config/users` — 사용자 및 권한 (Asan 동일 구조)
- 초기 시드: `관리자`(admin), `김수현 팀장`, `황호동 반장`, `문자운 조장`, `김민기 조장`, `이호준 계장`

---

## 5. 엑셀 공동작업 파일 (`KDT-Inventory.xlsx` 양방향 — 50슬롯 & 연도별 동적 캘린더)

1. **`현 재고` 시트**:
   - 컬럼: `연번 | ZONE(대분류) | 품명 | 도금 | 규격 | 단위/환산 | 현재고(EA) | 보관위치 | 1대당소요 | 비고`
   - 선택된 대상 연도(`targetYear`, 예: 2026년 → 2027년)에 맞춰 타이틀(`{targetYear}년 KDT 자재 재고현황`) 및 각 ZONE 시트 연간 최종 잔량(`=ZONE시트!D390` 등) 자동 수식 참조
2. **ZONE별 일자 수불부 시트 (30슬롯 → 50슬롯 확장)**:
   - 시트명 = ZONE 표시명 (`ZONE16_Plus`, `ZONE18` 등)
   - **슬롯 확장**: ZONE당 소분류 최대 **50개 품목 슬롯** (`col = 2, 6, 10 ... 198`, 50슬롯 × 4열 = 200열) 동적 수식·서식 생성
   - **연도별 캘린더 자동 갱신 (2026 → 2027 등)**:
     - 엑셀 내보내기 시 대상 연도(`targetYear`)를 기준으로 A열 1월~12월 일자 및 상단 연도 헤더를 자동 갱신
     - `targetYear` 이전 누적 잔고는 **Row 4 (기초 이월재고)** 로 자동 합산 이월하고, `targetYear` 당해 연도 입출고만 일자별 셀에 기록
   - 상단 헤더(R3): 고유 표시키 (`품명 [도금/규격]`) → 동일 품명 충돌 방지
3. **ZONE 간 중복(공통) 소분류 및 현장 혼입·정산 대응**:
   - **엄격한 4요소 키 매칭**: `ZONE + 품명 + 도금 + 규격` 조합으로 ZONE별 장부 분리
   - **[공통자재 합산 뷰 (현장 혼입 실사 모드)]**: 재고 현황 화면에서 `품명 + 도금 + 규격` 기준으로 전 ZONE 재고를 합산해 **작업장 실물 총재고**와 **ZONE별 장부 배분량**을 동시에 대조하는 토글 뷰 제공
   - **[ZONE 완료 반납·이관 정산 기능]**: ZONE 작업 완료 시 잔여 재고를 반납 정산(출고)하거나 신규 ZONE으로 일괄 이관(정산출고 + 신규 ZONE 이관입고)하는 정산 모달 지원

---

## 6. 환경 및 배포 구성

| 항목 | Asan-Inventory | KDT-Inventory |
|---|---|---|
| Firebase Project | `asannoble-inventory` | `kdt-inventory` (#932423332610) |
| Firestore / Functions 리전 | `us-central1` | **`asia-northeast3` (서울)** (`firebase.json` rewrites에도 `"region": "asia-northeast3"` 명시) |
| Hosting URL | asannoble-inventory.web.app | `https://kdt-inventory.web.app/login` |
| 로컬 포트 | 3400 / 3410 | **`3500`** (단일 포트) |
| 빌드 스크립트 | `_Local_run_inventory.bat` / `_Cloud_run_inventory.bat` | **`_Local_run_KDT.bat`** / **`_Cloud_run_KDT.bat`** (영문 ASCII 표준) |
| 시작 버전 | Ver 5.34.0 | **`Ver 1.0.0`** (현재 **`Ver 1.1.0`**) |

| MODE Flag (`Version.json`) | 초기값 | 비고 |
|---|---|---|
| `VERSION_MODE` | `1.1.0` | 하드코딩 금지, `Version.json` → Vite 주입 → 로그인 모달 표시 |
| `MOCKUP_MODE` | ON → OFF | 초기 GUI 검증용 목업 분기 유지 (삭제 금지) |
| `STORAGE_MODE` | `Cloud` | Firebase Firestore + 로컬 분기 코드 보존 (캐시 금지) |

---

## 7. 단계별 추진 일정 및 실시간 모니터링 (Master Roadmap)

> **실시간 상태**: **Phase 1 ~ Phase 4 (`Ver 1.3.1`) 전 과정 100% 구축 및 클라우드 배포·Hotfix 완료·운영 DB 32품목/33건 적재 완료!** (최종 갱신: `2026-11-19 16:25` / 버전: `Ver 1.3.1`)
> **운영 접속 URL**: **`https://kdt-inventory.web.app/login`** (서울 리전 `asia-northeast3` Cloud Functions v2 + Firestore 실시간 연동 완료)

| 단계 | 세부 작업 | 상태 | 반영 버전 |
|:---|:---|:---:|:---:|
| **Phase 0** | 1차·2차·3차 QnA 완료, DB 스키마 및 입출고 권한(C1~C4) 최종 확정 | **완료** | – |
| **Phase 1** | Firebase `kdt-inventory` 웹앱·서울 설정, Asan 재고 코어 선별 이식, Functions v2 서울 리전 + KDT 스키마/6명 사용자 백엔드, 빌드 스크립트 2종, 클린빌드 0에러, `backup/Ver1.0.0`, GitHub 1차 푸시 | **완료** | Ver 1.0.0 |
| **Phase 2** | **KDT 핵심 UI·권한·Rule 5 리팩토링 + 50슬롯/연도캘린더/혼입합산·정산**: `UserManagerModal`, `TransactionModal`, `StockForm`, `InventoryList/`(50슬롯·연도별 캘린더·공통자재 합산뷰·ZONE 정산), `MasterDataManagerModal/`(ZONE 별칭·생산수량), `TransactionHistoryImport`, `ReportModal` | **완료** | Ver 1.1.0 |
| **Phase 3** | **초기 32품목/33건 데이터 시드 & 입고시트 전용 파서 & 대시보드**: `_user/KDT-Inventory.xlsx` 32품목/33건(`ZONE16_Plus` 10품목, `ZONE18` 22품목, 평와셔 M8 46,100 EA 통합) `initialData.ts`·`initialTransactions.ts` 및 원클릭 초기 적재 기능 탑재, `LegacyParser.ts` 입고시트(`육각볼트 SET`+`ㅁ` 구성품 분리) 직접 임포트 지원, 대시보드 정수 EA 최적화 | **완료** | Ver 1.2.0 |
| **Phase 4** | **배포 및 실접속 검증**: 클린빌드 검증 → `backup/Ver1.2.0` → Firebase(`kdt-inventory`, 서울 리전 `asia-northeast3`) 배포 → 운영 DB 초기 32품목/33건/6명 사용자/`zoneMeta` 시드 적재 → `https://kdt-inventory.web.app/login` 실접속 및 API 200 OK 검증 완료 | **완료 (100%)** | Ver 1.3.0 |
| **Hotfix** | **빌드 에러 해결 및 호환 심볼 추가**: `StepPreview.tsx`와 `formatters.ts`의 `formatStockWithRef` 누락 심볼 수정, `functions/src` 엄격 타입 검사 수정, Vite 클린 빌드(0 에러) 검증 후 Hosting 재배포 완료 | **완료 (100%)** | Ver 1.3.1 |
| **2차 과제** | ZONE 목표 생산수량 × `qtyPerProduct`(1대당 소요량) 기반 필요/부족 자재 자동 산출 (DB 스키마 선반영 완료) | 예정 | Ver 2.0.0 |

### ▶ Phase 4 (`Ver 1.3.0` ~ `Ver 1.3.1`) 세부 진행 로그 (실시간 갱신)
- [x] `4-1` 프론트엔드 및 백엔드(`functions/lib`, Node.js 22 2nd Gen, Lazy Admin SDK) 클린빌드 0에러 검증 완료
- [x] `4-2` `backup/Ver1.2.0` 롤백 아카이브 생성 및 GitHub 커밋/푸시 완료
- [x] `4-3` Firebase(`kdt-inventory`, 서울 리전 `asia-northeast3`) Firestore Rules/Indexes, Cloud Functions v2 (8개 전체 함수), Hosting(`https://kdt-inventory.web.app`) 배포 완료
- [x] `4-4` 운영 Firestore DB 초기 데이터(`ZONE16_Plus` 10품목 + `ZONE18` 22품목 = 32품목, 33건 입고 이력, 6명 기본 사용자, `masterData.zoneMeta`) 시드 적재 및 라이브 API 200 OK 검증 완료
- [x] `4-5` `formatStockWithRef` export 누락 및 functions 타입 에러 긴급 패치(Hotfix) 완료
- [x] `4-6` Vite 클린 빌드 0에러 확인, Firebase Hosting 배포 완료, 라이브 웹앱 정상 로드 및 8개 API 엔드포인트 200 OK 검증 완료
- [x] `4-7` `Ver 1.3.1` 최종 버전 갱신, 로컬(`3500`) 및 클라우드(`https://kdt-inventory.web.app/login`) 정상 가동 완료



