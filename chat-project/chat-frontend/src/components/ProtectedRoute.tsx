import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useUser();
  const location = useLocation();

  if (isAuthenticated && (location.pathname === '/' || location.pathname === '/register' || location.pathname === '/login')) {
    return <Navigate to="/chat" replace />;
  }

  if (!isAuthenticated && location.pathname === '/chat') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
