'use client';

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ChevronLeft, Send, CheckCircle2, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function StudentTaskPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchTask() {
      if (!user || !id) return;
      setLoading(true);
      try {
        const taskSnap = await getDoc(doc(db, "tasks", id));
        if (taskSnap.exists()) {
          setTask({ id: taskSnap.id, ...taskSnap.data() });
        }

        const subSnap = await getDoc(doc(db, "submissions", id, "entries", user.uid));
        if (subSnap.exists()) {
          const data = subSnap.data();
          setSubmission(data);
          setText(data.text);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
  }, [user, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !user || !id) return;

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "submissions", id, "entries", user.uid), {
        text,
        submittedAt: serverTimestamp(),
        studentId: user.uid,
        studentPhone: user.email?.split("@")[0] // Rough way to get phone
      }, { merge: true });
      
      const updatedSub = await getDoc(doc(db, "submissions", id, "entries", user.uid));
      setSubmission(updatedSub.data());
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="py-20 text-center text-neutral-400">Loading task details...</div>
  );

  if (!task) return (
    <div className="py-20 text-center text-neutral-400">Task not found.</div>
  );

  return (
    <div className="space-y-8 pb-20">
      <Link href="/student" className="inline-flex items-center text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-neutral-100 bg-neutral-50/30">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
            <span>Posted on {task.createdAt?.toDate().toLocaleDateString()}</span>
            {task.deadline && (
              <span className="flex items-center text-red-500 font-bold bg-red-50 px-3 py-1 rounded-full">
                Deadline: {task.deadline?.toDate().toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="p-8">
          <div className="prose prose-neutral max-w-none prose-headings:text-neutral-900 prose-p:text-neutral-600 prose-a:text-neutral-900 prose-code:bg-neutral-100 prose-code:p-1 prose-code:rounded prose-img:rounded-2xl">
            <ReactMarkdown>{task.contentMarkdown}</ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center">
            <Send className="w-5 h-5 mr-2" /> Your Submission
          </h2>
          {submission && (
            <div className="flex items-center text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full">
              <CheckCircle2 size={16} className="mr-1" /> Submitted
            </div>
          )}
        </div>

        {submission?.grade && (
          <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-blue-600 text-xs font-bold uppercase tracking-wider">Instructor Feedback</span>
              <span className="text-blue-900 font-bold bg-blue-100 px-3 py-1 rounded-lg">Grade: {submission.grade}</span>
            </div>
            <p className="text-blue-800 text-sm leading-relaxed italic flex items-start">
              <MessageSquare size={16} className="mr-2 mt-1 flex-shrink-0" />
              &quot;{submission.feedback || "Good job on this task!"}&quot;
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              required
              disabled={!!submission?.grade}
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
              placeholder="Type your answer or solution here..."
            />
          </div>
          {!submission?.grade && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center bg-neutral-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-sm"
            >
              {isSubmitting ? "Submitting..." : submission ? "Update Submission" : "Submit Task"}
              <Send className="w-4 h-4 ml-2" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
