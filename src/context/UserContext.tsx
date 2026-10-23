import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types';
import { getCurrentUser, setCurrentUser as saveUser, clearCurrentUser } from '../utils/storage';
import { UserContext } from './useUser';

export function UserProvider({ children }: { children: ReactNode }) {
  // Read once from storage when the app starts.
  const [user, setUser] = useState<Usuario | null>(getCurrentUser);

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
