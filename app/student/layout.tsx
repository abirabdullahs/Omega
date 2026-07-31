'use client';

import { useAuth } from "@/components/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Bell, LogOut, Layout, MessageSquare } from "lucide-react";

interface ChatMetaItem {
  roomId: string;
  unreadForStudent?: boolean;
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [chatMeta, setChatMeta] = useState<ChatMetaItem | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user || userData?.role !== "student") {
        router.push("/login");
      } else if (userData && userData.passwordChanged === false) {
        router.push("/login");
      }
    }
  }, [user, userData, loading, router]);

  useEffect(() => {
    const fetchChatMeta = async () => {
      if (!user) return;
      try {
        const res = await fetch("/api/chats/meta", {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.item) {
          setChatMeta(data.item);
        }
      } catch (err) {
        console.error("Failed to fetch chat meta:", err);
      }
    };
    fetchChatMeta();
  }, [user]);

  if (loading || !user || userData?.role !== "student" || userData.passwordChanged === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
      </div>
    );
  }

  const navItems = [
    { name: "My Tasks", href: "/student", icon: BookOpen },
    { name: "Live Chat", href: "/student/chat", icon: MessageSquare },
    { name: "Course Plan", href: "/student/plan", icon: Layout },
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
            <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">
              {userData.phone}
            </span>
            <button
              onClick={() => logout()}
              className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="border-t border-neutral-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 overflow-x-auto">
            <div className="hidden md:flex gap-2 whitespace-nowrap">
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
            <div className="flex gap-2 whitespace-nowrap md:hidden">
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
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
