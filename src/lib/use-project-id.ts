'use client';

import { useEffect, useState } from 'react';

function readProjectIdFromLocation() {
  return new URLSearchParams(window.location.search).get('projectId')?.trim() || '';
}

/** Reads projectId after hydration instead of freezing the server-side empty value. */
export function useProjectId() {
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    const syncProjectId = () => setProjectId(readProjectIdFromLocation());
    const hydrationTimer = window.setTimeout(syncProjectId, 0);
    window.addEventListener('popstate', syncProjectId);

    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener('popstate', syncProjectId);
    };
  }, []);

  return projectId;
}
