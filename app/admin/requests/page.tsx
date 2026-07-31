'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SUBJECTS } from "@/lib/subjects";
import { formatDate, parseDateInputLocal } from "@/lib/utils";
import { CheckCircle2, Clock, User, Calendar, Send, Info, X } from "lucide-react";

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
  const [assignment, setAssignment] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchRequests() {
      try {
        const q = query(collection(db, "requests"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (isMounted) {
          setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request)));
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
    // Initialize assignment with empty values for each subject
    const initial: Record<string, string> = {};
    SUBJECTS.forEach(s => initial[s.id] = "");
    setAssignment(initial);
    setDeadline("");
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !deadline) return;

    // Validate that one chapter per subject is selected
    const allSelected = Object.values(assignment).every(v => v !== "");
    if (!allSelected) {
      alert("Please select one chapter for each subject.");
      return;
    }

    setIsAssigning(true);
    try {
      // 1. Mark existing running assignments for this user as completed
      const oldSnap = await getDocs(query(
        collection(db, "assignments"), 
        where("userId", "==", selectedRequest.userId),
        where("status", "==", "running")
      ));
      for (const d of oldSnap.docs) {
        await updateDoc(doc(db, "assignments", d.id), { status: "completed" });
      }

      // 2. Create new assignment
      const deadlineDate = parseDateInputLocal(deadline);
      await addDoc(collection(db, "assignments"), {
        userId: selectedRequest.userId,
        chapters: assignment,
        deadline: Timestamp.fromDate(deadlineDate),
        status: "running",
        createdAt: serverTimestamp(),
      });

      // 3. Update request status
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

  const getChapterName = (id: string) => {
    for (const sub of SUBJECTS) {
      const chapter = sub.chapters.find(c => c.id === id);
      if (chapter) return chapter.name;
    }
    return id;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Student Requests</h2>
        <p className="text-neutral-500 text-sm">Review chapter requests and assign weekly study goals.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* List */}
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

        {/* Assignment Tool */}
        <div>
          {selectedRequest ? (
            <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl sticky top-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900">Assign Chapters</h3>
                  <p className="text-sm text-neutral-500">For student {selectedRequest.userPhone}</p>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="text-neutral-400 hover:text-neutral-900">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAssign} className="space-y-6">
                <div className="space-y-4">
                  {SUBJECTS.map((subject) => (
                    <div key={subject.id}>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">{subject.name}</label>
                      <select
                        required
                        value={assignment[subject.id]}
                        onChange={(e) => setAssignment({...assignment, [subject.id]: e.target.value})}
                        className="w-full bg-neutral-50 px-4 py-3 border border-neutral-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-neutral-900 transition-all"
                      >
                        <option value="">Select Chapter</option>
                        {subject.chapters.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Paper {c.paper})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-neutral-50">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Set Deadline</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                    <input
                      type="date"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAssigning}
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
