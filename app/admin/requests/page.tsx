'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { findChapterMeta, getChapterName, SUBJECTS } from "@/lib/subjects";
import { formatDate, parseDateInputLocal } from "@/lib/utils";
import { User, Send, X } from "lucide-react"; // Removed Calendar and Info as they are no longer used

interface Request {
  id: string;
  userId: string;
  userPhone: string;
  userName?: string;
  requestedChapters: string[];
  createdAt: any;
  status: string;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedPerSubject, setSelectedPerSubject] = useState<Record<string, string | null>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;
    async function fetchRequests() {
      try {
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch(`${window.location.origin}/api/admin/requests`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data?.items)) {
          if (isMounted) setRequests(data.items.map((i: any) => ({ id: i.id, ...i } as Request)));
        } else {
          console.error('Admin requests API error:', data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchRequests();
    return () => { isMounted = false; };
  }, [reloadKey, user?.uid]);

  const handleSelectRequest = (req: Request) => {
    setSelectedRequest(req);
    const initial: Record<string, string> = {};
    (req.requestedChapters || []).forEach((chapterId) => {
      initial[chapterId] = "";
    });
    setDeadlines(initial);
    const perSub: Record<string, string | null> = {};
    SUBJECTS.forEach((s) => { perSub[s.id] = null; });
    setSelectedPerSubject(perSub);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !user) return;
    setIsAssigning(true);
    try {
      const itemsToAssign: any[] = [];
      for (const subject of SUBJECTS) {
        const selectedChapter = selectedPerSubject[subject.id];
        if (!selectedChapter) continue;
        const dl = deadlines[selectedChapter];
        if (!dl) {
          toast.error(`Please set a deadline for the selected chapter in ${subject.name}.`);
          setIsAssigning(false);
          return;
        }
        itemsToAssign.push({
          chapterId: selectedChapter,
          subjectId: subject.id,
          subjectName: subject.name,
          deadlineMillis: parseDateInputLocal(dl).getTime(),
        });
      }

      const token = await user.getIdToken();
      const res = await fetch(`${window.location.origin}/api/admin/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: selectedRequest.id, items: itemsToAssign }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSelectedRequest(null);
        setReloadKey(k => k + 1);
        toast.success(itemsToAssign.length === 0 ? "Closed without changes." : "Chapters assigned successfully!");
      } else {
        console.error('Admin assign error:', data);
        toast.error(data?.error || "Failed to assign chapters.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign chapters.");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Student Requests</h2>
        <p className="text-neutral-500 text-sm">Review chapter requests and set a deadline for each selected chapter.</p>
      </div>

      {/* Requests List */}
      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <div className="py-20 text-center text-neutral-400">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-100">
            No pending requests.
          </div>
        ) : (
          requests.map((req) => (
            <button
              key={req.id}
              onClick={() => handleSelectRequest(req)}
              className="w-full text-left bg-white p-6 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-neutral-50 p-2 rounded-xl">
                    <User size={20} className="text-neutral-900" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">{req.userName || req.userPhone || "Student"}</p>
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">
                      Phone: {req.userPhone} • Submitted {formatDate(req.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Pending
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(req.requestedChapters || []).slice(0, 4).map(cid => (
                  <span key={cid} className="text-[10px] font-medium bg-neutral-50 text-neutral-500 px-2 py-1 rounded-lg border border-neutral-100">
                    {getChapterName(cid)}
                  </span>
                ))}
                {(req.requestedChapters || []).length > 4 && (
                  <span className="text-[10px] font-medium text-neutral-300">
                    +{(req.requestedChapters || []).length - 4} more
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Modal Overlay */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          
          {/* Modal Content */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-100 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-start mb-8 sticky top-0 bg-white pt-2 pb-4 z-10 border-b border-neutral-50">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Assign Chapters</h3>
                <p className="text-sm text-neutral-500">
                  Only chapters requested by {selectedRequest.userName || selectedRequest.userPhone}
                </p>
              </div>
              <button 
                onClick={() => setSelectedRequest(null)} 
                className="text-neutral-400 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-6">
              <div className="space-y-4">
                {(selectedRequest.requestedChapters || []).length === 0 ? (
                  <p className="text-sm text-neutral-400">No chapters in this request.</p>
                ) : (
                  SUBJECTS.map((subject) => {
                    const chaptersForSubject = (selectedRequest.requestedChapters || []).filter(cid => {
                      const m = findChapterMeta(cid);
                      return m?.subject.id === subject.id;
                    });
                    const selectedChapter = selectedPerSubject[subject.id] || "";
                    return (
                      <div key={subject.id} className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 space-y-3">
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            {subject.name}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {chaptersForSubject.length === 0 ? (
                            <p className="text-xs text-neutral-400">No chapters requested in this subject.</p>
                          ) : (
                            <div className="flex flex-col md:flex-row items-end gap-3">
                              <div className="flex-1 w-full">
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Chapter</label>
                                <select
                                  value={selectedChapter}
                                  onChange={(e) => setSelectedPerSubject({ ...selectedPerSubject, [subject.id]: e.target.value || null })}
                                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white font-medium text-neutral-900"
                                >
                                  <option value="">Select a chapter…</option>
                                  {chaptersForSubject.map((chapterId) => {
                                    const meta = findChapterMeta(chapterId);
                                    return (
                                      <option key={chapterId} value={chapterId}>
                                        {meta?.chapter.name || chapterId} (Paper {meta?.chapter.paper})
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              <div className="w-full md:w-40">
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Deadline</label>
                                <input
                                  type="date"
                                  value={deadlines[selectedChapter] || ""}
                                  onChange={(e) => setDeadlines({ ...deadlines, [selectedChapter]: e.target.value })}
                                  className="w-full pl-3 pr-2 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white"
                                  disabled={!selectedChapter}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="submit"
                disabled={isAssigning || !(selectedRequest.requestedChapters || []).length}
                className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center sticky bottom-0"
              >
                {isAssigning ? "Assigning..." : "Assign & Notify Student"}
                <Send size={18} className="ml-2" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
