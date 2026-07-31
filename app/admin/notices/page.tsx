'use client';

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDateTime } from "@/lib/utils";
import { Bell, Plus, Trash2, Link as LinkIcon, Clock } from "lucide-react";

interface Notice {
  id: string;
  title: string;
  content: string;
  targetLink?: string;
  createdAt: any;
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchNotices() {
      try {
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (isMounted) {
          setNotices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchNotices();
    return () => { isMounted = false; };
  }, [reloadKey]);

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notices"), {
        title,
        content,
        targetLink: targetLink || null,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setContent("");
      setTargetLink("");
      setShowAdd(false);
      setReloadKey(k => k + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, "notices", id));
      setReloadKey(k => k + 1);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Notice Board</h2>
          <p className="text-neutral-500">Post announcements for all students.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showAdd ? "Cancel" : "New Notice"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Create Announcement</h3>
          <form onSubmit={handleAddNotice} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notice Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
                placeholder="e.g. Next Batch Starting Date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Content</label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
                placeholder="Details of the announcement..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Target Link (Optional)</label>
              <input
                type="url"
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
                placeholder="https://zoom.us/..."
              />
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-neutral-900 text-white px-8 py-2 rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? "Posting..." : "Post Notice"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-neutral-400">Loading notices...</div>
        ) : notices.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-100">
            No notices posted yet.
          </div>
        ) : notices.map((notice) => (
          <div key={notice.id} className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-lg">{notice.title}</h3>
                <p className="text-neutral-600 text-sm mt-1 whitespace-pre-wrap">{notice.content}</p>
                {notice.targetLink && (
                  <a
                    href={notice.targetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-bold text-blue-600 mt-3 hover:underline"
                  >
                    <LinkIcon size={12} className="mr-1" /> Visit Link
                  </a>
                )}
                <div className="flex items-center text-[10px] text-neutral-400 mt-4">
                  <Clock size={12} className="mr-1" />
                  {formatDateTime(notice.createdAt)}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDelete(notice.id)}
              className="p-2 text-neutral-300 hover:text-red-600 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
