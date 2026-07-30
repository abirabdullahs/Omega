'use client';

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { collection, query, orderBy, getDocs, limit, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Send, User, Shield, Clock } from "lucide-react";

interface Message {
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Fetch initial messages from Firestore (within 10 min window)
    const fetchMessages = async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const q = query(
        collection(db, "chats", roomId, "messages"),
        where("createdAt", ">=", tenMinutesAgo),
        orderBy("createdAt", "asc")
      );
      
      try {
        const snap = await getDocs(q);
        const initialMsgs = snap.docs.map(d => d.data() as Message);
        setMessages(initialMsgs);
      } catch (err) {
        console.error("Error fetching chat history:", err);
      }
    };

    fetchMessages();

    // 2. Setup Socket.io
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("join", roomId);
    });

    newSocket.on("receive_message", (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !socket) return;

    const msgData = {
      roomId,
      senderId: currentUser.uid,
      senderName: currentUser.name || "User",
      text: input,
      role: currentUser.role,
    };

    socket.emit("send_message", msgData);
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
            key={i} 
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
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
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

import { MessageSquare } from "lucide-react";
