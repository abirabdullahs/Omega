'use client';

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import ChatInterface from "@/components/chat-interface";
import { ShieldCheck, Info, ArrowLeft } from "lucide-react";

export default function StudentChatPage() {
  const { user, userData } = useAuth();

  if (!user || !userData) return null;

  return (
    <div className="space-y-8">
      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold text-neutral-900">Live Support</h2>
        <p className="text-neutral-500 text-sm">Direct line to Omega mentors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Fixed full-screen takeover on mobile/tablet, so the on-screen
              keyboard resizes this box instead of pushing the header off
              the top of the page. Reverts to a normal embedded card at lg. */}
          <div className="fixed inset-0 z-30 h-dvh flex flex-col bg-white lg:static lg:z-auto lg:h-full lg:max-h-[calc(100vh-14rem)]">
            <Link
              href="/student"
              className="lg:hidden flex items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-600 border-b border-neutral-100 shrink-0"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
            <div className="flex-1 min-h-0">
              <ChatInterface
                roomId={user.uid}
                currentUser={{
                  uid: user.uid,
                  name: userData.name || userData.phone || "Student",
                  role: "student"
                }}
              />
            </div>
          </div>
        </div>

        <div className="hidden lg:block space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Chat Privacy
            </h3>
            <div className="flex items-start space-x-3 text-xs text-neutral-500 leading-relaxed">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p>
                To keep our systems light and fast, all chat messages are 
                <span className="text-neutral-900 font-bold mx-1">automatically deleted after 10 minutes</span>. 
                Please save any important instructions or links provided by mentors.
              </p>
            </div>
          </div>

          <div className="bg-neutral-900 p-6 rounded-3xl text-white space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Mentor Availability</p>
            <p className="text-sm font-medium">Mentors are typically active during study hours. Feel free to leave a message and someone will get back to you.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
