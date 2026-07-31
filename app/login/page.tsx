'use client';

import { useState, useEffect } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { formatPhoneToEmail } from "@/lib/auth-utils";
import { LogIn, Lock, Phone } from "lucide-react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const { user, userData, loading, refreshUserData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userData) {
      if (userData.passwordChanged) {
        router.push(userData.role === "admin" ? "/admin" : "/student");
      }
    }
  }, [user, userData, loading, router]);

  const isPasswordChangeRequired = !loading && !!user && !!userData && !userData.passwordChanged;
  const isChangingPassword = showPasswordChange || isPasswordChangeRequired;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!auth) {
      setError("Firebase is not configured. Check your environment variables.");
      return;
    }
    try {
      const loginValue = phone.trim();
      const email = loginValue.includes("@")
        ? loginValue.toLowerCase()
        : formatPhoneToEmail(loginValue);

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Firebase login error:", err);
      setError(err?.message || "Invalid phone number or password");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!auth || !db) {
      setError("Firebase is not configured. Check your environment variables.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      if (!auth.currentUser) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const currentPasswordValue = currentPassword.trim() || password.trim();
      if (!currentPasswordValue) {
        setError("Please enter your current password to continue.");
        return;
      }

      const loginEmail = auth.currentUser.email || (phone.trim().includes("@") ? phone.trim().toLowerCase() : formatPhoneToEmail(phone.trim()));
      const credential = EmailAuthProvider.credential(loginEmail, currentPasswordValue);

      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        passwordChanged: true
      });
      await refreshUserData();

      const role = userData?.role || "student";
      router.push(role === "admin" ? "/admin" : "/student");
    } catch (err: any) {
      const message = err?.code === "auth/requires-recent-login"
        ? "Please sign in again and try the password update once more."
        : err?.message || "Could not update password";
      setError(message);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
        <div>
          <div className="w-16 h-16 bg-neutral-900 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-neutral-200">
            <span className="text-amber-500 font-black text-2xl">Ω</span>
          </div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-900">
            {isChangingPassword ? "Update Password" : "Welcome to Omega"}
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-500">
            {isChangingPassword 
              ? "You must change your password before continuing."
              : "Premium Mentorship Platform"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        {isChangingPassword ? (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordChange}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Current Password</label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    placeholder="Enter your current password"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">New Password</label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Confirm New Password</label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors"
            >
              Update & Continue
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Phone Number</label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                    <Phone size={18} />
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    placeholder="017XXXXXXXX"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Password</label>
                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
