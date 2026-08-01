'use client';

import { useAuth } from "@/components/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LayoutDashboard, Users, BookOpen, MessageSquare, Bell, LogOut, Clock, Menu, X } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Live subscription so the "Live Chat" nav item shows a dot the instant
  // any student sends a new message, without needing a page reload.
  useEffect(() => {
    if (!user || userData?.role !== "admin") return;
    const unsub = onSnapshot(
      collection(db, "chats_meta"),
      (snap) => {
        setHasUnreadChat(snap.docs.some((d) => !!d.data()?.unreadForAdmin));
      },
      (err) => console.error("Chat meta listener error:", err)
    );
    return () => unsub();
  }, [user?.uid, userData?.role]);

  useEffect(() => {
    if (!loading) {
      if (!user || userData?.role !== "admin") {
        router.push("/login");
      } else if (userData && userData.passwordChanged === false) {
        router.push("/login");
      }
    }
  }, [user, userData, loading, router]);

  if (loading || !user || userData?.role !== "admin" || userData.passwordChanged === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Students", href: "/admin/students", icon: Users },
    { name: "Live Chat", href: "/admin/chats", icon: MessageSquare },
    { name: "Tracking", href: "/admin/tracking", icon: Clock },
    { name: "Requests", href: "/admin/requests", icon: MessageSquare },
    { name: "Tasks", href: "/admin/tasks", icon: BookOpen },
    { name: "Submissions", href: "/admin/submissions", icon: MessageSquare },
    { name: "Notices", href: "/admin/notices", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="md:flex">
        {/* Sidebar for desktop */}
        <aside className="hidden md:flex w-64 bg-white border-r border-neutral-200 flex-col">
          <div className="p-6 border-b border-neutral-100">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center">
              <span className="bg-amber-500 w-2 h-6 mr-2 rounded-full"></span>
              Omega Admin
            </h1>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Management Portal</p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const showDot = item.href === "/admin/chats" && hasUnreadChat;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    isActive 
                      ? "bg-neutral-900 text-white" 
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="flex items-center gap-2">
                    {item.name}
                    {showDot ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-neutral-100">
            <button
              onClick={() => logout()}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="bg-white border-b border-neutral-200 md:hidden sticky top-0 z-20">
            <div className="flex items-center justify-between p-4">
              <div>
                <h1 className="text-lg font-bold text-neutral-900">Omega Admin</h1>
                <p className="text-xs text-neutral-500">Management Portal</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => logout()}
                  className="text-red-600 text-sm font-medium px-2 py-2"
                >
                  Logout
                </button>
                <button
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label="Toggle menu"
                  aria-expanded={mobileMenuOpen}
                  className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <nav className="border-t border-neutral-100 px-4 py-3 space-y-1 animate-menu-in">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const showDot = item.href === "/admin/chats" && hasUnreadChat;
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
                        {showDot ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
