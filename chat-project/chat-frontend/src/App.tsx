// import { useState } from 'react'
import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import { UserProvider } from './context/UserContext';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route 
            path="/"
            element={
              <ProtectedRoute>
                <Login />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/login"
            element={
              <ProtectedRoute>
                <Login />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/register"
            element={
              <ProtectedRoute>
                <Register />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
};

export default App
