'use client';

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, getDocs, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Send, User, Shield, Clock, MessageSquare } from "lucide-react";

interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  role: string;
  createdAt: any;
}

interface ChatInterfaceProps {
  roomId: string; // This will be the studentId
  currentUser: {
    uid: string;
    name: string;
    role: string;
  };
}

export default function ChatInterface({ roomId, currentUser }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      if (!db) return;
      // Load recent messages (no 10-minute cut-off). Limit to 1000 to avoid huge loads.
      const messagesRef = collection(db, "chats", roomId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));

      try {
        const snap = await getDocs(q);
        if (cancelled) return;
        const initialMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        setMessages(initialMsgs);
      } catch (err) {
        console.error("Error fetching chat history:", err);
      }
    };

    fetchMessages();

    // Use Firestore realtime listener for messages
    let unsubscribe: (() => void) | null = null;
    try {
      const messagesRef = collection(db, "chats", roomId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));
      unsubscribe = onSnapshot(q, (snap) => {
        if (cancelled) return;
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        setMessages(items);
      }, (err) => {
        console.error("Realtime listener error:", err);
      });
    } catch (err) {
      console.error("Error setting up realtime listener:", err);
    }

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const markRead = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const endpoint = currentUser.role === 'admin'
          ? `/api/admin/chats/mark-read`
          : `/api/chats/mark-read`;

        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roomId }),
        });
      } catch (err) {
        console.warn('Unable to mark chat read:', err);
      }
    };

    markRead();
  }, [roomId, currentUser.role]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    setSendError(null);
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setSendError("Not authenticated");
      return;
    }

    const messageData = {
      senderId: uid,
      senderName: currentUser.name,
      text: input.trim(),
      role: currentUser.role,
      createdAt: serverTimestamp(),
    } as any;

    // Persist to Firestore; realtime listener will pick it up
    try {
      const messagesRef = collection(db, "chats", roomId, "messages");
      await addDoc(messagesRef, messageData);
      setInput("");

      // Update the room's meta (last message, unread flags) so the students
      // list / nav badge can react live, without waiting for a page reload.
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          await fetch("/api/chats/touch-meta", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ roomId, text: messageData.text }),
          });
        }
      } catch (metaErr) {
        console.warn("Unable to update chat meta:", metaErr);
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      setSendError(err?.message || String(err));
    }
  };

  const handleCompleteSession = async () => {
    if (!confirm("Complete this session? This will permanently delete all messages for this chat.")) return;
    try {
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error("Not authenticated");
      const token = await auth.currentUser?.getIdToken();
      const url = `/api/admin/chats?roomId=${encodeURIComponent(roomId)}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to complete session (${res.status})`);
      }
      // Clear local messages
      setMessages([]);
    } catch (err: any) {
      console.error("Failed to complete session:", err?.message || err);
      setSendError(err?.message || String(err));
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-white md:rounded-3xl md:border md:border-neutral-100 md:shadow-sm overflow-hidden">
      <div className="sticky top-0 z-20 p-4 border-b border-neutral-100 bg-white/95 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-900">Live Support</p>
            <p className="text-[10px] text-neutral-500 font-medium">Messenger</p>
          </div>
        </div>
        {/* Admin controls */}
        {currentUser.role === 'admin' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCompleteSession}
              className="text-xs px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Complete this session
            </button>
          </div>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 bg-neutral-50/30 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 opacity-50">
            <MessageSquare className="w-12 h-12 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-500">No active messages.<br/>Start a conversation!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div 
            key={msg.id || `${msg.senderId}-${msg.createdAt?.seconds || msg.createdAt}-${i}`} 
            className={`flex flex-col ${msg.senderId === currentUser.uid ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              msg.senderId === currentUser.uid 
                ? 'bg-neutral-900 text-white rounded-tr-none' 
                : 'bg-white border border-neutral-100 text-neutral-900 rounded-tl-none shadow-sm'
            }`}>
              <p className="text-[10px] font-bold opacity-50 mb-1 flex items-center">
                {msg.role === 'admin' && <Shield size={8} className="mr-1" />}
                {msg.senderName}
              </p>
              <p className="leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 z-20 p-4 border-t border-neutral-100 bg-white/95 backdrop-blur-sm">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="w-full pr-12 pl-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all outline-none"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-200"
          >
            <Send size={16} />
          </button>
        </div>
        {sendError && <div className="mt-2 text-xs text-red-600">{sendError}</div>}
      </div>
    </div>
  );
}
