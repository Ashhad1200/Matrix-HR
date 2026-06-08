'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

export function NotificationBell() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = user?.badges.unreadNotifications ?? 0;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.notifications.list()
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkRead(id: string) {
    await api.notifications.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
          <div className="border-b border-[hsl(var(--border))] px-4 py-3">
            <p className="font-medium">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">No notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read && handleMarkRead(n.id)}
                  className={cn(
                    'w-full border-b border-[hsl(var(--border))] px-4 py-3 text-left text-sm transition-colors hover:bg-[hsl(var(--muted))]',
                    !n.read && 'bg-brand-600/5',
                  )}
                >
                  <p className="font-medium">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {formatDate(n.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
