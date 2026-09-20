import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { CopilotPage } from './pages/CopilotPage';
import { AttendancePage } from './pages/AttendancePage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { SysadminDashboard } from './pages/SysadminDashboard';
import { SchoolAdminDashboard } from './pages/SchoolAdminDashboard';
import { ParentStudentView } from './pages/ParentStudentView';

const HomeRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'sysadmin') return <Navigate to="/sysadmin" replace />;
  if (user.role === 'school_admin' || user.role === 'admin') return <Navigate to="/school-admin" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
  if (user.role === 'parent' || user.role === 'student') return <Navigate to="/parent/student/demo" replace />;
  return <Navigate to="/teacher" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter basename="/edu">
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect based on user state & role */}
          <Route path="/" element={<HomeRedirect />} />

          {/* SysAdmin Nationwide Routes */}
          <Route
            path="/sysadmin"
            element={
              <ProtectedRoute allowedRoles={['sysadmin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SysadminDashboard />} />
            <Route path="schools" element={<SysadminDashboard />} />
          </Route>

          {/* School Admin Facility Routes */}
          <Route
            path="/school-admin"
            element={
              <ProtectedRoute allowedRoles={['school_admin', 'admin', 'sysadmin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SchoolAdminDashboard />} />
            <Route path="classes" element={<SchoolAdminDashboard />} />
          </Route>

          {/* Legacy /admin redirect/route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'school_admin', 'sysadmin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SchoolAdminDashboard />} />
            <Route path="classes" element={<SchoolAdminDashboard />} />
          </Route>

          {/* Teacher Routes */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'school_admin', 'admin', 'sysadmin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TeacherDashboard />} />
            <Route path="copilot" element={<CopilotPage />} />
            <Route path="classes/:id/attendance" element={<AttendancePage />} />
            <Route path="classes/:id/assignments" element={<AssignmentsPage />} />
          </Route>

          {/* Parent / Student Progress Route */}
          <Route
            path="/parent"
            element={
              <ProtectedRoute allowedRoles={['parent', 'student', 'teacher', 'school_admin', 'admin', 'sysadmin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="student/:id" element={<ParentStudentView />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
