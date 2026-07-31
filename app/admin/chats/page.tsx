'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import ChatInterface from "@/components/chat-interface";
import { Search, MessageCircle, ArrowLeft } from "lucide-react";

interface Student {
  id: string;
  name?: string;
  phone: string;
}

interface ChatMeta {
  roomId: string;
  lastMessageAt: number | null;
  lastMessageText?: string | null;
  unreadForAdmin?: boolean;
  unreadForStudent?: boolean;
}

export default function AdminChatDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [chatMetas, setChatMetas] = useState<Record<string, ChatMeta>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, userData } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const [studentsRes, metaRes] = await Promise.all([
          fetch(new URL(window.location.origin + "/api/admin/students").toString(), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(new URL(window.location.origin + "/api/admin/chats/meta").toString(), {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const studentsData = await studentsRes.json().catch(() => null);
        if (studentsRes.ok && Array.isArray(studentsData?.items)) {
          setStudents(
            studentsData.items.map((i: any) => ({ id: i.id, name: i.name || null, phone: i.phone || null }))
          );
        } else {
          console.error("Students API error:", studentsData);
        }

        const metaData = await metaRes.json().catch(() => null);
        if (metaRes.ok && Array.isArray(metaData?.items)) {
          setChatMetas(
            metaData.items.reduce((acc: Record<string, ChatMeta>, item: ChatMeta) => {
              if (item?.roomId) acc[item.roomId] = item;
              return acc;
            }, {})
          );
        } else {
          console.error("Chat meta API error:", metaData);
        }
      } catch (err) {
        console.error("Error fetching chat data:", err);
      }
    };
    fetchData();
  }, [user?.uid]);

  const studentsWithMeta = students
    .map((s) => ({ ...s, meta: chatMetas[s.id] }))
    .sort((a, b) => (b.meta?.lastMessageAt || 0) - (a.meta?.lastMessageAt || 0));

  const filteredStudents = studentsWithMeta.filter((s) =>
    (s.name?.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone?.includes(search))
  );

  if (!user || !userData) return null;

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900">Live Support</h2>
        <p className="text-neutral-500 text-sm">Chat in real-time with students.</p>
      </div>

      <div className="flex-1 flex gap-4 md:gap-8 min-h-0">
        {/* Sidebar: Student List — full-width on mobile, hidden once a student is picked so the chat can take over the screen */}
        <div className={`${selectedStudent ? 'hidden md:flex' : 'flex'} flex-col bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden transition-all ${sidebarOpen ? 'w-full md:w-96' : 'w-14'}`}>
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/30">
            <div className="relative flex items-center">
              <button onClick={() => setSidebarOpen(open => !open)} className="p-2 rounded-md hover:bg-neutral-100 shrink-0">
                <svg className="w-5 h-5 text-neutral-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" /></svg>
              </button>
              {sidebarOpen && (
                <div className="flex-1 ml-2 min-w-0">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-100 rounded-xl text-xs focus:ring-2 focus:ring-neutral-900 transition-all outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={`flex-1 overflow-y-auto divide-y divide-neutral-50 ${sidebarOpen ? '' : 'hidden'}`}>
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">No students found.</div>
            ) : (
              filteredStudents.map((s) => {
                const unread = s.meta?.unreadForAdmin;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className={`w-full p-4 flex items-center space-x-3 transition-all hover:bg-neutral-50 text-left ${
                      selectedStudent?.id === s.id ? 'bg-neutral-50 border-r-4 border-neutral-900' : ''
                    }`}
                  >
                    <div className="w-10 h-10 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-500 font-bold text-xs shrink-0">
                      {s.name ? s.name[0] : "S"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm break-words ${unread ? 'font-bold text-neutral-900' : 'text-neutral-900'}`}>
                          {s.name || "Unnamed"}
                        </p>
                        {unread ? (
                          <span className="text-[10px] px-2 py-1 bg-amber-500 text-white rounded-full">Unread</span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-neutral-400 font-medium">{s.phone}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area — hidden on mobile until a student is selected, then takes the full screen */}
        <div className={`flex-1 min-h-0 ${selectedStudent ? 'block' : 'hidden md:block'} ${sidebarOpen ? '' : 'pl-2'}`}>
          {selectedStudent ? (
            <div className="h-full flex flex-col">
              <button
                onClick={() => setSelectedStudent(null)}
                className="md:hidden flex items-center gap-2 px-4 py-3 mb-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-white rounded-2xl border border-neutral-100 shadow-sm shrink-0"
              >
                <ArrowLeft size={16} />
                Back to students
              </button>
              <div className="flex-1 min-h-0">
                <ChatInterface 
                  roomId={selectedStudent.id} 
                  currentUser={{
                    uid: user.uid,
                    name: userData.name || "Admin",
                    role: "admin"
                  }} 
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border border-neutral-100 border-dashed text-center p-12 space-y-4">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center">
                <MessageCircle size={32} className="text-neutral-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Select a Conversation</h3>
                <p className="text-sm text-neutral-500 max-w-xs mx-auto">Choose a student from the left to start a real-time support session.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}