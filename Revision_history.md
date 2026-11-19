# Revision History — KDT-Inventory

| 버전 | 일자 | 구분 | 주요 변경사항 |
|---|---|---|---|
| **Ver 1.0.0** | 2026-11-19 | Major (승인) | **Phase 1 초기 마이그레이션 완료**: `Asan-Inventory_3400` (Ver 5.34.0)에서 재고관리 코어만 선별 이관(요양원 플러그인 4종 및 AI 분석 제외). Firebase `kdt-inventory` 웹앱(`KDT-Inventory-Web`) 등록, 서울 리전(`asia-northeast3`) Functions/Hosting 설정, KDT 확장 DB 스키마(`zoneId`, `plating`, `spec`, `eaPerUnit`, `qtyPerProduct`, `setGroup`, `zoneMeta`, `txPermission`) 및 6명 기본 사용자 시드 반영, `_Local_run_KDT.bat` / `_Cloud_run_KDT.bat` 구축, GitHub 원격 저장소 연동. |
