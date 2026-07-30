'use client';

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, BookOpen, MessageSquare, Bell } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    students: 0,
    tasks: 0,
    submissions: 0,
    notices: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      // For a real app, use count() queries
      const studentsSnap = await getDocs(query(collection(db, "users"), limit(100)));
      const tasksSnap = await getDocs(collection(db, "tasks"));
      const noticesSnap = await getDocs(collection(db, "notices"));
      
      setStats({
        students: studentsSnap.docs.filter(d => d.data().role === "student").length,
        tasks: tasksSnap.size,
        submissions: 0, // Harder to count across subcollections without aggregate
        notices: noticesSnap.size,
      });
    }
    fetchStats();
  }, []);

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Add Student", "New Task", "Post Notice", "Grade Submissions"].map((action) => (
            <button key={action} className="p-4 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors text-sm font-medium text-neutral-700">
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
