import React, { createContext, useContext, useEffect, useState } from 'react';

interface UserContextType {
  username: string | null;
  setUsername: (username: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [username, setUsername] = useState<string | null>(() => {
    return localStorage.getItem('username') || null; // 初始化從 localStorage 加載
  });

  const isAuthenticated = !!username;

  const logout = () => {
    setUsername(null);
    localStorage.removeItem('username');
  };

  useEffect(() => {
    if (username) {
      localStorage.setItem('username', username);
    }
  }, [username]);

  return (
    <UserContext.Provider value={{ username, setUsername, isAuthenticated, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};


