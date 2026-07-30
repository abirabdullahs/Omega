'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Bell, Link as LinkIcon, Clock, Megaphone } from "lucide-react";

interface Notice {
  id: string;
  title: string;
  content: string;
  targetLink?: string;
  createdAt: any;
}

export default function StudentNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotices() {
      setLoading(true);
      try {
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setNotices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotices();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
          <Megaphone size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Notice Board</h2>
          <p className="text-neutral-500 text-sm">Stay updated with the latest announcements.</p>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="py-20 text-center text-neutral-400">Checking for updates...</div>
        ) : notices.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 bg-white rounded-3xl border border-neutral-100">
            No announcements at the moment.
          </div>
        ) : notices.map((notice) => (
          <div key={notice.id} className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-neutral-900 text-xl">{notice.title}</h3>
              <div className="text-[10px] text-neutral-400 font-bold bg-neutral-50 px-2 py-1 rounded-md flex items-center">
                <Clock size={12} className="mr-1" />
                {notice.createdAt?.toDate().toLocaleDateString()}
              </div>
            </div>
            <p className="text-neutral-600 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
            {notice.targetLink && (
              <div className="mt-6">
                <a
                  href={notice.targetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center bg-neutral-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all shadow-sm"
                >
                  <LinkIcon size={16} className="mr-2" />
                  View Resource
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
