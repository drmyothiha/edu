import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, LogIn, UserCheck, Users, BookOpen, Globe2, Building } from 'lucide-react';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { login, quickLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectAfterLogin = (role: UserRole) => {
    const from = (location.state as any)?.from?.pathname;
    if (from && from !== '/login') {
      navigate(from, { replace: true });
      return;
    }
    if (role === 'sysadmin') navigate('/sysadmin');
    else if (role === 'school_admin' || role === 'admin') navigate('/school-admin');
    else if (role === 'teacher') navigate('/teacher');
    else if (role === 'parent' || role === 'student') navigate('/parent/student/demo');
    else navigate('/teacher');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      const savedUser = JSON.parse(localStorage.getItem('edu_auth_user') || '{}');
      redirectAfterLogin(savedUser.role || 'teacher');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole, customEmail?: string) => {
    setError(null);
    setLoading(true);
    try {
      await quickLogin(role, customEmail);
      redirectAfterLogin(role);
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
          <GraduationCap className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-3xl font-extrabold text-slate-900 tracking-tight">
          EduPlatform Portal
        </h2>
        <p className="mt-1 text-sm text-slate-600 font-sans">
          တစ်နိုင်ငံလုံး အဆင့်ဆင့် ပညာရေး စီမံခန့်ခွဲမှု • Multi-Tenant Education Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-5 rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-800">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sysadmin@edu.local"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 transition"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Sign In
                </>
              )}
            </button>
          </form>

          {/* Multi-Tenant Demo Role Logins */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center mb-3">
              Nationwide Demo Accounts (Option A P-Codes)
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('sysadmin')}
                disabled={loading}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-950 text-xs font-medium transition"
              >
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-bold">SysAdmin (Platform Owner)</div>
                    <div className="text-[10px] text-blue-600">Nationwide Oversight • All 15 States & Regions</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] bg-blue-200/70 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                  Global
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('school_admin', 'admin.ygn@edu.local')}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-purple-950 text-xs font-medium transition text-left"
                >
                  <Building className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-bold truncate">Yangon Principal</div>
                    <div className="text-[10px] text-purple-600 truncate font-mono">MMR013001001-PV01</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('school_admin', 'admin.mdy@edu.local')}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-purple-950 text-xs font-medium transition text-left"
                >
                  <Building className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-bold truncate">Mandalay Principal</div>
                    <div className="text-[10px] text-purple-600 truncate font-mono">MMR009002004-HS16</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('school_admin', 'admin.tgi@edu.local')}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-purple-950 text-xs font-medium transition text-left"
                >
                  <Building className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-bold truncate">Taunggyi Principal</div>
                    <div className="text-[10px] text-purple-600 truncate font-mono">MMR014001002-PV01</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('school_admin', 'admin.npt@edu.local')}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-purple-950 text-xs font-medium transition text-left"
                >
                  <Building className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-bold truncate">Nay Pyi Taw Principal</div>
                    <div className="text-[10px] text-purple-600 truncate font-mono">MMR018001001-HS01</div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('teacher')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-indigo-900 text-xs font-medium transition"
                >
                  <BookOpen className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                  <div className="text-left truncate">
                    <div className="font-bold">Teacher</div>
                    <div className="text-[9px] text-indigo-600 truncate">Sarah Smith</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('parent')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-900 text-xs font-medium transition"
                >
                  <Users className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <div className="text-left truncate">
                    <div className="font-bold">Parent</div>
                    <div className="text-[9px] text-emerald-600 truncate">Eleanor Clark</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('student')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-amber-900 text-xs font-medium transition"
                >
                  <UserCheck className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  <div className="text-left truncate">
                    <div className="font-bold">Student</div>
                    <div className="text-[9px] text-amber-600 truncate">Alice Walker</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
