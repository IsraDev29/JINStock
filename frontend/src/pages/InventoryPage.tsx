import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { db } from '../pwa/db';
import { getLocalCatalogFromDexie, cacheCatalogLocally, enqueueLocalCreate } from '../services/syncService';

export interface ProductItem {
  id: string;
  codigoBarras?: string | null;
  sku?: string | null;
  nombre: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  categoriaId: string;
  categoriaNombre?: string;
  precioVenta: number;
  costo: number;
  stock: number;
  stockMinimo: number;
  unidadMedida: string;
  estado: boolean;
}

export interface CategoryItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
  estado: boolean;
  _count?: { productos: number };
}

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  // Product Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    nombre: '',
    codigoBarras: '',
    sku: '',
    descripcion: '',
    imagenUrl: '',
    categoriaId: '',
    precioVenta: '',
    costo: '',
    stock: '',
    stockMinimo: '5',
    unidadMedida: 'Unidad',
  });

  // T-06: Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [adjustProduct, setAdjustProduct] = useState<ProductItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustMotivo, setAdjustMotivo] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState<boolean>(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // M-05: Category Management Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCatNombre, setNewCatNombre] = useState<string>('');
  const [newCatDesc, setNewCatDesc] = useState<string>('');
  const [catError, setCatError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      if (!navigator.onLine) {
        const local = await getLocalCatalogFromDexie();
        setCategories(local.categories as CategoryItem[]);
        if (!formData.categoriaId && local.categories.length > 0) {
          setFormData((prev) => ({ ...prev, categoriaId: local.categories[0].id }));
        }
        return;
      }

      const res = await apiFetch<CategoryItem[]>('/categories?includeInactive=true');
      if (res.success && res.data) {
        setCategories(res.data);
        if (!formData.categoriaId && res.data.length > 0) {
          setFormData((prev) => ({ ...prev, categoriaId: res.data![0].id }));
        }
        db.categories.bulkPut(res.data as any).catch(() => {});
      } else {
        const local = await getLocalCatalogFromDexie();
        setCategories(local.categories as CategoryItem[]);
        if (!formData.categoriaId && local.categories.length > 0) {
          setFormData((prev) => ({ ...prev, categoriaId: local.categories[0].id }));
        }
      }
    } catch {
      const local = await getLocalCatalogFromDexie();
      setCategories(local.categories as CategoryItem[]);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        const local = await getLocalCatalogFromDexie(searchTerm, selectedCategory);
        let filtered = local.products as ProductItem[];
        if (statusFilter === 'low') {
          filtered = filtered.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo);
        } else if (statusFilter === 'out') {
          filtered = filtered.filter((p) => p.stock === 0);
        }
        setProducts(filtered);
        setLoading(false);
        return;
      }

      let query = '?includeInactive=true';
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (selectedCategory && selectedCategory !== 'all') query += `&categoriaId=${encodeURIComponent(selectedCategory)}`;
      if (statusFilter === 'low') query += `&lowStock=true`;

      const res = await apiFetch<ProductItem[]>(`/products${query}`);
      if (res.success && res.data) {
        let filtered = res.data;
        if (statusFilter === 'out') {
          filtered = filtered.filter((p) => p.stock === 0);
        }
        setProducts(filtered);
        cacheCatalogLocally(res.data as any, categories as any).catch(() => {});
      } else {
        const local = await getLocalCatalogFromDexie(searchTerm, selectedCategory);
        let filtered = local.products as ProductItem[];
        if (statusFilter === 'low') {
          filtered = filtered.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo);
        } else if (statusFilter === 'out') {
          filtered = filtered.filter((p) => p.stock === 0);
        }
        setProducts(filtered);
      }
    } catch (err) {
      console.warn('[InventoryPage] Error cargando catálogo:', err);
      const local = await getLocalCatalogFromDexie(searchTerm, selectedCategory);
      setProducts(local.products as ProductItem[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts();
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm, selectedCategory, statusFilter]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormError(null);
    setFormData({
      nombre: '',
      codigoBarras: '',
      sku: '',
      descripcion: '',
      imagenUrl: '',
      categoriaId: categories[0]?.id || '',
      precioVenta: '',
      costo: '',
      stock: '',
      stockMinimo: '5',
      unidadMedida: 'Unidad',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setFormError(null);
    setFormData({
      nombre: p.nombre,
      codigoBarras: p.codigoBarras || '',
      sku: p.sku || '',
      descripcion: p.descripcion || '',
      imagenUrl: p.imagenUrl || '',
      categoriaId: p.categoriaId,
      precioVenta: String(p.precioVenta),
      costo: String(p.costo),
      stock: String(p.stock),
      stockMinimo: String(p.stockMinimo),
      unidadMedida: p.unidadMedida || 'Unidad',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const payload = {
      nombre: formData.nombre.trim(),
      codigoBarras: formData.codigoBarras ? formData.codigoBarras.trim() : null,
      sku: formData.sku ? formData.sku.trim() : null,
      descripcion: formData.descripcion ? formData.descripcion.trim() : null,
      imagenUrl: formData.imagenUrl ? formData.imagenUrl.trim() : null,
      categoriaId: formData.categoriaId,
      precioVenta: parseFloat(formData.precioVenta),
      costo: parseFloat(formData.costo),
      stock: editingProduct ? undefined : parseInt(formData.stock, 10) || 0,
      stockMinimo: parseInt(formData.stockMinimo, 10) || 5,
      unidadMedida: formData.unidadMedida,
    };

    const endpoint = editingProduct ? `/products/${editingProduct.id}` : '/products';
    const method = editingProduct ? 'PUT' : 'POST';
    const localId = editingProduct?.id || `prod-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operationId = !editingProduct && typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (!navigator.onLine) {
      const catObj = categories.find((c) => c.id === formData.categoriaId);
      const localProd: ProductItem = {
        id: localId,
        ...payload,
        stock: editingProduct ? editingProduct.stock : (payload.stock || 0),
        estado: editingProduct ? editingProduct.estado : true,
        categoriaNombre: catObj?.nombre || 'General',
      };
      if (editingProduct) await db.products.put(localProd as any);
      else await enqueueLocalCreate('PRODUCT', localProd, payload, operationId);
      setIsModalOpen(false);
      setActionMessage({ type: 'success', text: `Producto ${editingProduct ? 'actualizado' : 'creado'} localmente (modo offline).` });
      fetchProducts();
      setFormLoading(false);
      return;
    }

    const res = await apiFetch(endpoint, {
      method,
      ...(!editingProduct ? { headers: { 'Idempotency-Key': operationId } } : {}),
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setIsModalOpen(false);
      setActionMessage({ type: 'success', text: `Producto ${editingProduct ? 'actualizado' : 'creado'} exitosamente.` });
      fetchProducts();
    } else if (res.networkError) {
      const catObj = categories.find((c) => c.id === formData.categoriaId);
      const localProd: ProductItem = {
        id: localId,
        ...payload,
        stock: editingProduct ? editingProduct.stock : (payload.stock || 0),
        estado: editingProduct ? editingProduct.estado : true,
        categoriaNombre: catObj?.nombre || 'General',
      };
      if (editingProduct) await db.products.put(localProd as any);
      else await enqueueLocalCreate('PRODUCT', localProd, payload, operationId);
      setIsModalOpen(false);
      setActionMessage({ type: 'success', text: `Sin conexión al servidor. Producto ${editingProduct ? 'actualizado' : 'creado'} en memoria local.` });
      fetchProducts();
    } else {
      setFormError(res.message || 'Error al guardar producto.');
    }
    setFormLoading(false);
  };

  const handleToggleProductStatus = async (p: ProductItem) => {
    if (!navigator.onLine) {
      const updated = { ...p, estado: !p.estado };
      await db.products.put(updated as any);
      setActionMessage({ type: 'success', text: `Estado cambiado a ${!p.estado ? 'Activo' : 'Inactivo'} (local).` });
      fetchProducts();
      return;
    }

    const res = await apiFetch(`/products/${p.id}/status`, { method: 'PATCH' });
    if (res.success) {
      fetchProducts();
    } else if (res.networkError) {
      const updated = { ...p, estado: !p.estado };
      await db.products.put(updated as any);
      fetchProducts();
    } else {
      setActionMessage({ type: 'error', text: res.message || 'Error al cambiar estado.' });
    }
  };

  const handleDeleteProduct = async (p: ProductItem) => {
    const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar el producto "${p.nombre}"?`);
    if (!confirmed) return;

    if (!navigator.onLine) {
      await db.products.delete(p.id);
      setActionMessage({ type: 'success', text: 'Producto eliminado del catálogo local.' });
      fetchProducts();
      return;
    }

    const res = await apiFetch(`/products/${p.id}`, { method: 'DELETE' });
    if (res.success) {
      await db.products.delete(p.id);
      setActionMessage({ type: 'success', text: res.message || 'Producto eliminado correctamente.' });
      fetchProducts();
    } else if (res.networkError) {
      await db.products.delete(p.id);
      setActionMessage({ type: 'success', text: 'Sin conexión al servidor. Producto eliminado de la base local.' });
      fetchProducts();
    } else {
      setActionMessage({ type: 'error', text: res.message || 'Error al eliminar producto.' });
      fetchProducts();
    }
  };

  // T-06: Ajuste manual de existencias Kardex
  const handleOpenAdjustModal = (p: ProductItem) => {
    setAdjustProduct(p);
    setAdjustQty('');
    setAdjustMotivo('');
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || !adjustQty || !adjustMotivo.trim()) return;

    const qtyNumber = parseInt(adjustQty, 10);
    if (isNaN(qtyNumber)) return;

    setAdjustLoading(true);
    setAdjustError(null);

    if (!navigator.onLine) {
      const newStock = Math.max(0, adjustProduct.stock + qtyNumber);
      await db.products.update(adjustProduct.id, { stock: newStock });
      setIsAdjustModalOpen(false);
      setActionMessage({ type: 'success', text: `Ajuste de inventario aplicado localmente (Nuevo stock: ${newStock}).` });
      fetchProducts();
      setAdjustLoading(false);
      return;
    }

    const res = await apiFetch('/products/adjust', {
      method: 'POST',
      body: JSON.stringify({
        productoId: adjustProduct.id,
        cantidad: qtyNumber,
        motivo: adjustMotivo.trim(),
      }),
    });

    if (res.success) {
      setIsAdjustModalOpen(false);
      setActionMessage({ type: 'success', text: res.message || 'Ajuste de inventario aplicado correctamente.' });
      fetchProducts();
    } else if (res.networkError) {
      const newStock = Math.max(0, adjustProduct.stock + qtyNumber);
      await db.products.update(adjustProduct.id, { stock: newStock });
      setIsAdjustModalOpen(false);
      setActionMessage({ type: 'success', text: `Ajuste guardado localmente (Nuevo stock: ${newStock}).` });
      fetchProducts();
    } else {
      setAdjustError(res.message || 'Error al registrar el ajuste de existencias.');
    }
    setAdjustLoading(false);
  };

  // M-05: Crear y Toggle Categoría
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNombre.trim()) return;
    setCatError(null);
    const localId = `cat-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const categoryPayload = { nombre: newCatNombre.trim(), descripcion: newCatDesc.trim() || undefined };

    if (!navigator.onLine) {
      const newCat: CategoryItem = {
        id: localId,
        nombre: newCatNombre.trim(),
        descripcion: newCatDesc.trim() || null,
        estado: true,
      };
      await enqueueLocalCreate('CATEGORY', newCat, categoryPayload, operationId);
      setNewCatNombre('');
      setNewCatDesc('');
      fetchCategories();
      return;
    }

    const res = await apiFetch<CategoryItem>('/categories', {
      method: 'POST',
      headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify(categoryPayload),
    });

    if (res.success && res.data) {
      await db.categories.put(res.data as any);
      setNewCatNombre('');
      setNewCatDesc('');
      fetchCategories();
    } else if (res.networkError) {
      const newCat: CategoryItem = {
        id: localId,
        nombre: newCatNombre.trim(),
        descripcion: newCatDesc.trim() || null,
        estado: true,
      };
      await enqueueLocalCreate('CATEGORY', newCat, categoryPayload, operationId);
      setNewCatNombre('');
      setNewCatDesc('');
      fetchCategories();
    } else {
      setCatError(res.message || 'Error al crear categoría.');
    }
  };

  const handleToggleCategoryStatus = async (cat: CategoryItem, force = false) => {
    setCatError(null);
    const query = force ? '?force=true' : '';
    const res = await apiFetch(`/categories/${cat.id}/status${query}`, { method: 'PATCH' });
    if (res.success) {
      fetchCategories();
    } else {
      setCatError(res.message || 'Error al cambiar estado de categoría.');
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl mx-auto font-body text-white pb-24 md:pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-purple-400 text-2xl sm:text-3xl">inventory_2</span>
            Control de Inventario & Kardex
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              Catálogo de papelería, existencias, precios, categorías y ajustes de inventario de la Librería.
            </p>
            {!navigator.onLine && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Modo Offline
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex-1 sm:flex-none px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-base">category</span>
              Categorías
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-purple-900/30"
            >
              <span className="material-symbols-outlined text-base">add_box</span>
              Nuevo Producto
            </button>
          </div>
        )}
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

      {/* Filter and Search Bar */}
      <div className="bg-[#1c1b22] border border-[#2d2c35] p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 shadow-md">
        <div className="flex-1 min-w-[220px] relative">
          <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-gray-400 text-lg">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, SKU o código de barras..."
            className="w-full pl-10 pr-4 py-2 bg-[#100f14] border border-[#2d2c35] rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 sm:flex-none bg-[#100f14] border border-[#2d2c35] text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {!c.estado ? '(Inactiva)' : ''}
              </option>
            ))}
          </select>

          {/* Status buttons */}
          <div className="flex rounded-xl bg-[#100f14] p-1 border border-[#2d2c35] text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'all' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'low' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Bajo
            </button>
            <button
              onClick={() => setStatusFilter('out')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'out' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Agotados
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Cargando catálogo...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center text-gray-500 text-xs">
            No se encontraron productos para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-[#14131a] text-gray-400 border-b border-white/5 uppercase font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-center">Existencias</th>
                  <th className="py-3 px-4 text-right">Costo</th>
                  <th className="py-3 px-4 text-right">Precio Venta</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((p) => {
                  const isOut = p.stock === 0;
                  const isLow = p.stock > 0 && p.stock <= p.stockMinimo;

                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-black/40 overflow-hidden flex items-center justify-center shrink-0 border border-white/5">
                            {p.imagenUrl ? (
                              <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-gray-500 text-lg">inventory_2</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-white line-clamp-1" title={p.nombre}>
                              {p.nombre}
                            </p>
                            <span className="text-[11px] text-gray-500">
                              {p.sku ? `SKU: ${p.sku}` : ''} {p.codigoBarras ? `• Barcode: ${p.codigoBarras}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300 font-medium">
                        {p.categoriaNombre || 'General'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-300'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {p.stock} {p.unidadMedida}
                        </span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">Mín: {p.stockMinimo}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-gray-400">
                        C$ {p.costo.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-purple-300 text-sm">
                        C$ {p.precioVenta.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.estado ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {p.estado ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isAdmin && (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* T-06: Ajuste de existencias */}
                            <button
                              onClick={() => handleOpenAdjustModal(p)}
                              title="Ajustar Stock Manualmente"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">tune</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              title="Editar Producto"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button
                              onClick={() => handleToggleProductStatus(p)}
                              title={p.estado ? 'Desactivar' : 'Activar'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                p.estado
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {p.estado ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              title="Eliminar Producto"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Crear / Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-xl rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">
                  {editingProduct ? 'edit' : 'add_box'}
                </span>
                {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Cuaderno Universitario 200 Págs Rayado"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Código de Barras (EAN-13)</label>
                  <input
                    type="text"
                    value={formData.codigoBarras}
                    onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                    placeholder="Ej. 7411002230012"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">SKU Interno</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Ej. CUAD-LID-200R"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Categoría *</label>
                  <select
                    required
                    value={formData.categoriaId}
                    onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="" disabled>Seleccione categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Unidad de Medida</label>
                  <input
                    type="text"
                    value={formData.unidadMedida}
                    onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                    placeholder="Unidad, Caja, Resma, Docena..."
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Costo (C$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.costo}
                    onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Precio Venta (C$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.precioVenta}
                    onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    disabled={!!editingProduct}
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-semibold block mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    required
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                    placeholder="5"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">URL de Imagen</label>
                <input
                  type="url"
                  value={formData.imagenUrl}
                  onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-white/10 mt-2">
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleDeleteProduct(editingProduct);
                    }}
                    className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md transition-colors"
                >
                  {formLoading ? 'Guardando...' : 'Confirmar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: T-06 Ajuste de Inventario Manual (Kardex AJUSTE) */}
      {isAdjustModalOpen && adjustProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="material-symbols-outlined text-amber-400 text-2xl">tune</span>
              <div>
                <h3 className="text-base font-bold text-white">Ajuste Manual de Inventario (Kardex)</h3>
                <span className="text-xs text-gray-400">{adjustProduct.nombre}</span>
              </div>
            </div>

            {adjustError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleConfirmAdjust} className="flex flex-col gap-3 text-xs">
              <div className="bg-[#100f14] p-3 rounded-xl border border-white/5 flex justify-between items-center">
                <span className="text-gray-400">Existencias Actuales:</span>
                <span className="font-bold text-white text-sm">{adjustProduct.stock} unidades</span>
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">
                  Cantidad a Ajustar * (+ para añadir, - para reducir)
                </label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="Ej. +10 o -3"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-purple-500"
                />
                <span className="text-[11px] text-gray-500 block mt-1">
                  Nuevo stock resultante: {adjustProduct.stock + (parseInt(adjustQty, 10) || 0)} u.
                </span>
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">
                  Motivo Justificado del Ajuste (Obligatorio) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={adjustMotivo}
                  onChange={(e) => setAdjustMotivo(e.target.value)}
                  placeholder="Ej. Conteo físico de fin de mes, producto dañado por humedad, merma..."
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl p-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-white/10 mt-1">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading || !adjustQty || !adjustMotivo.trim()}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {adjustLoading ? 'Aplicando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: M-05 Gestión de Categorías */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-lg rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">category</span>
                Gestión de Categorías
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {catError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
                {catError}
              </div>
            )}

            {/* Crear Categoría */}
            <form onSubmit={handleCreateCategory} className="flex flex-col gap-2.5 text-xs bg-[#100f14] p-3 rounded-xl border border-[#2d2c35]">
              <span className="font-bold text-white">Nueva Categoría</span>
              <input
                type="text"
                required
                value={newCatNombre}
                onChange={(e) => setNewCatNombre(e.target.value)}
                placeholder="Nombre de categoría..."
                className="w-full bg-[#1c1b22] border border-[#2d2c35] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Descripción opcional..."
                className="w-full bg-[#1c1b22] border border-[#2d2c35] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors self-end px-4"
              >
                Agregar Categoría
              </button>
            </form>

            {/* Lista y Toggle de Estado (M-05) */}
            <div className="space-y-2 text-xs">
              <span className="text-gray-400 font-semibold block">Categorías Registradas:</span>
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#100f14] p-3 rounded-xl border border-[#2d2c35] flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white block">{c.nombre}</span>
                    <span className="text-[11px] text-gray-400">{c.descripcion || 'Sin descripción'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        c.estado ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {c.estado ? 'Activa' : 'Inactiva'}
                    </span>
                    <button
                      onClick={() => handleToggleCategoryStatus(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        c.estado
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {c.estado ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
