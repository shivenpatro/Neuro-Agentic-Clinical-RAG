import { create } from "zustand";
import { login as apiLogin, register as apiRegister } from "@/lib/api";

interface AuthState {
  token: string | null;
  username: string | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  username: null,
  isLoading: false,
  error: null,

  loadFromStorage: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const username = localStorage.getItem("auth_username");
    if (token && username) {
      set({ token, username });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiLogin(username, password);
      localStorage.setItem("auth_token", res.access_token);
      localStorage.setItem("auth_username", username);
      set({ token: res.access_token, username, isLoading: false });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiRegister(username, password);
      localStorage.setItem("auth_token", res.access_token);
      localStorage.setItem("auth_username", username);
      set({ token: res.access_token, username, isLoading: false });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_username");
    set({ token: null, username: null });
  },
}));
