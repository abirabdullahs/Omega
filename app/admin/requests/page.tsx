'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { findChapterMeta, getChapterName } from "@/lib/subjects";
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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchRequests() {
      try {
        const q = query(collection(db, "requests"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (isMounted) {
          setRequests(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Request)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchRequests();
    return () => { isMounted = false; };
  }, [reloadKey]);

  const handleSelectRequest = (req: Request) => {
    setSelectedRequest(req);
    const initial: Record<string, string> = {};
    (req.requestedChapters || []).forEach((chapterId) => {
      initial[chapterId] = "";
    });
    setDeadlines(initial);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const chapterIds = selectedRequest.requestedChapters || [];
    if (chapterIds.length === 0) {
      alert("This request has no chapters to assign.");
      return;
    }

    const missing = chapterIds.filter((id) => !deadlines[id]);
    if (missing.length > 0) {
      alert("Please set a deadline for every requested chapter.");
      return;
    }

    setIsAssigning(true);
    try {
      // For per-subject assignment behavior: update existing running assignment for the user
      // by replacing/adding only the specific subject items instead of completing the whole assignment.
      const runningSnap = await getDocs(query(
        collection(db, "assignments"),
        where("userId", "==", selectedRequest.userId),
        where("status", "==", "running")
      ));

      const newItems = chapterIds.map((chapterId) => {
        const meta = findChapterMeta(chapterId);
        return {
          chapterId,
          subjectId: meta?.subject.id || "unknown",
          subjectName: meta?.subject.name || "Unknown",
          deadline: Timestamp.fromDate(parseDateInputLocal(deadlines[chapterId])),
        };
      });

      if (!runningSnap.empty) {
        // Merge into the first running assignment found (keep other items for other subjects)
        const aDoc = runningSnap.docs[0];
        const aData: any = aDoc.data();
        const existingItems: any[] = Array.isArray(aData.items) ? aData.items : [];

        // Remove any existing items that are for the same subjects as newItems
        const subjectsToReplace = new Set(newItems.map(i => i.subjectId));
        const filtered = existingItems.filter(it => !subjectsToReplace.has(it.subjectId));

        const mergedItems = [...filtered, ...newItems];

        // Compute latest deadline for assignment-level deadline field
        const latestDeadline = mergedItems.reduce((latest, item) => {
          const t = item.deadline.toMillis();
          return t > latest ? t : latest;
        }, 0);

        await updateDoc(doc(db, "assignments", aDoc.id), {
          items: mergedItems,
          chapters: Object.fromEntries(mergedItems.map((item) => [item.subjectId, item.chapterId])),
          deadline: Timestamp.fromMillis(latestDeadline),
          updatedAt: serverTimestamp(),
        });
      } else {
        const latestDeadline = newItems.reduce((latest, item) => {
          const t = item.deadline.toMillis();
          return t > latest ? t : latest;
        }, 0);

        await addDoc(collection(db, "assignments"), {
          userId: selectedRequest.userId,
          items: newItems,
          chapters: Object.fromEntries(newItems.map((item) => [item.subjectId, item.chapterId])),
          deadline: Timestamp.fromMillis(latestDeadline),
          status: "running",
          createdAt: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "requests", selectedRequest.id), { status: "approved" });

      setSelectedRequest(null);
      setReloadKey(k => k + 1);
      alert("Chapters assigned successfully!");
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
                    (selectedRequest.requestedChapters || []).map((chapterId) => {
                      const meta = findChapterMeta(chapterId);
                      return (
                        <div key={chapterId} className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 space-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                              {meta?.subject.name || "Subject"}
                            </p>
                            <p className="text-sm font-bold text-neutral-900 mt-1">
                              {meta?.chapter.name || chapterId}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                              Deadline
                            </label>
                            <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                              <input
                                type="date"
                                required
                                value={deadlines[chapterId] || ""}
                                onChange={(e) => setDeadlines({ ...deadlines, [chapterId]: e.target.value })}
                                className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 bg-white"
                              />
                            </div>
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
