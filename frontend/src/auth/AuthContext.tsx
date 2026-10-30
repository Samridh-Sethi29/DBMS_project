import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login as loginRequest, register as registerRequest } from '@/api/auth.js';
import { setToken } from '@/api/client.js';

export interface AuthUser {
  userId: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  roll_no?: string;
  phone?: string | null;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  roll_no: string;
  department_id: number;
  year_of_study: number;
  phone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<unknown>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('ch_token')) {
      setLoading(false);
      return;
    }
    getCurrentUser()
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await loginRequest(email, password);
    setToken(data.token);
    setUser(data);
    return data as AuthUser;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await registerRequest(payload);
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
