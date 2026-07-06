import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types';
import { getCurrentUser, setCurrentUser as saveUser, clearCurrentUser } from '../utils/storage';

interface UserContextType {
  user: Usuario | null;
  login: (user: Usuario) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => getCurrentUser());

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const login = (u: Usuario) => {
    saveUser(u);
    setUser(u);
  };

  const logout = () => {
    clearCurrentUser();
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
