'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Workflows cannot be created or edited in the app yet, so the page is hidden: the menu entry is gone and the address
// sends people back to Settings. (The API for it still exists.)
export default function HiddenWorkflowsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings'); }, [router]);
  return null;
}
