'use client';

import { useAuth } from "@/components/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen, Bell, LogOut, Layout, MessageSquare, Menu, X, CheckCircle2, CalendarDays, ListChecks } from "lucide-react";
import { FullScreenLoader } from "@/components/ui/loader";
import { NotificationBell } from "@/components/ui/notification-bell";

interface ChatMetaItem {
  roomId: string;
  unreadForStudent?: boolean;
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [chatMeta, setChatMeta] = useState<ChatMetaItem | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading) {
      if (!user || userData?.role !== "student") {
        router.push("/login");
      } else if (userData && userData.passwordChanged === false) {
        router.push("/login");
      }
    }
  }, [user, userData, loading, router]);

  // Live subscription so the "unread" dot on the nav appears the instant
  // a mentor replies, without needing a page reload.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "chats_meta", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data: any = snap.data();
          setChatMeta({ roomId: user.uid, unreadForStudent: !!data?.unreadForStudent });
        } else {
          setChatMeta(null);
        }
      },
      (err) => console.error("Chat meta listener error:", err)
    );
    return () => unsub();
  }, [user?.uid]);

  if (loading || !user || userData?.role !== "student" || userData.passwordChanged === false) {
    return <FullScreenLoader label="Loading your dashboard…" />;
  }

  const navItems = [
    { name: "Dashboard", href: "/student", icon: BookOpen },
    { name: "Live Sessions", href: "/student/live-sessions", icon: CalendarDays },
    { name: "My Submissions", href: "/student/submissions", icon: CheckCircle2 },
    { name: "Live Chat", href: "/student/chat", icon: MessageSquare },
    { name: "Course Plan", href: "/student/plan", icon: Layout },
    { name: "My Topics", href: "/student/topics", icon: ListChecks },
    { name: "Notice Board", href: "/student/notices", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 md:py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center font-bold text-neutral-900">
              <Layout className="w-5 h-5 mr-2 text-amber-500" />
              Omega Student
            </div>
            <div className="text-sm text-neutral-500">
              Welcome back, {userData?.name || user?.displayName || 'student'}.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell uid={user.uid} />
            <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">
              {userData.phone}
            </span>
            <button
              onClick={() => logout()}
              className="hidden md:inline-flex p-2 text-neutral-400 hover:text-red-600 transition-colors"
            >
              <LogOut size={20} />
            </button>
            <button
              onClick={() => logout()}
              className="md:hidden text-red-600 text-sm font-medium px-2 py-2"
            >
              Logout
            </button>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <div className="hidden md:block border-t border-neutral-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 overflow-x-auto">
            <div className="flex gap-2 whitespace-nowrap">
              {navItems.map((item) => {
                const showUnread = item.href === "/student/chat" && chatMeta?.unreadForStudent;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-3 py-2 rounded-2xl text-sm font-medium transition-colors ${
                      pathname === item.href 
                        ? "bg-neutral-900 text-white" 
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    <span className="flex items-center gap-2">
                      {item.name}
                      {showUnread ? <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-neutral-200 bg-white px-4 py-3 space-y-1 animate-menu-in">
            {navItems.map((item) => {
              const showUnread = item.href === "/student/chat" && chatMeta?.unreadForStudent;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="flex items-center gap-2">
                    {item.name}
                    {showUnread ? <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> : null}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
