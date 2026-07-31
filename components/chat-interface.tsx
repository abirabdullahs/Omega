'use client';

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, getDocs, where, onSnapshot, addDoc } from "firebase/firestore";
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
  const socketRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      if (!db) return;
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const q = query(
        collection(db, "chats", roomId, "messages"),
        where("createdAt", ">=", tenMinutesAgo),
        orderBy("createdAt", "asc")
      );

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

    // Use Firestore realtime listener for messages instead of Socket.IO
    let unsubscribe: (() => void) | null = null;
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const messagesRef = collection(db, "chats", roomId, "messages");
      const q = query(messagesRef, where("createdAt", ">=", tenMinutesAgo), orderBy("createdAt", "asc"));
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.name,
      text: input.trim(),
      role: currentUser.role,
      createdAt: new Date(),
    } as Message;

    // Persist to Firestore; realtime listener will pick it up
    try {
      const messagesRef = collection(db, "chats", roomId, "messages");
      addDoc(messagesRef, messageData);
    } catch (err) {
      console.error("Error sending message:", err);
    }
    setInput("");
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-900">Live Support</p>
            <p className="text-[10px] text-amber-500 font-medium flex items-center">
              <Clock size={10} className="mr-1" /> Messages disappear after 10m
            </p>
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-4 bg-neutral-50/30 scroll-smooth"
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

      <div className="p-4 border-t border-neutral-100 bg-white">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="w-full pl-4 pr-12 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all outline-none"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-200"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
