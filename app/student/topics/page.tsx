'use client';

import { useEffect, useState } from "react";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { Loader } from "@/components/ui/loader";
import { getChapterName } from "@/lib/subjects";
import { Pencil, X, ListChecks, Plus } from "lucide-react";

interface AssignedItem {
  chapterId: string;
  subjectId: string;
  subjectName?: string | null;
}

interface Topic {
  id: string;
  chapterId: string;
  name: string;
  status: "pending" | "submitted";
  order: number;
}

export default function StudentTopicsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([]);
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, Topic[]>>({});
  const [loading, setLoading] = useState(true);

  const [editingChapter, setEditingChapter] = useState<AssignedItem | null>(null);
  const [newNames, setNewNames] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [savingAdd, setSavingAdd] = useState(false);
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const aq = query(
          collection(db, "assignments"),
          where("userId", "==", user.uid),
          where("status", "==", "running"),
          limit(1)
        );
        const aSnap = await getDocs(aq);
        const items: AssignedItem[] = aSnap.empty ? [] : (aSnap.docs[0].data().items || []);
        setAssignedItems(items);

        const token = await user.getIdToken();
        const res = await fetch(`${window.location.origin}/api/topics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data?.items)) {
          const grouped: Record<string, Topic[]> = {};
          data.items.forEach((t: Topic) => {
            if (!grouped[t.chapterId]) grouped[t.chapterId] = [];
            grouped[t.chapterId].push(t);
          });
          setTopicsByChapter(grouped);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load your topics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.uid]);

  const openEdit = (item: AssignedItem) => {
    setEditingChapter(item);
    setNewNames("");
    const existing = topicsByChapter[item.chapterId] || [];
    const drafts: Record<string, string> = {};
    existing.forEach((t) => (drafts[t.id] = t.name));
    setRenameDrafts(drafts);
  };

  const closeEdit = () => {
    setEditingChapter(null);
    setNewNames("");
    setRenameDrafts({});
  };

  const handleAddTopics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter || !newNames.trim() || !user) return;
    setSavingAdd(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${window.location.origin}/api/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chapterId: editingChapter.chapterId, names: newNames }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.items)) {
        setTopicsByChapter((prev) => ({
          ...prev,
          [editingChapter.chapterId]: [...(prev[editingChapter.chapterId] || []), ...data.items],
        }));
        setRenameDrafts((prev) => {
          const next = { ...prev };
          data.items.forEach((t: Topic) => (next[t.id] = t.name));
          return next;
        });
        setNewNames("");
        toast.success(`Added ${data.items.length} topic${data.items.length === 1 ? "" : "s"}.`);
      } else {
        toast.error(data?.error || "Failed to add topics.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add topics.");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleRename = async (topic: Topic) => {
    const newName = (renameDrafts[topic.id] || "").trim();
    if (!newName || newName === topic.name || !user || !editingChapter) return;
    setSavingRenameId(topic.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${window.location.origin}/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setTopicsByChapter((prev) => ({
          ...prev,
          [editingChapter.chapterId]: (prev[editingChapter.chapterId] || []).map((t) =>
            t.id === topic.id ? { ...t, name: newName } : t
          ),
        }));
        toast.success("Topic renamed.");
      } else {
        toast.error(data?.error || "Failed to rename topic.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to rename topic.");
    } finally {
      setSavingRenameId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24">
        <Loader label="Loading your topics…" className="text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-neutral-400" />
          My Topics
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Break your assigned chapters into topics you can track.</p>
      </div>

      {assignedItems.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-dashed border-neutral-200 text-center text-neutral-500">
          No chapters are assigned to you yet.
        </div>
      ) : (
        <div className="space-y-3">
          {assignedItems.map((item) => {
            const topics = topicsByChapter[item.chapterId] || [];
            return (
              <div key={item.chapterId} className="bg-white p-5 rounded-2xl border border-neutral-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{item.subjectName || item.subjectId}</p>
                    <p className="text-sm font-bold text-neutral-900 truncate">{getChapterName(item.chapterId)}</p>
                    <p className="text-xs text-neutral-400 mt-1">{topics.length} topic{topics.length === 1 ? "" : "s"}</p>
                  </div>
                  <button
                    onClick={() => openEdit(item)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingChapter && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="w-full max-w-lg my-8 sm:my-0 rounded-3xl border border-neutral-100 bg-white p-6 sm:p-8 shadow-xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{editingChapter.subjectName || editingChapter.subjectId}</p>
                <h3 className="text-lg font-bold text-neutral-900">{getChapterName(editingChapter.chapterId)}</h3>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Close"
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(topicsByChapter[editingChapter.chapterId] || []).length > 0 && (
              <div className="space-y-2 mb-6">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Existing topics</p>
                {(topicsByChapter[editingChapter.chapterId] || []).map((topic) => (
                  <div key={topic.id} className="flex items-center gap-2">
                    <input
                      value={renameDrafts[topic.id] ?? topic.name}
                      onChange={(e) => setRenameDrafts((prev) => ({ ...prev, [topic.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(topic)}
                      disabled={savingRenameId === topic.id || (renameDrafts[topic.id] ?? topic.name) === topic.name}
                      className="text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 px-3 py-2 rounded-xl transition-colors shrink-0"
                    >
                      {savingRenameId === topic.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddTopics} className="space-y-3">
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide">
                Add new topics (comma separated)
              </label>
              <textarea
                value={newNames}
                onChange={(e) => setNewNames(e.target.value)}
                rows={3}
                placeholder="Vectors basics, Scalar & vector product, Relative motion"
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={savingAdd || !newNames.trim()}
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white py-3 rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
              >
                <Plus size={16} />
                {savingAdd ? "Adding…" : "Add topics"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
