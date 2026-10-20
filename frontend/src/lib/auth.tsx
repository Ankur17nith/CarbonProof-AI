import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthResponse, Role, User } from '@/types/api';
import { api, setApiAuthToken, setOnUnauthorized } from './api';

interface AuthContextValue {
  user: User | null;
  role: Role;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_STORAGE_KEY = 'carbonproof_auth_token';
const USER_STORAGE_KEY = 'carbonproof_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem(USER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    setApiAuthToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await api.post<AuthResponse>('auth/login', { email, password });
    sessionStorage.setItem(TOKEN_STORAGE_KEY, res.accessToken);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
    setApiAuthToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });

    const initAuth = async () => {
      const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        setApiAuthToken(token);
        try {
          const currentUser = await api.get<User>('auth/me');
          setUser(currentUser);
          sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };

    void initAuth();
  }, [logout]);

  const value: AuthContextValue = {
    user,
    role: user?.role ?? 'PUBLIC',
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
