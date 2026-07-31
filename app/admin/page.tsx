'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, BookOpen, MessageSquare, Bell } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    students: 0,
    tasks: 0,
    submissions: 0,
    notices: 0,
  });
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    async function fetchStats() {
      // Use server-side admin API to avoid Firestore rules issues from the client.
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const url = new URL(window.location.origin + "/api/admin/students");
        url.searchParams.set("limit", "100");
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        const studentsCount = Array.isArray(data?.items) ? data.items.filter((d: any) => d.role === "student").length : 0;
        if (mounted) setStats({ students: studentsCount, tasks: 0, submissions: 0, notices: 0 });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    }
    fetchStats();
    return () => { mounted = false; };
  }, [user?.uid]);

  const cards = [
    { label: "Total Students", value: stats.students, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Active Tasks", value: stats.tasks, icon: BookOpen, color: "bg-emerald-50 text-emerald-600" },
    { label: "Notices", value: stats.notices, icon: Bell, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Dashboard Overview</h2>
        <p className="text-neutral-500">Welcome back to your mentorship management hub.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${card.color}`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">{card.label}</p>
              <p className="text-2xl font-bold text-neutral-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-8">
        <h3 className="text-lg font-semibold mb-4 text-neutral-900">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Add Student", href: "/admin/students" },
            { label: "New Task", href: "/admin/tasks" },
            { label: "Post Notice", href: "/admin/notices" },
            { label: "Grade Submissions", href: "/admin/submissions" },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="p-4 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors text-sm font-medium text-neutral-700"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
