import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  QuerySnapshot,
  DocumentSnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { InventoryItem, InventoryTransaction, MasterData } from '../types';

// KDT-Inventory Firebase Project (kdt-inventory, Seoul asia-northeast3)
const firebaseConfig = {
  projectId: 'kdt-inventory',
  appId: '1:932423332610:web:099bcdb45fc4535df1481b',
  storageBucket: 'kdt-inventory.firebasestorage.app',
  apiKey: 'AIzaSyAYbNtTGWZR813xzFNyYLVOWFDjLLtjU2A',
  authDomain: 'kdt-inventory.firebaseapp.com',
  messagingSenderId: '932423332610',
  measurementId: 'G-ZDHTL9WNGK',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function subscribeInventory(
  callback: (items: InventoryItem[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'inventory'),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const items: InventoryItem[] = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      } as InventoryItem));
      callback(items);
    },
    (error: FirestoreError) => {
      console.error('[Realtime] inventory listener error:', error);
    }
  );
}

export function subscribeTransactions(
  callback: (txs: InventoryTransaction[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'transactions'),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const txs: InventoryTransaction[] = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      } as InventoryTransaction));
      callback(txs);
    },
    (error: FirestoreError) => {
      console.error('[Realtime] transactions listener error:', error);
    }
  );
}

export function subscribeMasterData(
  callback: (data: MasterData) => void
): () => void {
  return onSnapshot(
    doc(db, 'masterData', 'custom'),
    (docSnap: DocumentSnapshot<DocumentData>) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          categories: Array.isArray(data.categories) ? data.categories : [],
          namesByCategory:
            typeof data.namesByCategory === 'object' && data.namesByCategory
              ? data.namesByCategory
              : {},
          nameOrder: Array.isArray(data.nameOrder) ? data.nameOrder : [],
          zoneMeta:
            typeof data.zoneMeta === 'object' && data.zoneMeta
              ? data.zoneMeta
              : {},
        });
      } else {
        callback({ categories: [], namesByCategory: {}, nameOrder: [], zoneMeta: {} });
      }
    },
    (error: FirestoreError) => {
      console.error('[Realtime] masterData listener error:', error);
    }
  );
}
