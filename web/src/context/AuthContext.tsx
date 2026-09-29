import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (role: UserRole, customEmail?: string, customPass?: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  refreshUser: () => Promise<User | null>;
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

  const quickLogin = async (role: UserRole, customEmail?: string, customPass?: string) => {
    if (customEmail) {
      const pass = customPass || 'mth';
      try {
        await login(customEmail, pass);
      } catch (err) {
        if (role === 'sysadmin') {
          await login(customEmail, pass === 'mth' ? 'SysAdmin123!' : 'mth');
        } else {
          throw err;
        }
      }
      return;
    }
    const credentials: Record<UserRole, { email: string; pass: string }> = {
      sysadmin: { email: 'sysadmin@edu.local', pass: 'mth' },
      school_admin: { email: 'admin@mmr013035-behs01.edu.local', pass: 'mth' },
      admin: { email: 'admin@mmr013035-behs01.edu.local', pass: 'mth' },
      teacher: { email: '0911111', pass: 'mth' },
      parent: { email: '0922222', pass: 'mth' },
      student: { email: 'student.alice@edu.local', pass: 'mth' },
    };
    const cred = credentials[role];
    if (cred) {
      try {
        await login(cred.email, cred.pass);
      } catch (err) {
        if (role === 'sysadmin') {
          await login(cred.email, 'SysAdmin123!');
        } else {
          throw err;
        }
      }
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updatedData };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  const refreshUser = async (): Promise<User | null> => {
    try {
      const freshUser = await api.auth.me();
      setUser(freshUser);
      localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      return freshUser;
    } catch (e) {
      console.warn('Failed to refresh user profile:', e);
      return null;
    }
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
        updateUser,
        refreshUser,
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
