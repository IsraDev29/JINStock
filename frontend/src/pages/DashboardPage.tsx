import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { Link } from 'react-router-dom';
import { db } from '../pwa/db';
import {
  ensureLocalCatalogInitialized,
  getCachedSales,
  cacheSalesLocally,
} from '../services/syncService';
import { localDateString } from '../utils/dateNI';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState({
    todaySalesTotal: 0,
    todaySalesCount: 0,
    monthSalesTotal: 0,
    monthSalesCount: 0,
    totalProductsCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardMetrics = async () => {
    setLoading(true);

    const loadFromDexie = async () => {
      try {
        await ensureLocalCatalogInitialized();
        const prods = await db.products.toArray();
        const lowStock = prods.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo).length;
        const outOfStock = prods.filter((p) => p.stock === 0).length;

        // Ventas cacheadas del servidor (sincronizadas desde Neon)
        const cachedServerSales = await getCachedSales();
        // Ventas offline pendientes (sin subir aún al servidor)
        const offlinePending = await db.offlineSales
          .where('estado')
          .anyOf('PENDIENTE', 'SINCRONIZANDO', 'ERROR', 'REVISION')
          .toArray();

        const todayNI = localDateString();
        const currentMonthYear = todayNI.slice(0, 7); // "YYYY-MM"

        // Filtrar por hoy (Nicaragua) en ambas fuentes
        const serverToday = cachedServerSales.filter(
          (s) => s.fecha && localDateString(new Date(s.fecha)) === todayNI
        );
        const serverMonth = cachedServerSales.filter(
          (s) => s.fecha && localDateString(new Date(s.fecha)).slice(0, 7) === currentMonthYear
        );
        const pendingToday = offlinePending.filter(
          (s) => s.fecha && localDateString(new Date(s.fecha)) === todayNI
        );
        const pendingMonth = offlinePending.filter(
          (s) => s.fecha && localDateString(new Date(s.fecha)).slice(0, 7) === currentMonthYear
        );

        const todaySalesTotal =
          serverToday.reduce((a, s) => a + (s.total || 0), 0) +
          pendingToday.reduce((a, s) => a + (s.total || 0), 0);
        const monthSalesTotal =
          serverMonth.reduce((a, s) => a + (s.total || 0), 0) +
          pendingMonth.reduce((a, s) => a + (s.total || 0), 0);

        setMetrics({
          todaySalesTotal,
          todaySalesCount: serverToday.length + pendingToday.length,
          monthSalesTotal,
          monthSalesCount: serverMonth.length + pendingMonth.length,
          totalProductsCount: prods.length,
          lowStockCount: lowStock,
          outOfStockCount: outOfStock,
        });

        // Top productos calculados desde detalles de ventas reales (no datos ficticios)
        const allSalesForTop = [...cachedServerSales, ...offlinePending];
        const productSalesMap: Record<string, { nombre: string; stock: number; precioVenta: number; unidadesVendidas: number }> = {};
        for (const sale of allSalesForTop) {
          const details = (sale as any).detalles || [];
          for (const d of details) {
            const pid = d.productoId || d.producto?.id;
            const nombre = d.productoNombre || d.producto?.nombre || `Producto ${pid}`;
            if (!pid) continue;
            if (!productSalesMap[pid]) {
              const localProd = prods.find((p) => p.id === pid);
              productSalesMap[pid] = {
                nombre,
                stock: localProd?.stock ?? 0,
                precioVenta: localProd?.precioVenta ?? (d.precioUnitario || 0),
                unidadesVendidas: 0,
              };
            }
            productSalesMap[pid].unidadesVendidas += Number(d.cantidad) || 0;
          }
        }
        const computedTop = Object.entries(productSalesMap)
          .map(([productoId, v]) => ({ productoId, ...v }))
          .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)
          .slice(0, 4);
        setTopProducts(computedTop);

        // Ventas recientes: server cache primero, luego pendientes offline
        if (cachedServerSales.length > 0) {
          setRecentSales(cachedServerSales.slice(0, 5) as any);
        } else {
          setRecentSales(
            offlinePending.slice(-5).reverse().map((s) => ({
              id: s.id,
              numeroComprobante: s.numeroComprobante,
              fecha: s.fecha,
              total: s.total,
              metodoPago: s.metodoPago,
              estado: s.estado,
              usuario: { nombre: 'Cajero Local' },
            }))
          );
        }
      } catch (dexieErr) {
        console.warn('[DashboardPage] Error calculando métricas offline:', dexieErr);
      }
    };

    try {
      if (!navigator.onLine) {
        await loadFromDexie();
        setLoading(false);
        return;
      }

      const [statsRes, salesRes] = await Promise.all([
        apiFetch<any>('/sales/stats'),
        apiFetch<any[]>('/sales?limit=5'),
      ]);

      if (statsRes.success && statsRes.data) {
        setMetrics({
          todaySalesTotal: statsRes.data.todaySalesTotal || 0,
          todaySalesCount: statsRes.data.todaySalesCount || 0,
          monthSalesTotal: statsRes.data.monthSalesTotal || 0,
          monthSalesCount: statsRes.data.monthSalesCount || 0,
          totalProductsCount: statsRes.data.totalProductsCount || 0,
          lowStockCount: statsRes.data.lowStockCount || 0,
          outOfStockCount: statsRes.data.outOfStockCount || 0,
        });
        setTopProducts(statsRes.data.topSellingProducts || []);
      } else {
        await loadFromDexie();
      }

      if (salesRes.success && salesRes.data) {
        setRecentSales(salesRes.data);
        cacheSalesLocally(salesRes.data).catch(() => {});
      } else if (!statsRes.success) {
        // Ya cargado en loadFromDexie
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      await loadFromDexie();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  const formatMoney = (val: number) => {
    return 'C$ ' + val.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return 'Reciente';
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Ahora';
    if (diff < 60) return `${diff}m atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return `${Math.floor(diff / 1440)}d atrás`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
        <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Cargando métricas reales del servidor...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-24 md:pb-16 font-body">
      {/* ── ROW 1 ────────────────────────────────────────────── */}
      {/* Revenue Overview (Span 2) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400 text-lg">calendar_month</span>
              <h3 className="text-sm font-semibold text-gray-300">Ventas del Mes</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {formatMoney(metrics.monthSalesTotal)}
            </p>
            <span className="text-xs text-purple-300 font-medium">
              {metrics.monthSalesCount} transacciones en el mes actual
            </span>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>Hoy: {formatMoney(metrics.todaySalesTotal)}</span>
          </div>
        </div>

        {/* Chart Visual */}
        {metrics.monthSalesTotal > 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <svg viewBox="0 0 500 130" className="w-full h-28 overflow-visible">
              <path
                d="M0,110 C40,110 60,90 100,105 C140,120 180,60 220,80 C260,100 300,40 340,30 C380,20 420,50 460,30 C480,20 500,10 500,10"
                fill="none"
                stroke="#A788F4"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {[
                { cx: 0, cy: 110 },
                { cx: 100, cy: 105 },
                { cx: 220, cy: 80 },
                { cx: 340, cy: 30 },
                { cx: 500, cy: 10 },
              ].map((p, i) => (
                <circle key={i} cx={p.cx} cy={p.cy} r="4.5" fill="#fff" stroke="#7c3aed" strokeWidth="2.5" />
              ))}
              {[20, 60, 100].map((y, i) => (
                <line key={i} x1="0" y1={y} x2="500" y2={y} stroke="#2d2c35" strokeDasharray="4 4" strokeWidth="1" />
              ))}
            </svg>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium px-1">
              <span>Semana 1</span>
              <span>Semana 2</span>
              <span>Semana 3</span>
              <span>Semana 4</span>
              <span>Hoy</span>
            </div>
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center text-gray-500 text-xs border border-dashed border-[#2d2c35] rounded-xl">
            Aún no hay transacciones en el mes para graficar tendencia.
          </div>
        )}
      </div>

      {/* Inventory Status (Span 1) */}
      <div className="col-span-1 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400 text-lg">inventory_2</span>
            Inventario en Vivo
          </h3>
          <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-gray-400 font-bold">
            {metrics.totalProductsCount} prods
          </span>
        </div>

        <div className="flex flex-col gap-3 flex-1 justify-center">
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Catálogo Total</span>
              <span className="font-bold text-white">{metrics.totalProductsCount}</span>
            </div>
            <div className="w-full h-2 bg-[#2d2c35] rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-full" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Bajo Stock Mínimo</span>
              <span className="font-bold text-amber-400">{metrics.lowStockCount}</span>
            </div>
            <div className="w-full h-2 bg-[#2d2c35] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{
                  width:
                    metrics.totalProductsCount > 0
                      ? `${(metrics.lowStockCount / metrics.totalProductsCount) * 100}%`
                      : '0%',
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Productos Agotados</span>
              <span className="font-bold text-rose-400">{metrics.outOfStockCount}</span>
            </div>
            <div className="w-full h-2 bg-[#2d2c35] rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{
                  width:
                    metrics.totalProductsCount > 0
                      ? `${(metrics.outOfStockCount / metrics.totalProductsCount) * 100}%`
                      : '0%',
                }}
              />
            </div>
          </div>
        </div>

        <Link
          to="/compras"
          className="block text-center w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-colors mt-4"
        >
          Reabastecer con Proveedor
        </Link>
      </div>

      {/* Sync Readiness (Span 1) */}
      <div className="col-span-1 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-emerald-400 text-lg">cloud_done</span>
          Disponibilidad PWA
        </h3>

        <div className="flex-1 flex flex-col items-center justify-center my-2">
          <div className="relative w-28 h-28 rounded-full bg-emerald-500/10 border-4 border-emerald-500 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-emerald-400 text-3xl">wifi_tethering</span>
            <span className="text-xs font-bold text-emerald-300 mt-0.5">Offline-First</span>
          </div>
          <span className="text-xs text-gray-300 font-semibold mt-3">Persistencia en IndexedDB</span>
          <span className="text-[11px] text-gray-500 text-center">
            Capacidad de venta continua garantizada sin internet
          </span>
        </div>

        <div className="w-full mt-3">
          <Link
            to="/pos"
            className="block text-center w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-colors"
          >
            Abrir Punto de Venta
          </Link>
        </div>
      </div>

      {/* ── ROW 2 ────────────────────────────────────────────── */}
      {/* Recent Sales (Span 2) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400 text-lg">history</span>
            <h3 className="text-sm font-bold text-white">Últimas Ventas Emitidas</h3>
          </div>
          <Link to="/ventas" className="text-xs text-purple-400 hover:text-purple-300 font-semibold">
            Ver todas
          </Link>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
          {recentSales.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              No hay ventas registradas recientemente.
            </div>
          ) : (
            recentSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">receipt</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-white">{sale.numeroComprobante}</h5>
                    <span className="text-gray-400 text-[11px]">
                      {sale.usuario?.nombre || 'Cajero'} • {sale.metodoPago}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-white text-sm block">
                    {formatMoney(Number(sale.total))}
                  </span>
                  <span className="text-[11px] text-gray-500">{timeAgo(sale.fecha)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* M-06: Real Best Sellers (Span 2) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-lg">award_star</span>
            <h3 className="text-sm font-bold text-white">Productos Más Vendidos (Datos Reales)</h3>
          </div>
          <Link to="/reportes" className="text-xs text-purple-400 hover:text-purple-300 font-semibold">
            Ver ranking
          </Link>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              Aún no hay suficiente historial de ventas para calcular los productos más vendidos.
            </div>
          ) : (
            topProducts.map((p, idx) => (
              <div
                key={p.productoId || idx}
                className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-extrabold text-purple-400 text-sm">
                    #{idx + 1}
                  </span>
                  <div>
                    <h5 className="font-semibold text-white line-clamp-1" title={p.nombre}>
                      {p.nombre}
                    </h5>
                    <span className="text-gray-500 text-[11px]">
                      Stock actual: {p.stock} u. • Precio: C$ {Number(p.precioVenta).toFixed(2)}
                    </span>
                  </div>
                </div>

                <span className="bg-purple-500/20 text-purple-300 font-bold px-3 py-1 rounded-full text-xs">
                  {p.unidadesVendidas} vendidos
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
