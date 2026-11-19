import { InventoryItem, InventoryTransaction, MasterData, User } from '../../types';
import { COL_WIDTHS_STORAGE_KEY } from '../../constants';

export interface InventoryListProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  user: User;
  initialFilterMode?: 'ALL' | 'LOW_STOCK';
  initialCategoryFilter?: string | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onOpenDBManager: () => void;
  onTransaction: (item: InventoryItem) => void;
  onOpenMonthlyReport: () => void;
  onOpenMonthlyUsageReport: () => void;
  onOpenReport: () => void;
}

export interface InventoryColWidths {
  [key: string]: number;
  edit: number;
  no: number;
  category: number;
  name: number;
  plating: number;
  spec: number;
  currentStock: number;
  unit: number;
  location: number;
  note: number;
}

export const WIDTH_STORAGE_KEY = COL_WIDTHS_STORAGE_KEY;

export const DEFAULT_WIDTHS: InventoryColWidths = {
  edit: 48,
  no: 52,
  category: 120,
  name: 210,
  plating: 76,
  spec: 100,
  currentStock: 140,
  unit: 76,
  location: 110,
  note: 220,
};

export interface ItemActivityStats {
  hasActivity: boolean;
  totalOut: number;
  monthlyAvg: number;
}
