'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { findChapterMeta, getChapterName, SUBJECTS } from "@/lib/subjects";
import { formatDate, parseDateInputLocal } from "@/lib/utils";
import { User, Calendar, Send, Info, X } from "lucide-react";

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
      // Build items from per-subject selections
      const itemsToAssign: any[] = [];
      for (const subject of SUBJECTS) {
        const selectedChapter = selectedPerSubject[subject.id];
        if (!selectedChapter) continue;
        const dl = deadlines[selectedChapter];
        if (!dl) {
          alert(`Please set a deadline for the selected chapter in ${subject.name}.`);
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

      if (itemsToAssign.length === 0) {
        alert("Please select at least one chapter to assign.");
        setIsAssigning(false);
        return;
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
        alert("Chapters assigned successfully!");
      } else {
        console.error('Admin assign error:', data);
        alert(data?.error || "Failed to assign chapters.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to assign chapters.");
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-neutral-400">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-20 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-100">
              No pending requests.
            </div>
          ) : requests.map((req) => (
            <button
              key={req.id}
              onClick={() => handleSelectRequest(req)}
              className={`w-full text-left bg-white p-6 rounded-2xl border transition-all ${
                selectedRequest?.id === req.id
                  ? "border-neutral-900 ring-1 ring-neutral-900 shadow-md"
                  : "border-neutral-100 hover:border-neutral-200"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-neutral-50 p-2 rounded-xl">
                    <User size={20} className="text-neutral-900" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">{req.userName || req.userPhone || "Student"}</p>
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">Phone: {req.userPhone} • Submitted {formatDate(req.createdAt)}</p>
                  </div>
                </div>
                <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(req.requestedChapters || []).slice(0, 4).map(cid => (
                  <span key={cid} className="text-[10px] font-medium bg-neutral-50 text-neutral-500 px-2 py-1 rounded-lg border border-neutral-100">
                    {getChapterName(cid)}
                  </span>
                ))}
                {(req.requestedChapters || []).length > 4 && (
                  <span className="text-[10px] font-medium text-neutral-300">+{(req.requestedChapters || []).length - 4} more</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div>
          {selectedRequest ? (
            <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl sticky top-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900">Assign Chapters</h3>
                  <p className="text-sm text-neutral-500">
                    Only chapters requested by {selectedRequest.userName || selectedRequest.userPhone}
                  </p>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="text-neutral-400 hover:text-neutral-900">
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
                      return (
                        <div key={subject.id} className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 space-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                              {subject.name}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {chaptersForSubject.length === 0 ? (
                              <p className="text-xs text-neutral-400">No chapters requested in this subject.</p>
                            ) : (
                              chaptersForSubject.map((chapterId) => {
                                const meta = findChapterMeta(chapterId);
                                const selected = selectedPerSubject[subject.id] === chapterId;
                                return (
                                  <div key={chapterId} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-white">
                                    <div className="flex items-center space-x-3">
                                      <input
                                        type="radio"
                                        name={`sel-${subject.id}`}
                                        checked={selected}
                                        onChange={() => setSelectedPerSubject({ ...selectedPerSubject, [subject.id]: chapterId })}
                                      />
                                      <div>
                                        <p className="text-sm font-bold text-neutral-900">{meta?.chapter.name || chapterId}</p>
                                        <p className="text-[10px] text-neutral-400">Paper {meta?.chapter.paper}</p>
                                      </div>
                                    </div>
                                    <div className="w-40">
                                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Deadline</label>
                                      <input
                                        type="date"
                                        value={deadlines[chapterId] || ""}
                                        onChange={(e) => setDeadlines({ ...deadlines, [chapterId]: e.target.value })}
                                        className="w-full pl-3 pr-2 py-2 border border-neutral-200 rounded-xl text-sm bg-white"
                                        disabled={!selected}
                                      />
                                    </div>
                                  </div>
                                );
                              })
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
                  className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center"
                >
                  {isAssigning ? "Assigning..." : "Assign & Notify Student"}
                  <Send size={18} className="ml-2" />
                </button>
              </form>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-100 rounded-3xl p-20 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                  <Info size={32} className="text-neutral-200" />
                </div>
                <p className="text-neutral-400 font-medium max-w-[200px]">Select a request from the left to start assigning chapters</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
