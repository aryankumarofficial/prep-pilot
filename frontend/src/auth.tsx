import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { APIError, api, errorMessage, post, setCSRF } from "./api";
import type { User } from "./types";

type AuthResponse = { user: User; csrf_token: string };
type AuthState = {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  accept: (value: AuthResponse) => void;
  logout: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accept = useCallback((value: AuthResponse) => {
    setCSRF(value.csrf_token);
    setUser(value.user);
  }, []);
  const refresh = useCallback(async () => {
    setError("");
    try {
      accept(await api<AuthResponse>("/auth/session"));
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        setUser(null);
        setCSRF("");
      } else setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const logout = async () => {
    await post("/auth/logout");
    setUser(null);
    setCSRF("");
  };
  return (
    <Context.Provider value={{ user, loading, error, refresh, accept, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
