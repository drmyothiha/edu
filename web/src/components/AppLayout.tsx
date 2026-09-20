import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  BookOpen,
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
} from 'lucide-react';
import { UserRole } from '../types';

export const AppLayout: React.FC = () => {
  const { user, logout, quickLogin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchRole = async (role: UserRole) => {
    setRoleMenuOpen(false);
    await quickLogin(role);
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
    { to: '/school-admin', label: 'School Facility', icon: Building, end: true },
    { to: '/school-admin/classes', label: 'Classes & Faculty', icon: GraduationCap },
  ];

  const teacherNav: NavItem[] = [
    { to: '/teacher', label: 'My Classes', icon: BookOpen, end: true },
    { to: '/teacher/copilot', label: 'AI Lesson Copilot', icon: Sparkles, badge: 'AI' },
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
      <header className="md:hidden bg-indigo-900 text-white flex items-center justify-between px-4 py-3 border-b border-indigo-800">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-indigo-300" />
          <span className="font-bold tracking-tight text-base">EduPlatform</span>
          <span className="text-xs bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded font-mono">ပညာရေး</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded-md text-indigo-200 hover:bg-indigo-800 focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
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
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Signed In As</span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
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
            <p className="font-semibold text-white truncate text-sm">{user.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Navigation</p>
          {currentNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
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
                <span>Switch Demo Role</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {roleMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-1.5 z-40 space-y-1">
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
                  <span>School Admin (Yangon)</span>
                  <span className="text-[10px] text-purple-300 bg-purple-900/50 px-1 rounded">Facility</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('teacher')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>Teacher (Sarah Smith)</span>
                  <span className="text-[10px] text-indigo-300 bg-indigo-900/50 px-1 rounded">Teacher</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('parent')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>Parent (Eleanor Clark)</span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-900/50 px-1 rounded">Parent</span>
                </button>
                <button
                  onClick={() => handleSwitchRole('student')}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>Student (Alice Walker)</span>
                  <span className="text-[10px] text-amber-300 bg-amber-900/50 px-1 rounded">Student</span>
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
