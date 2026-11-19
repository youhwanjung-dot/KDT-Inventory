/**
 * cacheBuster.ts
 * 브라우저 캐시(CacheStorage, ServiceWorker) 자동 정리 및
 * 서버 Version.json 대조를 통해 Ctrl+F5 없이 항상 최신 버전을 유지하는 유틸리티
 */
import { APP_VERSION, BUILD_TIMESTAMP } from '../constants';

/**
 * 브라우저 저장소 캐시 삭제 및 버전 업데이트 검사
 */
export const purgeCacheAndCheckVersion = async (): Promise<{ isNewVersion: boolean; oldVersion: string | null }> => {
  let isNewVersion = false;
  let oldVersion = localStorage.getItem('asan_app_cached_version');

  try {
    // 1. CacheStorage API 전체 삭제 (브라우저 자원 캐시 소거)
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    // 2. 등록된 Service Worker 해제
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    // 3. 이전 버전 및 빌드타임 대조
    const oldBuild = localStorage.getItem('asan_app_cached_build');

    if (oldVersion && (oldVersion !== APP_VERSION || oldBuild !== BUILD_TIMESTAMP)) {
      isNewVersion = true;
    }

    // 최신 버전 정보 저장
    localStorage.setItem('asan_app_cached_version', APP_VERSION);
    localStorage.setItem('asan_app_cached_build', BUILD_TIMESTAMP);
  } catch (e) {
    console.warn('Cache purge warning:', e);
  }

  return { isNewVersion, oldVersion };
};

/**
 * 원격 서버의 Version.json을 비동기로 조회하여 최신 배포 여부를 감지
 */
export const checkForServerUpdate = async (): Promise<boolean> => {
  try {
    const res = await fetch(`/Version.json?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!res.ok) return false;

    const data = await res.json();
    const serverVersion = data.version;

    if (serverVersion && serverVersion !== APP_VERSION) {
      console.log(`[VersionCheck] Server version (${serverVersion}) differs from client (${APP_VERSION}). Update required.`);
      return true; // 원격에 더 새로운 배포가 있음
    }
  } catch (e) {
    // 오프라인이거나 개발 서버 환경일 수 있음
  }
  return false;
};

/**
 * 강제 캐시 무효화 새로고침 구동
 */
export const forceHardReload = () => {
  try {
    // 쿼리 스트링에 타임스탬프를 주입하여 브라우저 강제 재요청 유도
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('_v', `${APP_VERSION}_${Date.now()}`);
    window.location.href = currentUrl.toString();
  } catch (e) {
    window.location.reload();
  }
};
