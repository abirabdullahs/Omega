'use client';

import { useState, useEffect } from "react";
import { UserPlus, Search, Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface Student {
  id: string;
  phone: string;
  name?: string;
  passwordChanged: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { user } = useAuth();

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const parseJsonResponse = async (res: Response) => {
    const text = await res.text();
    if (!text) return { ok: res.ok, status: res.status, statusText: res.statusText };
    try {
      return JSON.parse(text);
    } catch {
      return { ok: res.ok, status: res.status, statusText: res.statusText, error: text, _raw: text };
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchStudents() {
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/students", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseJsonResponse(res);
        if (isMounted) {
          if (res.ok && Array.isArray(data)) {
            setStudents(data);
          } else {
            setStudents([]);
            setError(data.error || data.details || data._raw || `Unable to load students (${res.status})`);
          }
        }
      } catch (err: any) {
        console.error(err);
        if (isMounted) setError(`Unable to load students: ${err.message || err}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchStudents();
    return () => { isMounted = false; };
  }, [reloadKey, user]);

  const filteredStudents = students.filter(s =>
    (s.name?.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone?.includes(search))
  );

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ students: [{ phone, name }] }),
      });
      const data = await res.json();
      const first = data.results?.[0];
      if (res.ok && data.success && first?.success) {
        setSuccess(`Student added successfully!`);
        setPhone("");
        setName("");
        setReloadKey(k => k + 1);
      } else {
        setError(first?.error || data.error || "Failed to add student");
      }
    } catch (err) {
      setError("Failed to add student");
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    setError("");
    setSuccess("");
    setIsAdding(true);

    const lines = bulkText.split("\n").filter(l => l.trim());
    const studentList = lines.map(line => {
      const [p, n] = line.split(",").map(s => s.trim());
      return { phone: p, name: n };
    }).filter(s => s.phone);

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ students: studentList }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const successes = data.results?.filter((r: any) => r.success).length ?? 0;
        const failures = data.failureCount ?? 0;
        setSuccess(
          failures > 0
            ? `${successes} students added (${failures} failed).`
            : `${successes} students added successfully!`
        );
        setBulkText("");
        setReloadKey(k => k + 1);
      } else {
        setError(data.error || "Failed to add students");
      }
    } catch (err) {
      setError("Failed to add students");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Manage Students</h2>
          <p className="text-neutral-500">Add and track your students&apos; access.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Student Forms */}
        <div className="lg:col-span-1 space-y-6">
          {/* Single Add */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
            <h3 className="text-sm font-bold mb-4 flex items-center uppercase tracking-widest text-neutral-400">
              <UserPlus className="w-4 h-4 mr-2" />
              Single Add
            </h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-4 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  placeholder="Abir Abdullah"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Phone Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                    <Phone size={14} />
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    placeholder="017XXXXXXXX"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isAdding}
                className="w-full bg-neutral-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isAdding ? "Adding..." : "Create Account"}
              </button>
            </form>
          </div>

          {/* Bulk Add */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
            <h3 className="text-sm font-bold mb-4 flex items-center uppercase tracking-widest text-neutral-400">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Bulk Add
            </h3>
            <div className="space-y-4">
              <p className="text-[10px] text-neutral-400 leading-relaxed">
                Enter students in format: <span className="font-bold">phone,name</span> (one per line).<br/>
                Example:<br/>
                01712345678,Abir Abdullah<br/>
                01812345678,Rahat Hossain
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full h-32 p-3 border border-neutral-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-neutral-900"
                placeholder="017XXXXXXXX,Name"
              />
              <button
                onClick={handleBulkAdd}
                disabled={isAdding || !bulkText.trim()}
                className="w-full bg-neutral-100 text-neutral-900 py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors border border-neutral-200"
              >
                {isAdding ? "Adding..." : "Bulk Create Accounts"}
              </button>
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">{error}</div>}
          {success && <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-lg border border-emerald-100 font-medium">{success}</div>}
        </div>

        {/* Student List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students..."
                  className="block w-full pl-10 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Student Info</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-neutral-400">Loading students...</td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-neutral-400">No students found.</td>
                    </tr>
                  ) : filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-neutral-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 font-bold text-xs">
                            {student.name ? student.name[0] : "S"}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900">{student.name || "Unnamed Student"}</p>
                            <p className="text-xs text-neutral-400 font-medium">{student.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {student.passwordChanged ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            PENDING LOGIN
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-neutral-400 text-[10px] font-medium">
                          {student.passwordChanged ? "Ready" : "Needs password change"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
