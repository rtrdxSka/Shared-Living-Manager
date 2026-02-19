import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ProtectedRoute, GuestRoute } from '@/components/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';

import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import GetStartedPage from '@/pages/GetStartedPage';
import DashboardPage from '@/pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider defaultTheme="system">
          <Navbar />
          <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />

          {/* Guest only — redirects to app if already logged in */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Protected — requires authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/get-started" element={<GetStartedPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}