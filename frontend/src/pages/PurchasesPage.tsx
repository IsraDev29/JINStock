import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { db, type LocalPurchase } from '../pwa/db';
import {
  getLocalSuppliersFromDexie,
  getLocalCatalogFromDexie,
  cacheSuppliersLocally,
  cachePurchasesLocally,
  enqueueLocalCreate,
} from '../services/syncService';
import { nowISOStringNI } from '../utils/dateNI';

export interface SupplierItem {
  id: string;
  nombre: string;
  ruc?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  estado: boolean;
}

export interface ProductItem {
  id: string;
  nombre: string;
  sku?: string;
  imagenUrl?: string;
  stock: number;
  costo: number;
  precioVenta: number;
  unidadMedida: string;
}

export interface PurchaseCartItem {
  productoId: string;
  nombre: string;
  sku?: string;
  imagenUrl?: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export const PurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const [activeTab, setActiveTab] = useState<'NEW_PURCHASE' | 'PURCHASE_HISTORY' | 'SUPPLIERS'>('NEW_PURCHASE');

  // Data lists
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [purchasesHistory, setPurchasesHistory] = useState<any[]>([]);

  // New Purchase Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseCartItem[]>([]);

  // Selected product to add to purchase
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [addQty, setAddQty] = useState<number>(10);
  const [addCost, setAddCost] = useState<number>(0);

  // Form Submission
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [newSuppData, setNewSuppData] = useState({
    nombre: '',
    ruc: '',
    telefono: '',
    email: '',
    direccion: '',
  });

  // T-05: Anular compra modal
  const [anularModalOpen, setAnularModalOpen] = useState<boolean>(false);
  const [purchaseToAnular, setPurchaseToAnular] = useState<any | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState<string>('');
  const [anulando, setAnulando] = useState<boolean>(false);

  const fetchData = async () => {
    const loadFromDexie = async () => {
      try {
        const localSupps = await getLocalSuppliersFromDexie();
        const localCatalog = await getLocalCatalogFromDexie();
        const localPurchases = await db.purchases.toArray();

        setSuppliers(localSupps);
        if (localSupps.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(localSupps[0].id);
        }

        setProducts(localCatalog.products as ProductItem[]);
        if (localCatalog.products.length > 0 && !selectedProductId) {
          setSelectedProductId(localCatalog.products[0].id);
          setAddCost(localCatalog.products[0].costo);
        }

        setPurchasesHistory(localPurchases.reverse());
      } catch (err) {
        console.warn('[PurchasesPage] Error cargando datos offline:', err);
      }
    };

    if (!navigator.onLine) {
      await loadFromDexie();
      return;
    }

    try {
      const [suppRes, prodRes, purRes] = await Promise.all([
        apiFetch<SupplierItem[]>('/suppliers?includeInactive=true'),
        apiFetch<ProductItem[]>('/products?includeInactive=true'),
        apiFetch<any[]>('/purchases'),
      ]);

      if (suppRes.success && suppRes.data) {
        setSuppliers(suppRes.data);
        if (suppRes.data.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(suppRes.data[0].id);
        }
        cacheSuppliersLocally(suppRes.data).catch(() => {});
      } else {
        const localSupps = await getLocalSuppliersFromDexie();
        setSuppliers(localSupps);
        if (localSupps.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(localSupps[0].id);
        }
      }

      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data);
        if (prodRes.data.length > 0 && !selectedProductId) {
          setSelectedProductId(prodRes.data[0].id);
          setAddCost(prodRes.data[0].costo);
        }
      } else {
        const localCatalog = await getLocalCatalogFromDexie();
        setProducts(localCatalog.products as ProductItem[]);
        if (localCatalog.products.length > 0 && !selectedProductId) {
          setSelectedProductId(localCatalog.products[0].id);
          setAddCost(localCatalog.products[0].costo);
        }
      }

