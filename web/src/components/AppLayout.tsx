import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Sparkles,
  Users,
  LogOut,
  Menu,
  X,
  UserCheck,
  ShieldCheck,
  Globe,
  Globe2,
  Building,
  ChevronDown,
  UserCircle,
} from 'lucide-react';
import { UserRole } from '../types';
import { NotificationBell } from './NotificationBell';
import { ChatModal } from './ChatModal';

export const AppLayout: React.FC = () => {
  const { user, logout, quickLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentSchoolId = searchParams.get('school_id');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatConvId, setActiveChatConvId] = useState<string | undefined>();
  const [activeChatStudentId, setActiveChatStudentId] = useState<string | undefined>();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchRole = async (role: UserRole, customEmail?: string, customPass?: string) => {
    setRoleMenuOpen(false);
    await quickLogin(role, customEmail, customPass);
    if (role === 'sysadmin') navigate('/sysadmin');
    else if (role === 'school_admin' || role === 'admin') navigate('/school-admin');
    else if (role === 'teacher') navigate('/teacher');
    else if (role === 'parent' || role === 'student') navigate('/parent/student/demo');
    else navigate('/login');
  };

  interface NavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
    badge?: string;
  }

  const sysadminNav: NavItem[] = [
    { to: '/sysadmin', label: 'Nationwide Schools', icon: Globe2, end: true },
  ];

  const schoolAdminNav: NavItem[] = [
    { to: '/school-admin', label: 'အတန်းများ', icon: BookOpen, end: true },
    { to: '/school-admin/timetable', label: 'အချိန်ဇယားနှင့် အဆိုင်း', icon: Calendar, badge: 'Shift' },
    { to: '/school-admin/teachers', label: 'ဆရာများ', icon: Users },
    { to: '/school-admin/students', label: 'ကျောင်းသားများ', icon: GraduationCap },
    { to: '/school-admin/profile', label: 'မိမိပရိုဖိုင် ပြင်ဆင်ရန်', icon: UserCircle },
    { to: '/gate-kiosk', label: 'ဝင်ပေါက် စစ်ဆေးရေး', icon: ShieldCheck, badge: 'NFC' },
  ];

  const teacherNav: NavItem[] = [
    { to: '/teacher', label: 'My Classes', icon: BookOpen, end: true },
    { to: '/teacher/copilot', label: 'AI Lesson Copilot', icon: Sparkles, badge: 'AI' },
    { to: '/gate-kiosk', label: 'Gate Kiosk', icon: ShieldCheck, badge: 'NFC' },
  ];

  let currentNav: NavItem[] = teacherNav;
  if (user?.role === 'sysadmin') {
    currentNav = sysadminNav;
  } else if (user?.role === 'school_admin' || user?.role === 'admin') {
    currentNav = schoolAdminNav;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-indigo-900 text-white flex items-center justify-between px-4 py-3 border-b border-indigo-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-indigo-300" />
          <span className="font-bold tracking-tight text-base">EduPlatform</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell
            onOpenChat={(convId, studentId) => {
              setActiveChatConvId(convId);
              setActiveChatStudentId(studentId);
              setChatOpen(true);
            }}
          />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded shadow-sm transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 rounded-md text-indigo-200 hover:bg-indigo-800 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex flex-col w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 border-r border-slate-800 z-30`}
      >
        {/* Brand */}
        <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">EduPlatform</h1>
            <p className="text-xs text-slate-400 font-sans">ပညာရေး စီမံခန့်ခွဲမှု စနစ်</p>
          </div>
        </div>

        {/* Current User Info Card */}
        {user && (
          <NavLink
            to="/school-admin/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-4 py-3.5 border-b border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 transition group cursor-pointer"
            title="ပရိုဖိုင် ပြင်ဆင်ရန် / Edit Profile"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border-2 border-indigo-400 shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:from-indigo-500 group-hover:to-indigo-700 transition">
                    {user.full_name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-indigo-300 transition">
                    Signed In As
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full capitalize ${
                      user.role === 'sysadmin'
                        ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                        : user.role === 'school_admin' || user.role === 'admin'
                        ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                        : user.role === 'teacher'
                        ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700'
                        : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <p className="font-semibold text-white truncate text-sm group-hover:text-indigo-200 transition">{user.full_name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          </NavLink>
        )}

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Navigation</p>
          {currentNav.map((item) => {
            const Icon = item.icon;
            const targetTo = currentSchoolId && item.to.startsWith('/school-admin')
              ? `${item.to}?school_id=${encodeURIComponent(currentSchoolId)}`
              : item.to;
            return (
              <NavLink
                key={item.to}
                to={targetTo}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-400/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}

          {(user?.role === 'parent' || user?.role === 'student') && (
            <NavLink
              to={`/parent/student/${user.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <Users className="h-4 w-4" />
              <span>Student Progress</span>
            </NavLink>
          )}
        </nav>

        {/* Quick Role Switcher for Testing */}
        <div className="p-3 border-t border-slate-800">
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                <span>Switch Role / Account</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {roleMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-1.5 z-40 space-y-1 max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Intaing BEHS Accounts
                </div>
                <button
                  onClick={() => handleSwitchRole('school_admin', 'admin@mmr013035-behs01.edu.local', 'mth')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <div className="truncate">
                    <div className="font-semibold truncate">Intaing Principal</div>
                    <div className="text-[10px] text-slate-400 font-mono">admin@mmr013035...</div>
                  </div>
                  <span className="text-[10px] text-emerald-300 bg-emerald-900/60 px-1 rounded font-bold">Admin</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('teacher', '0911111', 'mth')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <div className="truncate">
                    <div className="font-semibold truncate">Daw Thida (Teacher)</div>
                    <div className="text-[10px] text-slate-400 font-mono">0911111</div>
                  </div>
                  <span className="text-[10px] text-indigo-300 bg-indigo-900/60 px-1 rounded font-bold">Teacher</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('parent', '0922222', 'mth')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <div className="truncate">
                    <div className="font-semibold truncate">Daw Khin Mar (Parent)</div>
                    <div className="text-[10px] text-slate-400 font-mono">0922222</div>
                  </div>
                  <span className="text-[10px] text-emerald-300 bg-emerald-900/60 px-1 rounded font-bold">Parent</span>
                </button>

                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-700/60 mt-1 pt-1.5">
                  Platform Hubs
                </div>
                <button
                  onClick={() => handleSwitchRole('sysadmin')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>SysAdmin (Nationwide)</span>
                  <span className="text-[10px] text-blue-300 bg-blue-900/50 px-1 rounded">Sysadmin</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('school_admin')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>Yangon Admin</span>
                  <span className="text-[10px] text-purple-300 bg-purple-900/50 px-1 rounded">Facility</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('teacher')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>Teacher (Sarah Smith)</span>
                  <span className="text-[10px] text-indigo-300 bg-indigo-900/50 px-1 rounded">Teacher</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Logout */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Globe className="h-3.5 w-3.5" />
            <span>EN / မြန်မာ</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Desktop Navigation & User Controls Bar */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-6 py-2.5 items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {user?.role === 'sysadmin' && 'National SysAdmin Portal (MIMU Registry)'}
              {user?.role === 'school_admin' && 'School Facility Management'}
              {user?.role === 'teacher' && 'Teacher Academic Portal'}
              {user?.role === 'parent' && 'Parent / Guardian Portal'}
              {user?.role === 'student' && 'Student Portal'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell
              onOpenChat={(convId, studentId) => {
                setActiveChatConvId(convId);
                setActiveChatStudentId(studentId);
                setChatOpen(true);
              }}
            />

            {/* User Info chip */}
            <NavLink
              to="/school-admin/profile"
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 border border-slate-200 transition group cursor-pointer"
              title="ပရိုဖိုင် ပြင်ဆင်ရန် / Edit Profile"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover border border-indigo-300 shadow-xs"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
              )}
              <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">{user?.full_name}</span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-slate-500 text-[11px]">{user?.email}</span>
            </NavLink>

            {/* Direct Link to Login / Switch page */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Login / Account Selection</span>
            </button>

            {/* Prominent Red Sign Out Button */}
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <Outlet />
      </main>

      <ChatModal
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setActiveChatConvId(undefined);
          setActiveChatStudentId(undefined);
        }}
        conversationId={activeChatConvId}
        studentId={activeChatStudentId}
      />
    </div>
  );
};
