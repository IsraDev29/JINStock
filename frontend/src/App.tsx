import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, type Rol } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MainLayout } from './components/MainLayout';

// Las pantallas administrativas y de operación se cargan bajo demanda para que
// la primera visita solo descargue autenticación y la landing pública.
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const PosPage = React.lazy(() => import('./pages/PosPage').then((m) => ({ default: m.PosPage })));
const PurchasesPage = React.lazy(() => import('./pages/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const UsersPage = React.lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const CopilotPage = React.lazy(() => import('./pages/CopilotPage').then((m) => ({ default: m.CopilotPage })));
const SalesHistoryPage = React.lazy(() => import('./pages/SalesHistoryPage').then((m) => ({ default: m.SalesHistoryPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));

const PageFallback: React.FC = () => (
  <div className="min-h-screen bg-[#100f14] flex items-center justify-center font-body text-white">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-semibold text-purple-300">Cargando módulo...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#100f14] flex items-center justify-center font-body text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-purple-300">Cargando JINStock...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// M-03: Ruta protegida con validación estricta de rol
const RoleRoute: React.FC<{ allowedRoles: Rol[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  if (!allowedRoles.includes(user.rol)) {
    // Si el rol no corresponde, redirigir al punto de entrada natural del usuario
    return <Navigate to={user.rol === 'CAJERO' ? '/pos' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#100f14] flex items-center justify-center font-body text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-purple-300">Cargando JINStock...</span>
        </div>
      </div>
    );
  }

  // M-03: Redirigir al cajero a /pos y al administrador a /dashboard
  if (user) {
    return <Navigate to={user.rol === 'CAJERO' ? '/pos' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={<PageFallback />}>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/cobro" element={<Navigate to="/checkout" replace />} />
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />

          {/* Rutas exclusivas para ADMINISTRADOR */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR']}>
                  <DashboardPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/copilot"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR']}>
                  <CopilotPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventario"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR']}>
                  <InventoryPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR']}>
                  <PurchasesPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR']}>
                  <ReportsPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR']}>
                  <UsersPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Rutas compartidas (CAJERO y ADMINISTRADOR) */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR', 'CAJERO']}>
                  <PosPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['ADMINISTRADOR', 'CAJERO']}>
                  <SalesHistoryPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
