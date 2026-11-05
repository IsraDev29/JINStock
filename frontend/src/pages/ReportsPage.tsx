import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { localDateString, localDateStringDaysAgo } from '../utils/dateNI';

const CACHE_KEY = 'jinstock_reports_cache';

function saveReportCache(key: string, data: any) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[key] = { data, savedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* silencioso */ }
}

function loadReportCache(key: string): any | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return cache[key]?.data ?? null;
  } catch { return null; }
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASES' | 'TOP_PRODUCTS' | 'CASH_CLOSING'>('SALES');

  // Date filters — usa fecha local de Nicaragua (no UTC)
  const [desde, setDesde] = useState<string>(() => localDateStringDaysAgo(30));
  const [hasta, setHasta] = useState<string>(() => localDateString());

  // Daily cash closing date filter
  const [closingDate, setClosingDate] = useState<string>(() => localDateString());
  const [countedCash, setCountedCash] = useState<string>('');

  // Report data states
  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [purchasesReport, setPurchasesReport] = useState<any | null>(null);
  const [topProductsReport, setTopProductsReport] = useState<any[]>([]);
  const [cashClosingReport, setCashClosingReport] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  const fetchCurrentReport = async () => {
    setLoading(true);
    setReportError(null);
    const online = navigator.onLine;
    setIsOffline(!online);
    try {
      if (activeTab === 'SALES') {
        const cacheKey = `sales_${desde}_${hasta}`;
        if (!online) {
          const cached = loadReportCache(cacheKey);
          setSalesReport(cached);
        } else {
          const res = await apiFetch(`/reports/sales?desde=${desde}&hasta=${hasta}`);
          if (res.success) { setSalesReport(res.data); saveReportCache(cacheKey, res.data); }
          else { setSalesReport(loadReportCache(cacheKey)); setReportError(res.message || 'No se pudo cargar el reporte de ventas.'); }
        }
      } else if (activeTab === 'PURCHASES') {
        const cacheKey = `purchases_${desde}_${hasta}`;
        if (!online) {
          setPurchasesReport(loadReportCache(cacheKey));
        } else {
          const res = await apiFetch(`/reports/purchases?desde=${desde}&hasta=${hasta}`);
          if (res.success) { setPurchasesReport(res.data); saveReportCache(cacheKey, res.data); }
          else { setPurchasesReport(loadReportCache(cacheKey)); setReportError(res.message || 'No se pudo cargar el reporte de compras.'); }
        }
      } else if (activeTab === 'TOP_PRODUCTS') {
        const cacheKey = `top_${desde}_${hasta}`;
        if (!online) {
          setTopProductsReport(loadReportCache(cacheKey) || []);
        } else {
          const res = await apiFetch(`/reports/top-products?desde=${desde}&hasta=${hasta}&limit=15`);
          if (res.success) { setTopProductsReport(res.data || []); saveReportCache(cacheKey, res.data || []); }
          else { setTopProductsReport(loadReportCache(cacheKey) || []); setReportError(res.message || 'No se pudo cargar el ranking de productos.'); }
        }
      } else if (activeTab === 'CASH_CLOSING') {
        const cacheKey = `closing_${closingDate}`;
        const normalize = (data: any) => data ? ({
          ...data,
          ventasCount: Number(data.ventasCount) || 0,
          totalGeneral: Number(data.totalGeneral) || 0,
          efectivoEsperadoNIO: Number(data.efectivoEsperadoNIO) || 0,
          efectivoEsperadoUSD: Number(data.efectivoEsperadoUSD) || 0,
          totalTarjeta: Number(data.totalTarjeta) || 0,
          totalTransferencia: Number(data.totalTransferencia) || 0,
        }) : null;
        if (!online) {
          setCashClosingReport(normalize(loadReportCache(cacheKey)));
        } else {
          const res = await apiFetch(`/reports/cash-closing?fecha=${closingDate}`);
          if (res.success && res.data) {
            const report = normalize(res.data);
            setCashClosingReport(report);
            saveReportCache(cacheKey, report);
          } else {
            setCashClosingReport(normalize(loadReportCache(cacheKey)));
            setReportError(res.message || 'No se pudo cargar el cierre de caja.');
          }
        }
      }
    } catch (error) {
      console.error('[ReportsPage] Error cargando reporte:', error);
      setReportError('Ocurrió un error al generar el reporte. Intente actualizarlo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentReport();
  }, [activeTab, desde, hasta, closingDate]);

  // CSV Export utility (F-04 / F-14)
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `reporte-${activeTab.toLowerCase()}-${localDateString()}.csv`;

    if (activeTab === 'SALES' && salesReport?.ventas) {
      csvContent += 'Comprobante,Fecha,Cajero,Metodo,Total NIO\n';
      salesReport.ventas.forEach((v: any) => {
        csvContent += `"${v.numeroComprobante}","${v.fecha}","${v.usuario?.nombre || 'Cajero'}","${v.metodoPago}","${v.total}"\n`;
      });
    } else if (activeTab === 'PURCHASES' && purchasesReport?.compras) {
      csvContent += 'Factura,Fecha,Proveedor,Total NIO\n';
      purchasesReport.compras.forEach((p: any) => {
        csvContent += `"${p.numeroFactura || p.id}","${p.fecha}","${p.proveedor?.nombre}","${p.total}"\n`;
      });
    } else if (activeTab === 'TOP_PRODUCTS') {
      csvContent += 'Producto,SKU,Categoria,Unidades Vendidas,Ingreso Total NIO\n';
      topProductsReport.forEach((tp: any) => {
        csvContent += `"${tp.nombre}","${tp.sku || ''}","${tp.categoria}","${tp.cantidadVendida}","${tp.ingresoTotal}"\n`;
      });
    } else if (activeTab === 'CASH_CLOSING' && cashClosingReport) {
      csvContent += 'Concepto,Monto\n';
      csvContent += `"Total Ventas Realizadas","${cashClosingReport.ventasCount}"\n`;
      csvContent += `"Total Facturado NIO","${cashClosingReport.totalGeneral}"\n`;
      csvContent += `"Efectivo Esperado NIO","${cashClosingReport.efectivoEsperadoNIO}"\n`;
      csvContent += `"Efectivo Esperado USD","${cashClosingReport.efectivoEsperadoUSD}"\n`;
      csvContent += `"Total Tarjeta NIO","${cashClosingReport.totalTarjeta}"\n`;
      csvContent += `"Total Transferencia NIO","${cashClosingReport.totalTransferencia}"\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printCashClosing = () => {
    const printable = document.getElementById('cash-closing-printable');
    if (!printable) return;

    const printClone = printable.cloneNode(true) as HTMLElement;
    document.body.appendChild(printClone);
    document.body.classList.add('printing-cash-closing');
    window.addEventListener('afterprint', () => {
      printClone.remove();
      document.body.classList.remove('printing-cash-closing');
    }, { once: true });
    window.print();
  };

  // Cierre de caja contado vs esperado
  const counted = parseFloat(countedCash) || 0;
  const expected = cashClosingReport?.efectivoEsperadoNIO || 0;
  const diff = Number((counted - expected).toFixed(2));

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl mx-auto font-body text-white pb-24 md:pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-purple-400 text-2xl sm:text-3xl">analytics</span>
            Reportes & Cierre de Caja
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Métricas oficiales de ventas por período, abastecimiento y arqueo de caja de la Librería.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportToCSV}
            className="px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Exportar CSV
          </button>
        </div>
      </div>

      {isOffline && (
        <div className="p-3 rounded-xl border bg-amber-950/60 border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">wifi_off</span>
          <span>Modo sin conexión — mostrando el último reporte consultado. Los datos no están actualizados.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'SALES', label: 'Ventas por Fecha', icon: 'point_of_sale' },
          { id: 'PURCHASES', label: 'Compras Proveedores', icon: 'local_shipping' },
          { id: 'TOP_PRODUCTS', label: 'Más Vendidos', icon: 'trending_up' },
          { id: 'CASH_CLOSING', label: 'Cierre de Caja', icon: 'account_balance_wallet' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-[#1c1b22] text-gray-400 hover:text-white border border-[#2d2c35]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Date Filter Bar */}
      {activeTab !== 'CASH_CLOSING' ? (
        <div className="bg-[#1c1b22] border border-[#2d2c35] p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <span className="text-gray-400 font-semibold w-12 sm:w-auto">Desde:</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="flex-1 sm:flex-none bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <span className="text-gray-400 font-semibold w-12 sm:w-auto">Hasta:</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="flex-1 sm:flex-none bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      ) : (
        <div className="bg-[#1c1b22] border border-[#2d2c35] p-3 sm:p-3.5 rounded-2xl flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold">Fecha de Arqueo:</span>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* Content depending on Tab */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Generando reporte...</span>
        </div>
      ) : (
        <>
          {reportError && (
            <div role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-200 text-sm">
              {reportError}
            </div>
          )}
          {/* TAB 1: SALES REPORT */}
          {activeTab === 'SALES' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl">
                  <span className="text-xs text-gray-400 block">Total Ventas en Rango</span>
                  <span className="text-2xl font-extrabold text-white mt-1 block">
                    {salesReport?.totalVentas || 0}
                  </span>
                </div>
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl">
                  <span className="text-xs text-gray-400 block">Ingresos Facturados</span>
                  <span className="text-2xl font-extrabold text-purple-400 mt-1 block">
                    C$ {Number(salesReport?.montoTotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl">
                  <span className="text-xs text-gray-400 block">Desglose Métodos de Pago</span>
                  <div className="flex flex-col gap-1 mt-1 text-xs">
                    {salesReport?.porMetodoPago &&
                      Object.entries(salesReport.porMetodoPago).map(([metodo, total]: any) => (
                        <div key={metodo} className="flex justify-between text-gray-300">
                          <span>{metodo}:</span>
                          <span className="font-bold">C$ {Number(total).toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Sales List Table */}
              <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-[#14131a] text-gray-400 border-b border-white/5 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Comprobante</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cajero</th>
                      <th className="py-3 px-4">Método</th>
                      <th className="py-3 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {salesReport?.ventas?.map((v: any) => (
                      <tr key={v.id} className="hover:bg-white/5">
                        <td className="py-3 px-4 font-bold text-white">{v.numeroComprobante}</td>
                        <td className="py-3 px-4 text-gray-300">{new Date(v.fecha).toLocaleString()}</td>
                        <td className="py-3 px-4 text-gray-300">{v.usuario?.nombre || 'Cajero'}</td>
                        <td className="py-3 px-4 text-gray-300">{v.metodoPago}</td>
                        <td className="py-3 px-4 text-right font-bold text-purple-300">
                          C$ {Number(v.total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PURCHASES REPORT */}
          {activeTab === 'PURCHASES' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl">
                  <span className="text-xs text-gray-400 block">Total Compras Registradas</span>
                  <span className="text-2xl font-extrabold text-white mt-1 block">
                    {purchasesReport?.totalCompras || 0}
                  </span>
                </div>
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl">
                  <span className="text-xs text-gray-400 block">Inversión en Mercadería</span>
                  <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">
                    C$ {Number(purchasesReport?.montoTotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* By Supplier summary */}
              <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                  Compras por Proveedor
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {purchasesReport?.porProveedor?.map((prov: any, idx: number) => (
                    <div key={idx} className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35] text-xs">
                      <span className="font-bold text-white block truncate">{prov.proveedorNombre}</span>
                      <span className="text-gray-400 block mt-1">{prov.facturasCount} compras</span>
                      <span className="text-emerald-400 font-extrabold text-sm block mt-1">
                        C$ {Number(prov.total).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TOP PRODUCTS REPORT */}
          {activeTab === 'TOP_PRODUCTS' && (
            <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">Ranking de Productos Más Vendidos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-[#14131a] text-gray-400 border-b border-white/5 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">Categoría</th>
                      <th className="py-3 px-4 text-center">Unidades Vendidas</th>
                      <th className="py-3 px-4 text-right">Ingreso Generado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topProductsReport.map((p, idx) => (
                      <tr key={p.productoId} className="hover:bg-white/5">
                        <td className="py-3 px-4 font-bold text-purple-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">{p.nombre}</td>
                        <td className="py-3 px-4 text-gray-400">{p.categoria}</td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          <span className="bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full">
                            {p.cantidadVendida} u.
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-400">
                          C$ {Number(p.ingresoTotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CIERRE DE CAJA DIARIO (F-03) */}
          {activeTab === 'CASH_CLOSING' && cashClosingReport && (
            <div id="cash-closing-printable" className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="cash-closing-print-heading col-span-full hidden border-b border-gray-300 pb-3">
                <h1 className="text-2xl font-bold">Acta de Cierre de Caja</h1>
                <p className="text-sm mt-1">Fecha: {cashClosingReport.fecha || closingDate}</p>
              </div>
              {/* Summary Metrics */}
              <div className="md:col-span-7 flex flex-col gap-4">
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-5 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-400">point_of_sale</span>
                    Resumen de Operaciones en Caja
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
                      <span className="text-gray-400 block">Total Ventas</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        {cashClosingReport.ventasCount}
                      </span>
                    </div>
                    <div className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
                      <span className="text-gray-400 block">Total Facturado</span>
                      <span className="text-xl font-bold text-purple-400 mt-1 block">
                        C$ {cashClosingReport.totalGeneral.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
                      <span className="text-gray-400 block">Efectivo Córdobas</span>
                      <span className="text-xl font-bold text-emerald-400 mt-1 block">
                        C$ {cashClosingReport.efectivoEsperadoNIO.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
                      <span className="text-gray-400 block">Dólares Recibidos</span>
                      <span className="text-xl font-bold text-blue-400 mt-1 block">
                        ${cashClosingReport.efectivoEsperadoUSD.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
                      <span className="text-gray-400 block">Tarjetas POS</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        C$ {cashClosingReport.totalTarjeta.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
                      <span className="text-gray-400 block">Transferencias</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        C$ {cashClosingReport.totalTransferencia.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Reconciliation Card (Arqueo) */}
              <div className="md:col-span-5">
                <div className="bg-[#1c1b22] border border-[#2d2c35] p-5 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">price_check</span>
                    Arqueo de Efectivo en Caja
                  </h3>

                  <div className="flex flex-col gap-2 text-xs">
                    <label className="text-gray-400 font-semibold">Efectivo Contado en Gaveta (C$):</label>
                    <input
                      type="number"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder="Ingrese el monto físico contado..."
                      className="w-full bg-[#100f14] border border-[#2d2c35] text-white rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="bg-[#100f14] p-4 rounded-xl border border-[#2d2c35] space-y-2 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Efectivo Esperado en Sistema:</span>
                      <span className="font-bold text-white">C$ {expected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Efectivo Físico Contado:</span>
                      <span className="font-bold text-white">C$ {counted.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/5 font-bold text-sm">
                      <span>Diferencia (Sobrante / Faltante):</span>
                      <span
                        className={
                          diff === 0
                            ? 'text-emerald-400'
                            : diff > 0
                            ? 'text-blue-400'
                            : 'text-rose-400'
                        }
                      >
                        {diff === 0 ? 'Exacto (C$ 0.00)' : `C$ ${diff.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={printCashClosing}
                    className="print:hidden w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    Imprimir Acta de Cierre de Caja
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'CASH_CLOSING' && !cashClosingReport && (
            <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-purple-400">account_balance_wallet</span>
              <h3 className="text-base font-bold text-white mt-3">
                {reportError ? 'No fue posible generar el cierre' : 'No hay un cierre disponible para esta fecha'}
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                {isOffline
                  ? 'No existe un cierre guardado localmente para esta fecha. Conéctese a internet y vuelva a intentarlo.'
                  : 'Verifique la fecha o actualice el reporte. Si el problema continúa, revise la conexión con el servidor.'}
              </p>
              <button
                type="button"
                onClick={fetchCurrentReport}
                className="mt-4 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold"
              >
                Actualizar cierre
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
