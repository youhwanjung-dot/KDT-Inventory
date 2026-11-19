import React from 'react';
import { Tag, Component, MapPin, Layers } from 'lucide-react';
import { InventoryItem, MasterData } from '../../types';

export interface MasterDataManagerModalProps {
  inventory: InventoryItem[];
  masterData: MasterData;
  onMasterDataChange: (md: MasterData) => void;
  onUpdateInventory: (
    newInventory: InventoryItem[],
    changedItems: InventoryItem[],
    deleteItemIds?: string[]
  ) => void;
  onCreateItem?: (category: string, name: string) => void;
  onClose: () => void;
}

export type TargetField = 'category' | 'name' | 'unit' | 'location' | 'plating';

export interface TabConfig {
  key: TargetField;
  label: string;
  icon: React.ReactNode;
  fallback: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { key: 'category', label: 'ZONE (대분류)', icon: React.createElement(Tag, { size: 16 }), fallback: '기타' },
  { key: 'unit', label: '공급 단위', icon: React.createElement(Component, { size: 16 }), fallback: 'EA' },
  { key: 'location', label: '보관위치', icon: React.createElement(MapPin, { size: 16 }), fallback: '(위치 미지정)' },
  { key: 'plating', label: '도금 사양', icon: React.createElement(Layers, { size: 16 }), fallback: '(도금 없음)' },
];

export interface AnalysisResult {
  type: 'UPDATE' | 'DELETE' | 'MOVE_SUBCATEGORY' | 'DELETE_SUBCATEGORY';
  field: TargetField;
  targetValue: string;
  newValue: string;
  affectedCount: number;
  affectedSample: string[];
  moveSourceCategories?: string[];
}
