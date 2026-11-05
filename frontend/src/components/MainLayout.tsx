import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

interface LowStockAlert {
  id: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
}

/* ─── tiny keyframe injected once ─── */
const NOTIF_STYLE = `
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.notif-panel  { animation: slideDown 0.2s ease forwards; }
.notif-overlay{ animation: fadeIn   0.15s ease forwards; }
`;

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const bellDesktopRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  /* inject animation CSS once */
  useEffect(() => {
    if (document.getElementById('notif-keyframes')) return;
    const s = document.createElement('style');
    s.id = 'notif-keyframes';
    s.textContent = NOTIF_STYLE;
    document.head.appendChild(s);
  }, []);

  /* F-05: Consultar productos con stock bajo para la campana */
  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);
      const res = await apiFetch<any[]>('/products?lowStock=true');
      if (res.success && res.data) {
        setLowStockAlerts(
          res.data.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            stock: p.stock,
            stockMinimo: p.stockMinimo,
          }))
        );
      }
    } catch {
      // silencioso en modo offline
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await fetchAlerts();
    };
    run();
    const interval = setInterval(run, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* Close notifications when clicking outside (desktop) */
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (bellDesktopRef.current && !bellDesktopRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  /* M-03: Menú dinámico por rol */
  const navItems = isAdmin
    ? [
        { label: 'Inicio',      path: '/dashboard',  icon: 'grid_view'      },
        { label: 'JIN Copilot', path: '/copilot',    icon: 'smart_toy'      },
        { label: 'Inventario',  path: '/inventario', icon: 'inventory_2'    },
        { label: 'Compras',     path: '/compras',    icon: 'local_shipping' },
        { label: 'Reportes',    path: '/reportes',   icon: 'bar_chart'      },
        { label: 'Usuarios',    path: '/usuarios',   icon: 'group'          },
      ]
    : [
        { label: 'Punto de Venta', path: '/pos',    icon: 'point_of_sale' },
        { label: 'Mis Ventas',     path: '/ventas', icon: 'receipt_long'  },
      ];

  /* M-08: Buscador global */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(
        isAdmin
          ? `/inventario?search=${encodeURIComponent(searchQuery.trim())}`
          : `/pos?search=${encodeURIComponent(searchQuery.trim())}`
      );
    }
  };

  /* ── Notification Panel (shared markup) ── */
  const NotificationPanel = () => (
    <div
      className="notif-panel absolute right-0 top-12 bg-[#18171f] border border-[#2d2c35] rounded-2xl shadow-2xl z-[60] overflow-hidden"
      style={{ width: 'min(340px, calc(100vw - 16px))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#1e1d27] to-[#18171f]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            notifications_active
          </span>
          <span className="text-sm font-bold text-white">Alertas de Inventario</span>
          {alertsLoading && (
            <span className="material-symbols-outlined text-purple-400 text-sm animate-spin">
              progress_activity
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lowStockAlerts.length > 0 && (
            <span className="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
              {lowStockAlerts.length} alerta{lowStockAlerts.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setShowNotifications(false)}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar notificaciones"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-72 overflow-y-auto px-3 py-2 space-y-1.5">
        {lowStockAlerts.length === 0 ? (
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-emerald-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <p className="text-sm font-semibold text-white">Todo en orden</p>
            <p className="text-[11px] text-gray-400">
              Ningún producto ha alcanzado<br />su nivel mínimo de existencias.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold px-1 pt-1 pb-0.5">
              Productos con stock crítico
            </p>
            {lowStockAlerts.map((prod) => (
              <div
                key={prod.id}
                className="p-2.5 rounded-xl bg-[#100f14] border border-[#2d2c35] hover:border-[#3d3c47] transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate leading-tight" title={prod.nombre}>
                    {prod.nombre}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    Mínimo: {prod.stockMinimo} u.
                  </span>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg ${
                    prod.stock === 0
                      ? 'bg-red-500/20 text-red-300 border border-red-500/20'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                  }`}
                >
                  {prod.stock === 0 ? '⚠ Agotado' : `${prod.stock} u.`}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      {isAdmin && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 mt-1">
          {lowStockAlerts.length > 0 ? (
            <Link
              to="/compras"
              onClick={() => setShowNotifications(false)}
              className="flex items-center justify-center gap-1.5 w-full py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-purple-500/30"
            >
              <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
              Generar compra de reabastecimiento
            </Link>
          ) : (
            <Link
              to="/inventario"
              onClick={() => setShowNotifications(false)}
              className="flex items-center justify-center gap-1.5 w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Ver inventario
            </Link>
          )}
        </div>
      )}
    </div>
  );

  /* ── Bell Button (shared) ── */
  const BellButton = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <button
      onClick={() => {
        setShowNotifications((v) => !v);
        setShowDropdown(false);
      }}
      aria-label="Alertas de inventario"
      title="Alertas de inventario"
      className={`relative rounded-full border flex items-center justify-center transition-all ${
        showNotifications
          ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
          : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20'
      } ${size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'}`}
    >
      <span
        className={`material-symbols-outlined ${size === 'sm' ? 'text-[18px]' : 'text-[20px]'}`}
        style={{ fontVariationSettings: lowStockAlerts.length > 0 ? "'FILL' 1" : "'FILL' 0" }}
      >
        {lowStockAlerts.length > 0 ? 'notifications_active' : 'notifications'}
      </span>
      {lowStockAlerts.length > 0 && (
        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center animate-pulse shadow-md shadow-rose-500/40">
          {lowStockAlerts.length > 9 ? '9+' : lowStockAlerts.length}
        </span>
      )}
    </button>
  );

  const themeByRoute: Record<string, string> = {
    '/dashboard': 'plum',
    '/copilot': 'lavender',
    '/inventario': 'sky',
    '/compras': 'coral',
    '/reportes': 'sun',
    '/usuarios': 'lavender',
    '/pos': 'sky',
    '/ventas': 'coral',
  };
  const backgroundTheme = themeByRoute[location.pathname] || 'plum';

  return (
    <div className={`app-shell app-theme-${backgroundTheme} text-white min-h-screen flex flex-col font-sans`}>
      {/* ── TOP HEADER ─────────────────────────────────────────── */}
      <header className="print:hidden px-3 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-2.5 sm:gap-4 border-b border-white/5 bg-[#14131a] sticky top-0 z-40 backdrop-blur-md">
        {/* Left: Logo & role chip */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={isAdmin ? '/dashboard' : '/pos'} className="flex items-center gap-2 text-decoration-none">
              <img src="/logo.png" alt="JINStock" className="h-7 sm:h-8 object-contain" />
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white">JINStock</span>
            </Link>
            <span className="text-[10px] sm:text-xs bg-white/5 border border-white/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-purple-300 font-semibold ml-1 sm:ml-2">
              {user?.rol || 'CAJERO'}
            </span>
          </div>

          {/* ── Mobile right actions ── */}
          <div className="md:hidden flex items-center gap-2">
            {/* Bell (mobile) */}
            <div className="relative">
              <BellButton size="sm" />
              {showNotifications && (
                <>
                  {/* Overlay for mobile */}
                  <div
                    className="notif-overlay fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px]"
                    onClick={() => setShowNotifications(false)}
                  />
                  <NotificationPanel />
                </>
              )}
            </div>

            {/* User (mobile) */}
            <div className="relative">
              <button
                onClick={() => { setShowDropdown(!showDropdown); setShowNotifications(false); }}
                className="w-8 h-8 rounded-full bg-purple-900 border border-purple-500/30 flex items-center justify-center text-white font-bold text-xs"
                aria-label="Perfil de usuario"
              >
                {user?.nombre?.charAt(0) || 'U'}
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-10 bg-[#1c1b22] border border-[#2d2c35] rounded-xl p-2 z-50 shadow-2xl min-w-[170px] max-w-[calc(100vw-24px)]">
                  <div className="px-3 py-1.5 border-b border-white/10 mb-1">
                    <p className="text-xs font-semibold text-white truncate">{user?.nombre}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { logout(); navigate('/auth'); }}
                    className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSearchSubmit} className="w-full md:w-auto md:flex-1 md:max-w-md mx-auto">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2 md:left-3.5 md:top-2.5 text-gray-400 text-base md:text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAdmin ? 'Buscar en inventario...' : 'Buscar producto en caja POS...'}
              className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-1.5 md:py-2 bg-[#100f14] border border-[#2d2c35] rounded-full text-white text-xs placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
            />
          </div>
        </form>

        {/* ── Desktop right actions ── */}
        <div className="hidden md:flex items-center gap-3">
          {/* Bell (desktop) */}
          <div className="relative" ref={bellDesktopRef}>
            <BellButton size="md" />
            {showNotifications && <NotificationPanel />}
          </div>

          {/* User Profile (desktop) */}
          <div className="relative">
            <button
              onClick={() => { setShowDropdown(!showDropdown); setShowNotifications(false); }}
              className="flex items-center gap-2.5 bg-white/5 border border-white/10 hover:border-purple-500/40 rounded-full py-1 px-3 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                {user?.nombre?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white leading-tight">{user?.nombre?.split(' ')[0]}</span>
                <span className="text-[10px] text-gray-400 leading-tight">{user?.rol}</span>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-12 bg-[#1c1b22] border border-[#2d2c35] rounded-xl p-2 z-50 shadow-2xl min-w-[180px]">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-xs font-bold text-white truncate">{user?.nombre}</p>
                  <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { logout(); navigate('/auth'); }}
                  className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="flex-1 px-3 sm:px-6 md:px-8 py-4 sm:py-6 pb-24 md:pb-28 print:p-0 print:pb-0 max-w-[1920px] w-full mx-auto">
        {children}
      </main>

      {/* ── BOTTOM DOCK ───────────────────────────────────────── */}
      <nav
        className="print:hidden fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 bg-[#1c1b22]/95 backdrop-blur-xl border border-white/10 rounded-full flex items-center px-2 sm:px-3.5 py-1.5 gap-1 sm:gap-1.5 z-45 shadow-[0_15px_40px_rgba(0,0,0,0.7)] max-w-[calc(100vw-16px)] sm:max-w-max overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={`flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full shrink-0 transition-all ${
                isActive
                  ? 'bg-purple-500/25 text-[#A788F4] shadow-inner'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span
                className="material-symbols-outlined text-[19px] sm:text-[22px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="w-[1px] h-5 sm:h-6 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />
            <Link
              to="/pos"
              title="Abrir Punto de Venta (POS)"
              className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full shrink-0 bg-gradient-to-br from-purple-600 to-indigo-900 text-white shadow-[0_4px_15px_rgba(124,58,237,0.4)] hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-[19px] sm:text-[22px]">
                point_of_sale
              </span>
            </Link>
          </>
        )}
      </nav>
    </div>
  );
};
