'use client';

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate } from "@/lib/utils"; // Removed parseDateInputLocal as we are using native Date parsing for datetime-local
import ReactMarkdown from "react-markdown";
import { Plus, Clock, FileText, Eye, Calendar, Trash2, X } from "lucide-react";

interface Task {
  id: string;
  title: string;
  contentMarkdown: string;
  createdAt: any;
  deadline?: any;
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [preview, setPreview] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const toast = useToast();

  const fetchTasks = async () => {
    try {
      const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setTasks(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    try {
      const docRef = await addDoc(collection(db, "tasks"), {
        title,
        contentMarkdown: content,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
        // Using new Date() to capture both the date and time from the datetime-local input
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
      });
      setTitle("");
      setContent("");
      setDeadline("");
      setShowCreate(false);
      fetchTasks();
      toast.success("Task created successfully!");

      try {
        const token = await user?.getIdToken();
        if (token) {
          await fetch("/api/notify/task", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title, taskId: docRef.id }),
          });
        }
      } catch (notifyErr) {
        console.warn("Failed to notify students of new task:", notifyErr);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create task.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task permanently?")) return;
    setDeletingId(taskId);
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      if (viewingTask?.id === taskId) setViewingTask(null);
      fetchTasks();
      toast.success("Task deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete task.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Task Management</h2>
          <p className="text-neutral-500">Create and manage mentorship assignments.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showCreate ? "Cancel" : "New Task"}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Create New Task</h3>
            <div className="flex bg-neutral-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!preview ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${preview ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
              >
                Preview
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Task Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                placeholder="e.g. Introduction to React"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">Deadline (Date & Time)</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">Content (Markdown)</label>
              {preview ? (
                <div className="mt-1 block w-full px-4 py-3 border border-neutral-200 rounded-xl bg-neutral-50 prose prose-neutral max-w-none min-h-[300px]">
                  <ReactMarkdown>{content || "*No content to preview*"}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  required
                  rows={12}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 font-mono text-sm"
                  placeholder="### Task Instructions..."
                />
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-neutral-900 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors"
              >
                Publish Task
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-neutral-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="col-span-full py-20 text-center text-neutral-400 bg-white rounded-2xl border border-dashed border-neutral-200">
            No tasks created yet. Click &quot;New Task&quot; to begin.
          </div>
        ) : tasks.map((task) => (
          <div key={task.id} className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm hover:border-neutral-200 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-neutral-50 p-3 rounded-xl group-hover:bg-neutral-100 transition-colors">
                <FileText className="w-6 h-6 text-neutral-900" />
              </div>
              <div className="flex flex-col items-end text-[10px] text-neutral-400 font-medium uppercase tracking-wider space-y-1">
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Created: {formatDate(task.createdAt) || "Just now"}
                </div>
                {task.deadline && (
                  <div className="flex items-center text-red-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    Due: {formatDate(task.deadline)}
                  </div>
                )}
              </div>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">{task.title}</h3>
            <p className="text-sm text-neutral-500 line-clamp-2 mb-4">
              {task.contentMarkdown.replace(/[#*`]/g, "")}
            </p>
            <div className="pt-4 border-t border-neutral-50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setViewingTask(task)}
                className="text-xs font-semibold text-neutral-900 hover:underline flex items-center"
              >
                <Eye className="w-3 h-3 mr-1" /> View Details
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTask(task.id)}
                disabled={deletingId === task.id}
                className="text-xs font-semibold text-neutral-500 hover:text-red-600 disabled:opacity-50 flex items-center"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {deletingId === task.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{viewingTask.title}</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Created {formatDate(viewingTask.createdAt) || "—"}
                  {viewingTask.deadline ? ` · Due ${formatDate(viewingTask.deadline)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingTask(null)}
                className="text-neutral-400 hover:text-neutral-900 bg-neutral-100 p-2 rounded-full hover:bg-neutral-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto prose prose-sm max-w-none">
              <ReactMarkdown>{viewingTask.contentMarkdown}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
