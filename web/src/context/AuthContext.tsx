import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (role: UserRole, customEmail?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'edu_auth_token';
const USER_KEY = 'edu_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Verify session on mount if token exists
    if (token && !user) {
      setIsLoading(true);
      api.auth
        .me()
        .then((userData) => {
          setUser(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await api.auth.login(email, password);
      localStorage.setItem(TOKEN_KEY, resp.token);
      localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
      setToken(resp.token);
      setUser(resp.user);
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: UserRole, customEmail?: string) => {
    if (customEmail) {
      const pass =
        role === 'sysadmin'
          ? 'SysAdmin123!'
          : role === 'teacher'
          ? 'Teacher123!'
          : role === 'student'
          ? 'Student123!'
          : role === 'parent'
          ? 'Parent123!'
          : 'Admin123!';
      await login(customEmail, pass);
      return;
    }
    const credentials: Record<UserRole, { email: string; pass: string }> = {
      sysadmin: { email: 'sysadmin@edu.local', pass: 'SysAdmin123!' },
      school_admin: { email: 'admin.ygn@edu.local', pass: 'Admin123!' },
      admin: { email: 'admin@edu.local', pass: 'Admin123!' },
      teacher: { email: 'teacher.smith@edu.local', pass: 'Teacher123!' },
      parent: { email: 'parent.clark@edu.local', pass: 'Parent123!' },
      student: { email: 'student.alice@edu.local', pass: 'Student123!' },
    };
    const cred = credentials[role];
    if (cred) {
      await login(cred.email, cred.pass);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        quickLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
