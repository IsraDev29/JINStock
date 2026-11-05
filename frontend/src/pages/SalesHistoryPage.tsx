import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cacheSalesLocally, getCachedSales } from '../services/syncService';
import { db } from '../pwa/db';

export const SalesHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Anulación modal state
  const [anularModalOpen, setAnularModalOpen] = useState<boolean>(false);
  const [saleToAnular, setSaleToAnular] = useState<any | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState<string>('');
  const [anulando, setAnulando] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const fetchSales = async () => {
    setLoading(true);

    // Fallback offline: combina ventas cacheadas del servidor + ventas hechas offline
    const loadOfflineSales = async () => {
      try {
        // 1. Ventas sincronizadas del servidor (cacheadas online)
        const cachedSales = await getCachedSales();
        const serverSales = cachedSales.map((s) => ({
          id: s.id,
          numeroComprobante: s.numeroComprobante,
          fecha: s.fecha,
          total: s.total,
          estado: s.estado,
          metodoPago: s.metodoPago,
          usuario: { nombre: s.usuarioNombre || 'Sistema' },
          detalles: s.detalles.map((d) => ({
            ...d,
            producto: { nombre: d.productoNombre || `Producto ${d.productoId}` },
          })),
          _source: 'cache',
        }));

        // 2. Ventas hechas mientras estaba offline (pendientes de sync)
        const offSales = await db.offlineSales.toArray();
        const pendingSales = offSales.reverse().map((s) => ({
          id: s.id,
          numeroComprobante: s.numeroComprobante,
          fecha: s.fecha,
          total: s.total,
          estado: s.estado,
          metodoPago: s.metodoPago,
          usuario: { nombre: 'Cajero Local (Offline)' },
          detalles: s.detalles.map((d) => ({
            ...d,
            producto: { nombre: `Producto ${d.productoId}` },
          })),
          _source: 'offline',
        }));

        // Combinar: primero las offline (más recientes), luego las del servidor
        const combined = [...pendingSales, ...serverSales];
        setSales(combined);
        setTotalPages(1);
      } catch (err) {
        console.warn('[SalesHistoryPage] Error cargando ventas offline:', err);
      }
    };

    if (!navigator.onLine) {
      await loadOfflineSales();
      setLoading(false);
      return;
    }

    let query = `?page=${page}&limit=20`;
    if (desde) query += `&desde=${encodeURIComponent(desde)}`;
    if (hasta) query += `&hasta=${encodeURIComponent(hasta)}`;

    const res = await apiFetch<any[]>(`/sales${query}`);
    if (res.success && res.data) {
      setSales(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
      }
      // Cachear las ventas obtenidas para uso offline futuro
      cacheSalesLocally(res.data).catch(() => {});
    } else {
      await loadOfflineSales();
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, [page, desde, hasta]);

  // T-05: Anular venta
  const handleConfirmAnulacion = async () => {
    if (!saleToAnular || !motivoAnulacion.trim()) {
      return;
    }

    setAnulando(true);
    setActionMessage(null);

    const res = await apiFetch(`/sales/${saleToAnular.id}/anular`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo: motivoAnulacion.trim() }),
    });

    if (res.success) {
      setActionMessage({ type: 'success', text: res.message || 'Venta anulada correctamente y existencias restauradas.' });
      setAnularModalOpen(false);
      setMotivoAnulacion('');
      setSaleToAnular(null);
      fetchSales();
    } else {
      setActionMessage({ type: 'error', text: res.message || 'Error al anular la venta.' });
    }
    setAnulando(false);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl mx-auto font-body text-white pb-24 md:pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-purple-400 text-2xl sm:text-3xl">receipt_long</span>
            {isAdmin ? 'Historial General de Ventas' : 'Mis Ventas Registradas'}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {isAdmin
              ? 'Consulte y filtre las transacciones emitidas por todos los cajeros en la librería.'
              : 'Consulte las ventas emitidas durante su turno de caja.'}
          </p>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/70 border-red-500/40 text-red-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#1c1b22] border border-[#2d2c35] p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-xs flex-1 sm:flex-none">
          <span className="text-gray-400 font-semibold w-12 sm:w-auto">Desde:</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs flex-1 sm:flex-none">
          <span className="text-gray-400 font-semibold w-12 sm:w-auto">Hasta:</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500"
          />
        </div>
        {(desde || hasta) && (
          <button
            onClick={() => {
              setDesde('');
              setHasta('');
              setPage(1);
            }}
            className="text-xs text-purple-400 hover:text-purple-300 underline font-semibold self-start sm:self-center"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Cargando ventas...</span>
          </div>
        ) : sales.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <span className="material-symbols-outlined text-4xl mb-1 text-gray-600">receipt</span>
            <p className="text-xs">No se encontraron ventas para los criterios seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-[#14131a] text-gray-400 border-b border-white/5 uppercase font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Comprobante</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Cajero</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-purple-400 text-sm">confirmation_number</span>
                      {sale.numeroComprobante}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {new Date(sale.fecha).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {sale.usuario?.nombre || 'Cajero'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-white/5 px-2 py-0.5 rounded-full text-[10px] text-gray-300 font-semibold">
                        {sale.metodoPago}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-purple-300 text-sm">
                      C$ {Number(sale.total).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.estado === 'COMPLETADA'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {sale.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          title="Ver Detalle"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>

                        {/* T-05: Botón de anular venta (solo Administrador y si no está anulada) */}
                        {isAdmin && sale.estado !== 'ANULADA' && (
                          <button
                            onClick={() => {
                              setSaleToAnular(sale);
                              setAnularModalOpen(true);
                            }}
                            title="Anular Venta"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-gray-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-lg rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Detalle de Comprobante</h3>
                <span className="text-xs text-purple-400 font-bold">{selectedSale.numeroComprobante}</span>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
              <div>
                <span className="text-gray-500 block">Cajero:</span>
                <span className="font-semibold text-white">{selectedSale.usuario?.nombre || 'Cajero'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Fecha:</span>
                <span className="font-semibold text-white">{new Date(selectedSale.fecha).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Método de Pago:</span>
                <span className="font-semibold text-white">{selectedSale.metodoPago}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Estado:</span>
                <span className="font-bold text-emerald-400">{selectedSale.estado}</span>
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1.5 text-xs pr-1">
              <span className="text-gray-400 font-semibold block mb-1">Artículos facturados:</span>
              {selectedSale.detalles?.map((det: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-[#100f14] p-2.5 rounded-lg border border-[#2d2c35] flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{det.producto?.nombre || 'Producto'}</p>
                    <span className="text-gray-400 text-[11px]">
                      {det.cantidad} x C$ {Number(det.precioUnitario).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-bold text-white">C$ {Number(det.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between items-center text-sm font-bold">
              <span>Total Facturado:</span>
              <span className="text-lg text-purple-400">C$ {Number(selectedSale.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Anular Modal (T-05) */}
      {anularModalOpen && saleToAnular && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-rose-400 pb-2 border-b border-white/10">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-base font-bold text-white">Anulación de Venta</h3>
            </div>

            <p className="text-xs text-gray-300">
              ¿Está seguro de anular el comprobante <strong>{saleToAnular.numeroComprobante}</strong> por{' '}
              <strong className="text-white">C$ {Number(saleToAnular.total).toFixed(2)}</strong>? Esta acción revertirá las existencias en inventario registrando un movimiento Kardex de retorno.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">
                Motivo de anulación (obligatorio):
              </label>
              <textarea
                rows={3}
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Indique la justificación (ej. error en caja, devolución de cliente, cobro duplicado)..."
                className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl p-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAnularModalOpen(false);
                  setSaleToAnular(null);
                }}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={anulando || !motivoAnulacion.trim()}
                onClick={handleConfirmAnulacion}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
              >
                {anulando ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