      if (purRes.success && purRes.data) {
        setPurchasesHistory(purRes.data);
        cachePurchasesLocally(purRes.data).catch(() => {});
      } else {
        const localPurchases = await db.purchases.toArray();
        setPurchasesHistory(localPurchases.reverse());
      }
    } catch {
      await loadFromDexie();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find((prod) => prod.id === prodId);
    if (p) {
      setAddCost(p.costo);
    }
  };

  const handleAddProductToPurchase = () => {
    setMessage(null);
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (addQty <= 0) {
      setMessage({ type: 'error', text: 'La cantidad a ingresar debe ser mayor a 0.' });
      return;
    }

    const subtotal = Number((addQty * addCost).toFixed(2));

    setPurchaseItems((prev) => {
      const idx = prev.findIndex((item) => item.productoId === prod.id);
      if (idx !== -1) {
        const updated = [...prev];
        const newQty = updated[idx].cantidad + addQty;
        updated[idx] = {
          ...updated[idx],
          cantidad: newQty,
          costoUnitario: addCost,
          subtotal: Number((newQty * addCost).toFixed(2)),
        };
        return updated;
      }
      return [
        ...prev,
        {
          productoId: prod.id,
          nombre: prod.nombre,
          sku: prod.sku,
          imagenUrl: prod.imagenUrl,
          cantidad: addQty,
          costoUnitario: addCost,
          subtotal,
        },
      ];
    });
  };

  const handleRemovePurchaseItem = (prodId: string) => {
    setPurchaseItems((prev) => prev.filter((item) => item.productoId !== prodId));
  };

  const grandTotal = purchaseItems.reduce((acc, item) => acc + item.subtotal, 0);

  const handleSubmitPurchase = async () => {
    setMessage(null);
    if (!selectedSupplierId) {
      setMessage({ type: 'error', text: 'Por favor seleccione un proveedor.' });
      return;
    }
    if (purchaseItems.length === 0) {
      setMessage({ type: 'error', text: 'Agregue al menos un producto a la compra.' });
      return;
    }

    setSubmitting(true);
    const payload = {
      proveedorId: selectedSupplierId,
      numeroFactura: invoiceNumber.trim() || undefined,
      detalles: purchaseItems.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
      })),
    };

    const recordLocalPurchase = async () => {
      const selectedSupp = suppliers.find((s) => s.id === selectedSupplierId);
      const newLocalPur: LocalPurchase = {
        id: `pur-local-${Date.now()}`,
        numeroFactura: invoiceNumber.trim() || `FAC-OFF-${Date.now().toString().slice(-6)}`,
        proveedorId: selectedSupplierId,
        proveedor: { nombre: selectedSupp?.nombre || 'Proveedor Local' },
        fecha: nowISOStringNI(),
        total: grandTotal,
        estado: 'COMPLETADA',
        detalles: purchaseItems.map((item) => ({
          productoId: item.productoId,
          producto: { nombre: item.nombre, sku: item.sku },
          cantidad: item.cantidad,
          costoUnitario: item.costoUnitario,
          subtotal: item.subtotal,
        })),
      };

      await db.purchases.put(newLocalPur);

      // Incrementar stock en productos de Dexie
      for (const item of purchaseItems) {
        const p = await db.products.get(item.productoId);
        if (p) {
          await db.products.update(item.productoId, {
            stock: p.stock + item.cantidad,
            costo: item.costoUnitario,
          });
        }
      }

      setMessage({ type: 'success', text: 'Compra registrada localmente y existencias aumentadas en inventario.' });
      setPurchaseItems([]);
      setInvoiceNumber('');
      fetchData();
    };

    if (!navigator.onLine) {
      await recordLocalPurchase();
      setSubmitting(false);
      return;
    }

    const res = await apiFetch('/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setMessage({ type: 'success', text: 'Compra registrada con éxito y existencias aumentadas en Kardex.' });
      setPurchaseItems([]);
      setInvoiceNumber('');
      fetchData();
    } else if (res.networkError) {
      await recordLocalPurchase();
    } else {
      setMessage({ type: 'error', text: res.message || 'Error al procesar la compra.' });
    }
    setSubmitting(false);
  };

  // M-05: Toggle de estado de proveedor
  const handleToggleSupplierStatus = async (supp: SupplierItem) => {
    if (!navigator.onLine) {
      await db.suppliers.update(supp.id, { estado: !supp.estado });
      fetchData();
      return;
    }

    const res = await apiFetch(`/suppliers/${supp.id}/status`, { method: 'PATCH' });
    if (res.success) {
      await db.suppliers.update(supp.id, { estado: !supp.estado });
      fetchData();
    } else if (res.networkError) {
      await db.suppliers.update(supp.id, { estado: !supp.estado });
      fetchData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Error al cambiar estado del proveedor.' });
    }
  };

  // Registrar nuevo proveedor
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppData.nombre.trim()) return;

    const localId = `prov-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const supplierPayload = {
      nombre: newSuppData.nombre.trim(),
      ruc: newSuppData.ruc.trim() || undefined,
      telefono: newSuppData.telefono.trim() || undefined,
      email: newSuppData.email.trim() || undefined,
      direccion: newSuppData.direccion.trim() || undefined,
    };

    if (!navigator.onLine) {
      const localSupp: SupplierItem = {
        id: localId,
        nombre: newSuppData.nombre.trim(),
        ruc: newSuppData.ruc.trim() || undefined,
        telefono: newSuppData.telefono.trim() || undefined,
        email: newSuppData.email.trim() || undefined,
        direccion: newSuppData.direccion.trim() || undefined,
        estado: true,
      };
      await enqueueLocalCreate('SUPPLIER', localSupp, supplierPayload, operationId);
      setIsSupplierModalOpen(false);
      setNewSuppData({ nombre: '', ruc: '', telefono: '', email: '', direccion: '' });
      setMessage({ type: 'success', text: 'Proveedor registrado localmente en modo offline.' });
      fetchData();
      return;
    }

    const res = await apiFetch<SupplierItem>('/suppliers', {
      method: 'POST',
      headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify(supplierPayload),
    });

    if (res.success && res.data) {
      await db.suppliers.put(res.data);
      setIsSupplierModalOpen(false);
      setNewSuppData({ nombre: '', ruc: '', telefono: '', email: '', direccion: '' });
      fetchData();
    } else if (res.networkError) {
      const localSupp: SupplierItem = {
        id: localId,
        nombre: newSuppData.nombre.trim(),
        ruc: newSuppData.ruc.trim() || undefined,
        telefono: newSuppData.telefono.trim() || undefined,
        email: newSuppData.email.trim() || undefined,
        direccion: newSuppData.direccion.trim() || undefined,
        estado: true,
      };
      await enqueueLocalCreate('SUPPLIER', localSupp, supplierPayload, operationId);
      setIsSupplierModalOpen(false);
      setNewSuppData({ nombre: '', ruc: '', telefono: '', email: '', direccion: '' });
      setMessage({ type: 'success', text: 'Servidor no disponible. Proveedor guardado localmente.' });
      fetchData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Error al registrar proveedor.' });
    }
  };

  // T-05: Anulación de compra
  const handleConfirmCancelPurchase = async () => {
    if (!purchaseToAnular || !motivoCancelacion.trim()) return;
    setAnulando(true);

    if (!navigator.onLine) {
      await db.purchases.update(purchaseToAnular.id, {
        estado: 'ANULADA',
        motivoCancelacion: motivoCancelacion.trim(),
      });
      // Deducir stock si es posible
      if (purchaseToAnular.detalles) {
        for (const item of purchaseToAnular.detalles) {
          const p = await db.products.get(item.productoId);
          if (p) {
            await db.products.update(item.productoId, {
              stock: Math.max(0, p.stock - item.cantidad),
            });
          }
        }
      }
      setMessage({ type: 'success', text: 'Compra cancelada correctamente en almacenamiento local.' });
      setAnularModalOpen(false);
      setPurchaseToAnular(null);
      setMotivoCancelacion('');
      fetchData();
      setAnulando(false);
      return;
    }

    const res = await apiFetch(`/purchases/${purchaseToAnular.id}/anular`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo: motivoCancelacion.trim() }),
    });

    if (res.success) {
      await db.purchases.update(purchaseToAnular.id, {
        estado: 'ANULADA',
        motivoCancelacion: motivoCancelacion.trim(),
      });
      setMessage({ type: 'success', text: res.message || 'Compra cancelada correctamente y stock deducido.' });
      setAnularModalOpen(false);
      setPurchaseToAnular(null);
      setMotivoCancelacion('');
      fetchData();
    } else if (res.networkError) {
      await db.purchases.update(purchaseToAnular.id, {
        estado: 'ANULADA',
        motivoCancelacion: motivoCancelacion.trim(),
      });
      setMessage({ type: 'success', text: 'Sin conexión. Compra cancelada localmente.' });
      setAnularModalOpen(false);
      setPurchaseToAnular(null);
      setMotivoCancelacion('');
      fetchData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Error al cancelar compra.' });
    }
    setAnulando(false);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-white">
        <span className="material-symbols-outlined text-4xl text-rose-400 mb-2">lock</span>
        <h2 className="text-xl font-bold">Acceso Restringido</h2>
        <p className="text-xs text-gray-400 mt-1">
          Solo los usuarios con rol de <strong>Administrador</strong> tienen acceso al módulo de compras.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl mx-auto font-body text-white pb-24 md:pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-purple-400 text-2xl sm:text-3xl">local_shipping</span>
            Gestión de Compras & Proveedores
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              Abastecimiento de mercadería escolar, actualización de costos e ingreso de facturas.
            </p>
            {!navigator.onLine && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Modo Offline
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsSupplierModalOpen(true)}
          className="self-start sm:self-auto px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Nuevo Proveedor
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/70 border-red-500/40 text-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'NEW_PURCHASE', label: 'Registrar Factura', icon: 'add_shopping_cart' },
          { id: 'PURCHASE_HISTORY', label: 'Historial de Compras', icon: 'history' },
          { id: 'SUPPLIERS', label: 'Directorio Proveedores', icon: 'contacts' },
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

      {/* TAB 1: NEW PURCHASE */}
      {activeTab === 'NEW_PURCHASE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Item Selection */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-[#1c1b22] border border-[#2d2c35] p-5 rounded-2xl flex flex-col gap-4 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="material-symbols-outlined text-purple-400">receipt</span>
                Datos del Proveedor y Factura
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Proveedor Distribuidor *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                  >
                    {suppliers
                      .filter((s) => s.estado)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} {s.ruc ? `(${s.ruc})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Nº de Factura Comercial</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ej. FAC-001923"
                    className="w-full bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Add Products to Purchase Box */}
            <div className="bg-[#1c1b22] border border-[#2d2c35] p-5 rounded-2xl flex flex-col gap-4 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="material-symbols-outlined text-purple-400">add_box</span>
                Añadir Mercadería al Lote
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-end">
                <div className="sm:col-span-6">
                  <label className="text-gray-400 font-semibold block mb-1">Seleccionar Producto</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProductChange(e.target.value)}
                    className="w-full bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} (Stock actual: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-gray-400 font-semibold block mb-1">Costo Unitario (C$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={addCost}
                    onChange={(e) => setAddCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-gray-400 font-semibold block mb-1">Cantidad a Ingresar</label>
                  <input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddProductToPurchase}
                className="self-end px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">playlist_add</span>
                Agregar a Factura
              </button>
            </div>
          </div>

          {/* Right Column: Items Summary & Confirm */}
          <div className="lg:col-span-4 bg-[#1c1b22] border border-[#2d2c35] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center justify-between pb-2 border-b border-white/10">
              <span>Detalle de Factura</span>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                {purchaseItems.length} ítems
              </span>
            </h3>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto text-xs pr-1">
              {purchaseItems.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No hay artículos en la factura aún.
                </div>
              ) : (
                purchaseItems.map((item) => (
                  <div
                    key={item.productoId}
                    className="bg-[#100f14] p-2.5 rounded-xl border border-[#2d2c35] flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-white truncate" title={item.nombre}>
                        {item.nombre}
                      </p>
                      <span className="text-[11px] text-gray-400">
                        {item.cantidad} x C$ {item.costoUnitario.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-emerald-400">C$ {item.subtotal.toFixed(2)}</span>
                      <button
                        onClick={() => handleRemovePurchaseItem(item.productoId)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-between items-center text-sm font-bold">
              <span>Total a Pagar:</span>
              <span className="text-emerald-400 text-lg">C$ {grandTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handleSubmitPurchase}
              disabled={submitting || purchaseItems.length === 0}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              {submitting ? 'Procesando Compra...' : 'Confirmar Compra y Sumar Stock'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE HISTORY */}
      {activeTab === 'PURCHASE_HISTORY' && (
        <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-[#14131a] text-gray-400 border-b border-white/5 uppercase font-bold text-[11px]">
              <tr>
                <th className="py-3 px-4">Factura</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4 text-center">Ítems</th>
                <th className="py-3 px-4 text-right">Total Facturado</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {purchasesHistory.map((p) => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">{p.numeroFactura || p.id}</td>
                  <td className="py-3 px-4 text-gray-300">{new Date(p.fecha).toLocaleDateString('es-NI', { timeZone: 'America/Managua' })}</td>
                  <td className="py-3 px-4 text-gray-300 font-semibold">{p.proveedor?.nombre}</td>
                  <td className="py-3 px-4 text-center text-gray-400">{p.detalles?.length || 0}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400 text-sm">
                    C$ {Number(p.total).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.estado === 'CONFIRMADA'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {p.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.estado !== 'CANCELADA' && (
                      <button
                        onClick={() => {
                          setPurchaseToAnular(p);
                          setAnularModalOpen(true);
                        }}
                        title="Cancelar Compra"
                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 3: DIRECTORY OF SUPPLIERS (M-05) */}
      {activeTab === 'SUPPLIERS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supp) => (
            <div
              key={supp.id}
              className="bg-[#1c1b22] border border-[#2d2c35] p-5 rounded-2xl flex flex-col justify-between gap-3 shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      supp.estado ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {supp.estado ? 'Activo' : 'Inactivo'}
                  </span>
                  {supp.ruc && <span className="text-[11px] text-gray-500 font-mono">RUC: {supp.ruc}</span>}
                </div>
                <h3 className="text-sm font-bold text-white mt-1">{supp.nombre}</h3>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  {supp.telefono && <p>📞 {supp.telefono}</p>}
                  {supp.email && <p>✉️ {supp.email}</p>}
                  {supp.direccion && <p>📍 {supp.direccion}</p>}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => handleToggleSupplierStatus(supp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    supp.estado
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {supp.estado ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Registrar Proveedor */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">person_add</span>
                Registrar Nuevo Proveedor
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Razón Social / Nombre *</label>
                <input
                  type="text"
                  required
                  value={newSuppData.nombre}
                  onChange={(e) => setNewSuppData({ ...newSuppData, nombre: e.target.value })}
                  placeholder="Ej. Distribuidora Papelera Nicaragua"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">RUC Tributario</label>
                <input
                  type="text"
                  value={newSuppData.ruc}
                  onChange={(e) => setNewSuppData({ ...newSuppData, ruc: e.target.value })}
                  placeholder="Ej. J0310000123456"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newSuppData.telefono}
                    onChange={(e) => setNewSuppData({ ...newSuppData, telefono: e.target.value })}
                    placeholder="+505 2278-0000"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newSuppData.email}
                    onChange={(e) => setNewSuppData({ ...newSuppData, email: e.target.value })}
                    placeholder="ventas@proveedor.ni"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">Dirección Física</label>
                <input
                  type="text"
                  value={newSuppData.direccion}
                  onChange={(e) => setNewSuppData({ ...newSuppData, direccion: e.target.value })}
                  placeholder="Ej. Managua, Rotonda Cristo Rey 2c al lago"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-white/10 mt-1">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-md"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: T-05 Cancelar Compra */}
      {anularModalOpen && purchaseToAnular && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-rose-400 pb-2 border-b border-white/10">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-base font-bold text-white">Cancelar Factura de Compra</h3>
            </div>

            <p className="text-xs text-gray-300">
              ¿Está seguro de cancelar la compra <strong>{purchaseToAnular.numeroFactura || purchaseToAnular.id}</strong> por{' '}
              <strong className="text-white">C$ {Number(purchaseToAnular.total).toFixed(2)}</strong>? Esta acción deducirá las unidades correspondientes del stock en Kardex.
            </p>

            <div>
              <label className="text-gray-400 font-semibold block mb-1 text-xs">
                Motivo de cancelación (obligatorio):
              </label>
              <textarea
                rows={3}
                required
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Indique la justificación (ej. factura devuelta, mercadería errónea o defectuosa)..."
                className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl p-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAnularModalOpen(false);
                  setPurchaseToAnular(null);
                }}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={anulando || !motivoCancelacion.trim()}
                onClick={handleConfirmCancelPurchase}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
              >
                {anulando ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
