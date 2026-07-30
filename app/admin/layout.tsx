'use client';

import { useAuth } from "@/components/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, Users, BookOpen, MessageSquare, Bell, LogOut, Clock } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || userData?.role !== "admin")) {
      router.push("/login");
    }
  }, [user, userData, loading, router]);

  if (loading || !user || userData?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Students", href: "/admin/students", icon: Users },
    { name: "Tracking", href: "/admin/tracking", icon: Clock },
    { name: "Requests", href: "/admin/requests", icon: MessageSquare },
    { name: "Tasks", href: "/admin/tasks", icon: BookOpen },
    { name: "Submissions", href: "/admin/submissions", icon: MessageSquare },
    { name: "Notices", href: "/admin/notices", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
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
                {item.name}
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
