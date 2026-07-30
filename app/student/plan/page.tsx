'use client';

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { SUBJECTS, Chapter } from "@/lib/subjects";
import { CheckCircle2, Circle, Send, Info, ChevronDown, ChevronUp } from "lucide-react";

export default function CoursePlanPage() {
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [lastRequest, setLastRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(SUBJECTS[0].id);
  const { user, userData } = useAuth();

  useEffect(() => {
    async function fetchLastRequest() {
      if (!user) return;
      try {
        const q = query(
          collection(db, "requests"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setLastRequest(data);
          setSelectedChapters(data.requestedChapters || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLastRequest();
  }, [user]);

  const toggleChapter = (chapterId: string) => {
    setSelectedChapters(prev => 
      prev.includes(chapterId) 
        ? prev.filter(id => id !== chapterId) 
        : [...prev, chapterId]
    );
  };

  const handleSendRequest = async () => {
    if (!user || selectedChapters.length === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "requests"), {
        userId: user.uid,
        userName: userData?.name || user.email?.split("@")[0],
        requestedChapters: selectedChapters,
        createdAt: serverTimestamp(),
        status: "pending",
        userPhone: userData?.phone || user.email?.split("@")[0]
      });
      alert("Request sent successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to send request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-neutral-400">Loading curriculum...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Course Planning</h2>
        <p className="text-neutral-500 text-sm">Select the chapters you want to study next and send a request to your mentor.</p>
      </div>

      {lastRequest && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start space-x-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-bold">Last request status: {lastRequest.status.toUpperCase()}</p>
            <p>Submitted on {lastRequest.createdAt?.toDate().toLocaleDateString()}. You can update your selection and send a new request if needed.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {SUBJECTS.map((subject) => (
          <div key={subject.id} className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
            <button 
              onClick={() => setExpandedSubject(expandedSubject === subject.id ? null : subject.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
            >
              <h3 className="font-bold text-neutral-900">{subject.name}</h3>
              <div className="flex items-center space-x-3">
                <span className="text-xs text-neutral-400 font-medium">
                  {subject.chapters.filter(c => selectedChapters.includes(c.id)).length} selected
                </span>
                {expandedSubject === subject.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {expandedSubject === subject.id && (
              <div className="px-6 pb-6 pt-2 border-t border-neutral-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subject.chapters.map((chapter) => {
                    const isSelected = selectedChapters.includes(chapter.id);
                    return (
                      <button
                        key={chapter.id}
                        onClick={() => toggleChapter(chapter.id)}
                        className={`flex items-center p-3 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" 
                            : "border-neutral-100 bg-white text-neutral-600 hover:border-neutral-200"
                        }`}
                      >
                        {isSelected ? <CheckCircle2 size={18} className="mr-3 shrink-0" /> : <Circle size={18} className="mr-3 shrink-0 opacity-20" />}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{chapter.name}</p>
                          <p className={`text-[10px] uppercase tracking-wider font-bold ${isSelected ? "text-neutral-400" : "text-neutral-300"}`}>Paper {chapter.paper}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
        <button
          onClick={handleSendRequest}
          disabled={submitting || selectedChapters.length === 0}
          className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
        >
          {submitting ? "Processing..." : (
            <>
              <Send size={18} />
              <span>Send Request ({selectedChapters.length} Chapters)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
