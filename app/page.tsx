'use client';

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && userData) {
        if (!userData.passwordChanged) {
          router.push("/login");
        } else {
          router.push(userData.role === "admin" ? "/admin" : "/student");
        }
      } else {
        router.push("/login");
      }
    }
  }, [user, userData, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <h1 className="text-xl font-bold tracking-widest uppercase">Omega</h1>
      </div>
    </div>
  );
}
