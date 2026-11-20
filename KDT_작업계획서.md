# KDT 자재 재고관리 시스템 구축 작업계획서 (KDT-Inventory)

> 작성: 경훈시스템 부설 자동화 연구소 수석연구원 최박사
> 최초 작성: 2026-11-19 / 최종 개정: 2026-11-22 (Ver 1.3.38 반영)
> 기준 프로젝트: `D:\M_PROJECT\Asan-Inventory_3400` (Ver 5.34.0, 읽기 전용 참조)
> 대상 프로젝트: `D:\M_PROJECT\KDT-Inventory_3500`
> Firebase Project: `kdt-inventory` (#932423332610) / 리전: `asia-northeast3` (서울) / Blaze 요금제
> GitHub: `https://github.com/youhwanjung-dot/KDT-Inventory.git`
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
6. **엑셀 공동작업 양방향**: 요약 시트 + ZONE별 **40개 고정 슬롯(미등록 품목 빈 슬롯 포함)** 수불부 양방향 Import/Export, ZONE명 동기화, `_user/KDT-Inventory.xlsx` 입고 리스트 초기 이관 지원
7. **초기 사용자 (6명)**: `관리자`, `김수현 팀장`, `황호동 반장`, `문자운 조장`, `김민기 조장`, `이호준 계장` (사용자관리에서 추가/수정/삭제)

---

## 3. 재활용 매트릭스 (Asan → KDT)

| 구분 | 대상 | 처리 방침 |
|---|---|---|
| **그대로 재사용** | `Login`, `ConfirmationModal`, `UserManagerModal`, `DataMigrationModal`, `ManualModal` 골격, `utils/*`(api, logger, cacheBuster, formatters), `functions/auth.ts`·`users.ts`·`migration.ts`, Vite/ESLint/TS 설정, `backup_ver.ps1` | 명칭(`KDT`)·포트(`3500`)·리전(`asia-northeast3`)·기본 사용자 치환 |
| **스키마 반영 수정** | `types.ts`, `InventoryList`(**1,000라인 초과→폴더 분리 리팩토링**), `StockForm`, `TransactionModal`, `Dashboard`, `MasterDataManagerModal`(대분류→ZONE + 별칭/생산수량), `ReportModal`·`MonthlyReportModal`·`MonthlyUsageReportModal`, `ExcelImport/*`, `TransactionHistoryImport`, `functions/inventory.ts`·`transactions.ts`·`masterData.ts`·`excel.ts`, `firestore.rules`/`indexes` | 도금·규격·단위·eaPerUnit·보관위치·2차 BOM 필드 반영, 정수 EA 처리 |
| **신규 작성** | `KDT template.xlsx` (요약 시트 + ZONE별 40슬롯 수불부), `KDT-Inventory.xlsx` 입고시트 파서(초기 데이터 임포트), `_Local_run_KDT.bat`, `_Cloud_run_KDT.bat` | KDT 전용 리소스 및 스크립트 |
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

## 5. 엑셀 공동작업 파일 (양방향 — 대분류별 40슬롯 고정 & 연도별 캘린더)

1. **요약 시트 (기본 `현 재고`)**:
   - 컬럼: `연번 | ZONE(대분류) | 품명 | 도금 | 규격 | 단위/환산 | 현재고(EA) | 보관위치 | 1대당소요 | 비고`
   - 선택된 대상 연도(`targetYear`, 예: 2026년 → 2027년)에 맞춰 타이틀(`{targetYear}년 KDT 자재 재고현황`) 및 각 ZONE 시트 연간 최종 잔량(`=ZONE시트!D390` 등) 자동 수식 참조
2. **ZONE별 일자 수불부 시트 (대분류당 40슬롯 고정)**:
   - 시트명 = ZONE 표시명 (`ZONE16_Plus`, `ZONE18` 등)
   - **고정 슬롯**: ZONE당 정확히 **40개 품목 슬롯** (`col = 2, 6, 10 ... 158`, 4열 간격), 미등록 품목용 빈 슬롯 포함. 등록 품목은 슬롯 앞에서부터 순서대로 배치
   - **수불 이력 검증**: 품명 없는 슬롯은 직전 품목명을 상속하지 않으며, 템플릿의 날짜별 샘플 입출고 수량은 새 슬롯으로 복사하지 않음
   - **인쇄 배율**: 요약 및 ZONE 시트의 페이지 설정을 40%로 고정
   - **연도별 캘린더 자동 갱신 (2026 → 2027 등)**:
     - 엑셀 내보내기 시 대상 연도(`targetYear`)를 기준으로 A열 1월~12월 일자 및 상단 연도 헤더를 자동 갱신
     - `targetYear` 이전 누적 잔고는 **Row 4 (기초 이월재고)** 로 자동 합산 이월하고, `targetYear` 당해 연도 입출고만 일자별 셀에 기록
   - 상단 헤더(R3): 고유 표시키 (`품명 [도금/규격]`) → 동일 품명 충돌 방지
3. **월별 재고 수불 보고서**:
   - 대분류별 정확히 40행(등록 품목 + 미등록 슬롯)으로 고정하고 대분류마다 1페이지 출력
   - 미리보기와 인쇄를 A3 세로 방향으로 통일하고, 대분류가 2개면 총 2페이지 (월별 보고서에만 적용)
   - 월 경계는 `[월초, 다음 달 1일)` 반개구간으로 처리해 월말 거래를 포함하고 다음 달 1일 거래는 제외
   - 선택 월에 입출고가 없는 품목을 체크박스로 미리보기 및 인쇄에서 함께 숨김 처리
4. **공통 소분류 기준정보**:
   - 신규 소분류·자재는 기본적으로 선택한 ZONE에만 추가하며, 재고현황·Excel·수불부·기준정보에서 전체 ZONE 확대 여부를 사용자에게 확인
   - 전체 적용을 선택한 경우에만 누락된 ZONE의 `namesByCategory`와 재고 품목 레코드를 추가; 신규 레코드는 `currentStock: 0`으로 시작하며 거래 이력은 생성하지 않음
   - 새 대분류 생성 시에는 모든 기존 ZONE에 공통으로 존재하는 `품명+도금+규격` 정의만 새 ZONE에 자동 초기화하고, 현재고·적정재고는 0으로 설정
   - ZONE 상세에서 다른 ZONE의 기존 품목을 검색·선택해 대상 ZONE에만 추가하며, 기존 재고와 거래 이력은 복사하지 않음
   - 기존 DB 품목 차이를 맞추는 관리자 `공통 품목 동기화`는 별도 확인형 정규화 작업으로 유지하고, Excel DB 복구는 원본 그대로 복원
5. **ZONE 간 중복(공통) 소분류 및 현장 혼입·정산 대응**:
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
| 시작 버전 | Ver 5.34.0 | **`Ver 1.0.0`** (현재 **`Ver 1.3.38`**, Hosting 배포 완료) |

> MODE Flags(`VERSION_MODE`, `MOCKUP_MODE`, `STORAGE_MODE`)는 [`Blueprint.md`](./Blueprint.md) 섹션 1에서 일괄 관리합니다.

---

## 7. 단계별 추진 일정 및 실시간 모니터링 (Master Roadmap)

> **실시간 상태**: **현재 Ver 1.3.38; Hosting 배포 완료(사용자 확인). 신규 품목의 전 ZONE 확대는 명시 선택. 새 대분류에는 기존 ZONE 모두에 공통인 품목 정의만 현재고·적정재고 0으로 자동 초기화하고, 단일 ZONE 품목은 검색·선택해 해당 ZONE에만 추가. 기존 재고·거래 이력은 복사하거나 수정하지 않음. 정확 DB 복구는 원본 그대로 반영. 타입검사·프로덕션 빌드 통과, 수정 파일 ESLint 오류 없음(기존 Hook 경고 1건). 운영 DB 공통 품목 동기화는 미실행** (최종 갱신: `2026-11-22`)
> **운영 접속 URL**: **`https://kdt-inventory.web.app/login`** (서울 리전 `asia-northeast3` Cloud Functions v2 + Firestore 실시간 연동 완료)
> **버전별 세부 개정 이력**: [`Revision_history.md`](./Revision_history.md) 참조

| 단계 | 세부 작업 | 상태 | 반영 버전 |
|:---|:---|:---:|:---:|
| **Phase 0** | 1차·2차·3차 QnA 완료, DB 스키마 및 입출고 권한(C1~C4) 최종 확정 | **완료** | – |
| **Phase 1** | Firebase `kdt-inventory` 웹앱·서울 설정, Asan 재고 코어 선별 이식, Functions v2 서울 리전 + KDT 스키마/6명 사용자 백엔드, 빌드 스크립트 2종, 클린빌드 0에러, `backup/Ver1.0.0`, GitHub 1차 푸시 | **완료** | Ver 1.0.0 |
| **Phase 2** | **KDT 핵심 UI·권한·Rule 5 리팩토링 + 50슬롯/연도캘린더/혼입합산·정산**: `UserManagerModal`, `TransactionModal`, `StockForm`, `InventoryList/`, `MasterDataManagerModal/`, `TransactionHistoryImport`, `ReportModal` | **완료** | Ver 1.1.0 |
| **Phase 3** | **초기 32품목/33건 데이터 시드 & 입고시트 전용 파서 & 대시보드**: `_user/KDT-Inventory.xlsx` 데이터 시드, `LegacyParser.ts` 입고시트 파서, 대시보드 정수 EA 최적화 | **완료** | Ver 1.2.0 |
| **Phase 4** | **배포·운영·보고서·Excel 안정화 (Ver 1.3.0 ~ Ver 1.3.38)**: 클라우드 배포, 운영 DB 적재·백업 복구, 전체 보고서 A3 세로 및 40행 페이지 통일, ZONE 40개 초과 Excel 시트/Main 자동 확장, 품목·거래·기준정보 원본 탭과 정확한 DB 복구 경로, 공통 품목 정합성 명시적 동기화, 신규 품목 ZONE 적용 범위 선택, 공통 품목 교집합 초기화와 기존 품목 선택 추가 | **Ver 1.3.38 Hosting 배포 완료; 운영 동기화·복구 확인 대기** | Ver 1.3.38 |
| **2차 과제** | ZONE 목표 생산수량 × `qtyPerProduct`(1대당 소요량) 기반 필요/부족 자재 자동 산출 (DB 스키마 선반영 완료) | 예정 | Ver 2.0.0 |
