import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { AuthUser, SignUpResult } from '../services/interfaces/IAuthService';
import { ServiceContainer } from '../services/ServiceContainer';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithFabric: () => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  usernameAuthEnabled: boolean;
  fabricAuthEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authService = ServiceContainer.create().authService;

  useEffect(() => {
    authService
      .initEmbeddedAuth()
      .then((embeddedUser) => {
        if (embeddedUser) {
          setUser(embeddedUser);
          return null;
        }
        return authService.getCurrentUser();
      })
      .then((currentUser) => {
        if (currentUser) setUser(currentUser);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [authService]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setLoading(true);
      try {
        const signedIn = await authService.signIn(email, password);
        setUser(signedIn);
        return signedIn;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign in failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authService]
  );

  const signInWithFabric = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const signedIn = await authService.ensureSignedInWithFabric();
      setUser(signedIn);
      return signedIn;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authService]);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authService.getCurrentUser());
    } catch {
      setUser(null);
    }
  }, [authService]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setLoading(true);
      try {
        return await authService.signUp(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign up failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authService]
  );

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, [authService]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithFabric,
        refreshUser,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!user,
        usernameAuthEnabled: authService.usernameAuthEnabled,
        fabricAuthEnabled: authService.fabricAuthEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
