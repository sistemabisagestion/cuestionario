import { createContext, useContext } from 'react';
import type { Usuario } from '../types';

export interface UserContextType {
  user: Usuario | null;
  login: (user: Usuario) => void;
  logout: () => void;
}

export const UserContext = createContext<UserContextType | null>(null);

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
