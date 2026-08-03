'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Loader } from "@/components/ui/loader";
import { getChapterName } from "@/lib/subjects";
import { ListChecks, Search, User } from "lucide-react";

interface Topic {
  id: string;
  name: string;
  status: "pending" | "submitted";
  order: number;
}

interface GroupedEntry {
  student: { id: string; name: string | null; phone: string | null };
  chapters: Record<string, Topic[]>;
}

export default function AdminTopicsPage() {
  const [items, setItems] = useState<GroupedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/topics", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data?.items)) {
          setItems(data.items);
        } else {
          console.error("Topics API error:", data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.uid]);

  const filtered = items.filter((entry) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (entry.student.name || "").toLowerCase().includes(q) || (entry.student.phone || "").includes(q);
  });

  if (loading) {
    return (
      <div className="py-24">
        <Loader label="Loading student topics…" className="text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-neutral-400" />
          Student Topics
        </h2>
        <p className="text-neutral-500 text-sm mt-1">Every student&apos;s topic breakdown, chapter by chapter.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
        />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
            No topics have been added by any student yet.
          </div>
        )}
        {filtered.map((entry) => (
          <div key={entry.student.id} className="rounded-3xl border border-neutral-100 bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                <User size={18} className="text-neutral-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">{entry.student.name || "Unnamed student"}</p>
                <p className="text-xs text-neutral-400">{entry.student.phone}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(entry.chapters).map(([chapterId, topics]) => (
                <div key={chapterId} className="rounded-2xl bg-neutral-50 p-4">
                  <p className="text-sm font-bold text-neutral-900 mb-2">{getChapterName(chapterId)}</p>
                  <ul className="space-y-1">
                    {topics.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                        <span className="truncate">{t.name}</span>
                        <span className={`shrink-0 font-bold uppercase px-1.5 py-0.5 rounded ${t.status === "submitted" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>
                          {t.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
