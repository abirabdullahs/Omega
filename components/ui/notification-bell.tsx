'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, where } from 'firebase/firestore'; // where import kora hoyeche
import { db } from '@/lib/firebase';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: any;
}

export function NotificationBell({ uid }: { uid: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    
    // 2 din ager exact date/time ber kora
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Query te time filter (where) add kora hoyeche
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      where('createdAt', '>=', twoDaysAgo),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    
    const unsub = onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem))),
      (err) => console.error('Notifications listener error:', err)
    );
    return () => unsub();
  }, [uid]);

  const unreadCount = items.filter((i) => !i.read).length;

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', uid, 'items', id), { read: true });
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllRead = async () => {
    const unread = items.filter((i) => !i.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((i) => batch.update(doc(db, 'notifications', uid, 'items', i.id), { read: true }));
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* Nicher line-e max-sm:... class gulo add kora hoyeche mobile-e perfect center anar jonno */}
          <div className="absolute right-0 mt-2 w-80 max-sm:fixed max-sm:top-[70px] max-sm:inset-x-4 max-sm:w-auto bg-white border border-neutral-100 rounded-2xl shadow-xl z-40 overflow-hidden animate-menu-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-bold text-neutral-900">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-amber-600 font-medium hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-neutral-50">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-neutral-400">No notifications yet.</p>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || '#'}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) markRead(n.id);
                  }}
                  className={`block px-4 py-3 hover:bg-neutral-50 transition-colors ${!n.read ? 'bg-amber-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${!n.read ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
