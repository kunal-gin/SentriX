import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Navigate } from 'react-router-dom';

import {
  apiFetch,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  publicFetch,
  setTokens,
} from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface LoginResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMe() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiFetch<AuthUser>('/auth/me');
        setUser(me);
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadMe();
  }, []);

  async function login(email: string, password: string) {
    const response = await publicFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });

    setTokens(response.access_token, response.refresh_token);
    setUser(response.user);
  }

  async function logout() {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      try {
        await publicFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        });
      } catch {
        // Ignore logout errors.
      }
    }

    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted">
        Loading SentriX...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
