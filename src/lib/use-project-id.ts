'use client';

import { useSyncExternalStore } from 'react';

function subscribeToLocationChange(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange);
  return () => window.removeEventListener('popstate', onStoreChange);
}

function readProjectIdFromLocation() {
  return new URLSearchParams(window.location.search).get('projectId')?.trim() || '';
}

/** Reads projectId after hydration instead of freezing the server-side empty value. */
export function useProjectId() {
  return useSyncExternalStore(
    subscribeToLocationChange,
    readProjectIdFromLocation,
    () => '',
  );
}

