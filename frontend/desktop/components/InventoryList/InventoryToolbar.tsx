import React, { useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  FileDown,
  LayoutTemplate,
  AlertCircle,
  ChevronDown,
  XCircle,
  X,
  CheckSquare,
  Square,
  Calendar,
  History,
  RotateCcw,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { User } from '../../types';

export type InventoryViewMode = 'BY_ZONE' | 'CONSOLIDATED';

interface InventoryToolbarProps {
  user: User;
  uniqueCategories: string[];
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  isCategoryDropdownOpen: boolean;
  setIsCategoryDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showOnlyLowStock: boolean;
  setShowOnlyLowStock: React.Dispatch<React.SetStateAction<boolean>>;
  lowStockCount: number;
  filteredCount: number;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  viewMode: InventoryViewMode;
  setViewMode: (mode: InventoryViewMode) => void;
  exportYear: number;
  setExportYear: (year: number) => void;
  onOpenSettlement: () => void;
  onOpenMonthlyReport: () => void;
  onOpenDBManager: () => void;
  onExportExcel: () => void;
  onResetLayout: () => void;
  onResetDB: () => void;
  onAdd: () => void;
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
// Keep these feature branches available for a future toolbar restore.
const SHOW_LOW_STOCK_FILTER_BUTTON = false;
const SHOW_CONSOLIDATED_VIEW_BUTTON = false;

const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
  user,
  uniqueCategories,
  selectedCategories,
  setSelectedCategories,
  isCategoryDropdownOpen,
  setIsCategoryDropdownOpen,
  showOnlyLowStock,
  setShowOnlyLowStock,
  lowStockCount,
  filteredCount,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  exportYear,
  setExportYear,
  onOpenSettlement,
  onOpenMonthlyReport,
  onOpenDBManager,
  onExportExcel,
  onResetLayout,
  onResetDB,
  onAdd,
}) => {
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsCategoryDropdownOpen]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleAllCategories = () => {
    if (selectedCategories.length === uniqueCategories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...uniqueCategories]);
    }
  };

  return (
    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col justify-between items-stretch gap-3 transition-colors shrink-0 bg-slate-50/50 dark:bg-slate-900 2xl:flex-row 2xl:items-center">
      <div className="flex flex-wrap items-center gap-2 w-full z-20 2xl:w-auto">
        {/* Multi-Select ZONE Dropdown */}
        <div className="relative" ref={categoryDropdownRef}>
          <button
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors shadow-sm ${
              selectedCategories.length > 0
                ? 'bg-white border-orange-500 text-orange-700 dark:bg-slate-800 dark:border-orange-500 dark:text-orange-400 ring-1 ring-orange-500'
                : 'bg-white border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter size={14} />
            <span className="truncate max-w-[120px]">
              {selectedCategories.length === 0
                ? '전체 ZONE'
                : selectedCategories.length === uniqueCategories.length
                ? '전체 선택됨'
                : selectedCategories.length === 1
                ? selectedCategories[0]
                : `${selectedCategories.length}개 ZONE`}
            </span>
            <ChevronDown size={14} className="opacity-50" />
          </button>

          {isCategoryDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 flex flex-col gap-1 max-h-[400px] overflow-y-auto">
              <button
                onClick={toggleAllCategories}
                className="flex items-center gap-2 w-full px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm font-bold text-slate-800 dark:text-slate-200"
              >
                {selectedCategories.length === uniqueCategories.length ? (
                  <CheckSquare size={16} className="text-orange-600" />
                ) : (
                  <Square size={16} className="text-slate-400" />
                )}
                전체 선택
              </button>
              <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
              {uniqueCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-sm text-left text-slate-700 dark:text-slate-300"
                >
                  {selectedCategories.includes(cat) ? (
                    <CheckSquare size={16} className="text-orange-600 dark:text-orange-400 shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{cat}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCategories.length > 0 && (
          <button
            onClick={() => setSelectedCategories([])}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg"
            title="필터 초기화"
            aria-label="필터 초기화"
          >
            <XCircle size={18} />
          </button>
        )}

        {SHOW_CONSOLIDATED_VIEW_BUTTON && (
          <button
            onClick={() => setViewMode(viewMode === 'BY_ZONE' ? 'CONSOLIDATED' : 'BY_ZONE')}
            title="여러 ZONE에 중복 투입되어 작업장에서 혼입될 수 있는 공통 자재의 실물 총재고 합계와 ZONE별 배분량을 대조합니다."
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-bold transition-all shadow-sm whitespace-nowrap ${
              viewMode === 'CONSOLIDATED'
                ? 'bg-amber-50 text-amber-800 border-amber-500 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500 ring-2 ring-amber-500'
                : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers size={15} className={viewMode === 'CONSOLIDATED' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
            <span>{viewMode === 'CONSOLIDATED' ? '공통자재 합산뷰 (혼입확인)' : '공통자재 합산보기'}</span>
          </button>
        )}

        {/* Low Stock Filter */}
        {SHOW_LOW_STOCK_FILTER_BUTTON && (
          <button
            onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-black transition-all shadow-sm whitespace-nowrap ${
              showOnlyLowStock
                ? 'bg-red-50 text-red-700 border-red-500 dark:bg-red-950/60 dark:text-red-400 dark:border-red-500 ring-2 ring-red-500'
                : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <AlertCircle size={15} className={showOnlyLowStock ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-slate-400'} />
            <span>{showOnlyLowStock ? `부족 (${filteredCount}건)` : `부족재고 (${lowStockCount}건)`}</span>
            {showOnlyLowStock && <X size={14} className="ml-1 opacity-70 hover:opacity-100" />}
          </button>
        )}

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="품명, 도금, 규격, 위치, 비고..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-colors shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-2 w-full min-w-0 max-w-full justify-start overflow-x-auto 2xl:flex-1 2xl:justify-end">
        <button
          onClick={onAdd}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-black shadow-md transition-colors whitespace-nowrap shrink-0"
        >
          <Plus size={16} /> 신규 등록
        </button>

        <button
          onClick={onOpenSettlement}
          title="ZONE 작업 완료 후 잔여 재고를 반납 정산(0 마감)하거나 다른 ZONE으로 이관합니다."
          className="px-3 py-2 text-orange-600 border border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <ArrowRightLeft size={15} /> ZONE 반납·정산
        </button>

        <button
          onClick={onOpenMonthlyReport}
          className="px-3 py-2 text-purple-600 border border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-900/20 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Calendar size={16} /> 월별 수불부
        </button>
        <button
          onClick={onOpenDBManager}
          className="px-3 py-2 text-slate-600 border border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <History size={16} /> 백업/롤백
        </button>

        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Year Selector + 50-Slot Excel Export */}
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm overflow-hidden shrink-0">
          <select
            aria-label="엑셀 수불부 내보내기 연도 선택"
            title="선택한 연도의 1년치 캘린더와 전년도 이월재고를 자동 생성합니다."
            value={exportYear}
            onChange={(e) => setExportYear(Number(e.target.value))}
            className="px-2.5 py-2 text-xs font-extrabold text-orange-600 dark:text-orange-400 bg-slate-50 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <button
            onClick={onExportExcel}
            className="px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 text-sm font-bold transition-colors whitespace-nowrap"
          >
            <FileDown size={16} /> 엑셀 내보내기
          </button>
        </div>

        <button
          onClick={onResetLayout}
          className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800"
          title="레이아웃 초기화"
          aria-label="레이아웃 초기화"
        >
          <LayoutTemplate size={16} />
        </button>

        {user.role === 'admin' && (
          <button
            onClick={onResetDB}
            className="px-3 py-2 text-red-600 border border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap"
          >
            <RotateCcw size={16} /> DB 초기화
          </button>
        )}

      </div>
    </div>
  );
};

export default InventoryToolbar;
