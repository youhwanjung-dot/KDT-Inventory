/**
 * @file Common type definitions for KDT Inventory System
 * @description TypeScript types converted to JSDoc for JavaScript
 */

/**
 * Category Enum
 * @enum {string}
 */
export const Category = {
    MEDICAL: '의료소모품',
    HYGIENE: '위생용품',
    FOOD: '식자재',
    OFFICE: '사무용품',
    FACILITY: '시설관리',
    ETC: '기타'
};

/**
 * @typedef {Object} InventoryItem
 * @property {string} id - Unique identifier
 * @property {string} name - 소분류 (품목명)
 * @property {string} category - 대분류
 * @property {string} pkgUnit - [포장단위] 1팩에 들어있는 낱개 수량
 * @property {string} pkgType - [박스(묶음)구성] 낱개/중포장 단위 명칭
 * @property {string} outerPkg - [소포장 개수] 1박스에 들어있는 팩 수량
 * @property {string} unit - 관리단위 (박스, 개, 통)
 * @property {number} currentStock - 잔량 (현재고)
 * @property {number} safeStock - 적정재고
 * @property {string} location - 보관장소
 * @property {string} supplier - 사용부서
 * @property {string} lastUpdated - 최종수정일
 * @property {string} [note] - 비고
 */

/**
 * @typedef {Object} InventoryTransaction
 * @property {string} id - Unique identifier
 * @property {string} itemId - Item ID
 * @property {string} itemName - Item name
 * @property {string} category - Category
 * @property {string} date - YYYY-MM-DD
 * @property {'IN'|'OUT'} type - 입고 | 출고
 * @property {number} quantity - Quantity
 * @property {string} worker - 작업자
 * @property {string} department - 작업부서
 * @property {string} reason - 사용내역
 * @property {number} currentStockSnapshot - 거래 직후 재고
 */

/**
 * @typedef {'DASHBOARD'|'INVENTORY'|'ANALYSIS'|'IMPORT'|'HISTORY_IMPORT'} ViewState
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} totalItems - Total number of items
 * @property {number} lowStockCount - Number of low stock items
 * @property {number} totalCategories - Total number of categories
 */

/**
 * @typedef {'admin'|'user'} UserRole
 */

/**
 * @typedef {Object} User
 * @property {string} id - Unique ID
 * @property {string} name - Display name (직책/이름)
 * @property {string} password - Password
 * @property {UserRole} role - User role
 */

// Export empty object to make this a module
export default {};
