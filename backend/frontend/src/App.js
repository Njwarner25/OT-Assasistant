import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import PeriodSummary from "./pages/PeriodSummary";

// Protected Route wrapper - only for Admin panel
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Dashboard is now the default - no login required */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      
      {/* Login only needed for Admin access */}
      <Route path="/login" element={<Login />} />
      <Route path="/summary" element={<PeriodSummary />} />
      
      {/* Admin panel requires authentication */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="App">
          <AppRoutes />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
