import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import ChatApp from './pages/ChatApp';

/* Check if user is logged in (simple session check) */
function isLoggedIn() {
  return !!sessionStorage.getItem('bridge_user_id');
}

/* Check if demo mode is active */
function isDemoMode() {
  return sessionStorage.getItem('bridge_demo_mode') === 'true';
}

/* Enable demo mode */
export function enableDemoMode() {
  sessionStorage.setItem('bridge_demo_mode', 'true');
  sessionStorage.setItem('bridge_user_id', 'demo_user');
  sessionStorage.setItem('bridge_username', 'DemoUser');
  sessionStorage.setItem('bridge_user_profile', 'general');
}

/* Protected route — checks session or demo mode */
function ProtectedRoute({ children }) {
  if (!isLoggedIn() && !isDemoMode()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatApp />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
