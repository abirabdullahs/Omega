'use client';

import { useAuth } from "@/components/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { BookOpen, Bell, LogOut, Layout, MessageSquare } from "lucide-react";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || userData?.role !== "student")) {
      router.push("/login");
    }
  }, [user, userData, loading, router]);

  if (loading || !user || userData?.role !== "student") {
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
      <nav className="bg-white border-b border-neutral-200 h-16 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center font-bold text-neutral-900">
              <Layout className="w-5 h-5 mr-2 text-amber-500" />
              Omega Student
            </div>
            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    pathname === item.href 
                      ? "bg-neutral-900 text-white" 
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
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
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
