import {
  db,
  type LocalCategory,
  DUMMY_PRODUCT_IDS,
  DUMMY_CATEGORY_IDS,
  DUMMY_SUPPLIER_IDS,
  type LocalProduct,
  type LocalSupplier,
  type LocalSale,
  type LocalUser,
  type LocalSyncOperation,
  type SyncEntity,
} from '../pwa/db';
import { apiFetch } from './api';

type SyncListener = () => void;
const listeners = new Set<SyncListener>();

export const onSyncChange = (callback: SyncListener) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const notifyListeners = () => {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Error en listener de sincronización:', e);
    }
  });
};

let isSyncing = false;
let isSyncingCreates = false;

const newOperationId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/** Guarda la entidad visible y su operación en la outbox en una sola transacción. */
export async function enqueueLocalCreate(
  entity: SyncEntity,
  record: LocalCategory | LocalProduct | LocalSupplier,
  payload: Record<string, unknown>,
  operationId = newOperationId(),
): Promise<string> {
  const now = new Date().toISOString();
  const operation: LocalSyncOperation = {
    operationId,
    entity,
    action: 'CREATE',
    localId: record.id,
    payload,
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  if (entity === 'CATEGORY') {
    await db.transaction('rw', db.categories, db.syncQueue, async () => {
      await db.categories.put(record as LocalCategory);
      await db.syncQueue.put(operation);
    });
  } else if (entity === 'PRODUCT') {
    await db.transaction('rw', db.products, db.syncQueue, async () => {
      await db.products.put(record as LocalProduct);
      await db.syncQueue.put(operation);
    });
  } else {
    await db.transaction('rw', db.suppliers, db.syncQueue, async () => {
      await db.suppliers.put(record as LocalSupplier);
      await db.syncQueue.put(operation);
    });
  }
  notifyListeners();
  return operation.operationId;
}

const retryDelayMs = (attempt: number): number => Math.min(15 * 60_000, 2_000 * (2 ** Math.min(attempt, 9)));

async function replaceLocalProductReferences(localId: string, serverId: string, serverProduct: any): Promise<void> {
  await db.transaction('rw', db.products, db.offlineSales, db.purchases, async () => {
    const localProduct = await db.products.get(localId);
    if (localProduct) {
      await db.products.delete(localId);
      await db.products.put({ ...localProduct, ...serverProduct, id: serverId } as LocalProduct);
    }
    await db.offlineSales.toCollection().modify((sale) => {
      sale.detalles = sale.detalles.map((detail) => detail.productoId === localId
        ? { ...detail, productoId: serverId }
        : detail);
    });
    await db.purchases.toCollection().modify((purchase) => {
      purchase.detalles = (purchase.detalles || []).map((detail) => detail.productoId === localId
        ? { ...detail, productoId: serverId }
        : detail);
    });
  });
}

async function replaceLocalSupplierReferences(localId: string, serverId: string): Promise<void> {
  await db.transaction('rw', db.suppliers, db.purchases, async () => {
    await db.suppliers.delete(localId);
    await db.purchases.toCollection().modify((purchase) => {
      if (purchase.proveedorId === localId) purchase.proveedorId = serverId;
    });
  });
}

async function replaceLocalCategoryReferences(localId: string, serverId: string): Promise<void> {
  await db.transaction('rw', db.categories, db.products, db.syncQueue, async () => {
    const category = await db.categories.get(localId);
    if (category) {
      await db.categories.delete(localId);
      await db.categories.put({ ...category, id: serverId });
    }
    await db.products.where('categoriaId').equals(localId).modify({ categoriaId: serverId });
    const dependentOps = await db.syncQueue.where('entity').equals('PRODUCT').toArray();
    for (const op of dependentOps) {
      if (op.payload.categoriaId === localId) {
        await db.syncQueue.update(op.operationId, {
          payload: { ...op.payload, categoriaId: serverId },
          status: 'PENDING',
          nextAttemptAt: new Date().toISOString(),
          lastError: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });
}

/** Reintenta la outbox en orden seguro; 4xx permanecen visibles como ERROR y no se descartan. */
export async function syncPendingCreates(): Promise<{ processed: number; synced: number; errors: number }> {
  if (isSyncingCreates || typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, synced: 0, errors: 0 };
  }
  isSyncingCreates = true;
  let processed = 0;
  let synced = 0;
  let errors = 0;
  try {
    const queue = await db.syncQueue.orderBy('createdAt').toArray();
    // Recuperar operaciones interrumpidas por cierre de pestaña o apagado.
    for (const stale of queue.filter((op) => op.status === 'SYNCING')) {
      await db.syncQueue.update(stale.operationId, { status: 'PENDING', updatedAt: new Date().toISOString() });
    }
    // Categorías primero por ser prerequisito de productos.
    const priority = { CATEGORY: 0, SUPPLIER: 1, PRODUCT: 2 };
    queue.sort((a, b) => priority[a.entity] - priority[b.entity] || a.createdAt.localeCompare(b.createdAt));
    for (const queuedOp of queue) {
      const op = await db.syncQueue.get(queuedOp.operationId);
      if (!op) continue;
      if (op.status !== 'PENDING' && op.status !== 'SYNCING') continue;
      if (Date.parse(op.nextAttemptAt) > Date.now()) continue;
      const payload = op.payload as Record<string, any>;
      if (op.entity === 'PRODUCT' && String(payload.categoriaId || '').startsWith('cat-local-')) {
        await db.syncQueue.update(op.operationId, {
          status: 'ERROR',
          lastError: 'La categoría local aún no existe en el servidor; sincronice primero la categoría.',
          updatedAt: new Date().toISOString(),
        });
        errors++;
        continue;
      }
      processed++;
      await db.syncQueue.update(op.operationId, { status: 'SYNCING', updatedAt: new Date().toISOString() });
      const endpoint = op.entity === 'CATEGORY' ? '/categories' : op.entity === 'PRODUCT' ? '/products' : '/suppliers';
      const res = await apiFetch<any>(endpoint, {
        method: 'POST',
        headers: { 'Idempotency-Key': op.operationId },
        body: JSON.stringify(payload),
      });
      if (res.success && res.data?.id) {
        if (op.entity === 'CATEGORY') {
          await replaceLocalCategoryReferences(op.localId, String(res.data.id));
        } else if (op.entity === 'PRODUCT') {
          await replaceLocalProductReferences(op.localId, String(res.data.id), res.data);
        } else if (op.entity === 'SUPPLIER') {
          await replaceLocalSupplierReferences(op.localId, String(res.data.id));
          await db.suppliers.put({ ...payload, ...res.data, id: String(res.data.id) } as LocalSupplier);
        }
        await db.syncQueue.delete(op.operationId);
        synced++;
      } else if (res.networkError || (res.status || 0) >= 500) {
        const attempts = op.attempts + 1;
        await db.syncQueue.update(op.operationId, {
          status: 'PENDING',
          attempts,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)).toISOString(),
          lastError: res.message || 'No se pudo contactar al servidor.',
          updatedAt: new Date().toISOString(),
        });
        errors++;
      } else {
        await db.syncQueue.update(op.operationId, {
          status: 'ERROR',
          attempts: op.attempts + 1,
          lastError: res.message || 'El servidor rechazó la operación.',
          updatedAt: new Date().toISOString(),
        });
        errors++;
      }
    }
  } catch (err) {
    console.error('[SyncService] Error procesando altas offline:', err);
  } finally {
    isSyncingCreates = false;
    notifyListeners();
  }
  return { processed, synced, errors };
}

export async function retryFailedCreates(): Promise<void> {
  const now = new Date().toISOString();
  await db.syncQueue.toCollection().modify((operation) => {
    if (operation.status !== 'SYNCING') {
      operation.status = 'PENDING';
      operation.nextAttemptAt = now;
      operation.lastError = null;
      operation.updatedAt = now;
    }
  });
  notifyListeners();
}

/**
 * C-01 & F-01: Procesa las ventas offline en cola (PENDIENTE o ERROR)
 */
export async function syncPendingSales(): Promise<{ processed: number; successCount: number; errorsCount: number }> {
  if (isSyncing) {
    return { processed: 0, successCount: 0, errorsCount: 0 };
  }

  isSyncing = true;
  notifyListeners();

  let processed = 0;
  let successCount = 0;
  let errorsCount = 0;

  try {
    const pendingSales = await db.offlineSales
      .where('estado')
      .anyOf('PENDIENTE', 'ERROR')
      .toArray();

    for (const sale of pendingSales) {
      if (sale.detalles.some((detail) => detail.productoId.startsWith('prod-local-'))) {
        // No marcar ERROR: el procesador de altas sustituirá esos IDs y luego se reintentará.
        continue;
      }
      processed++;
      await db.offlineSales.update(sale.id!, {
        estado: 'SINCRONIZANDO',
        updatedAt: new Date().toISOString(),
      });
      notifyListeners();

      const payload = {
        detalles: sale.detalles,
        metodoPago: sale.metodoPago,
        montoPagadoNIO: sale.montoPagadoNIO,
        montoPagadoUSD: sale.montoPagadoUSD,
        cambioNIO: sale.cambioNIO,
        offlineId: sale.offlineId,
        fecha: sale.fecha,
      };

      const res = await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        await db.offlineSales.update(sale.id!, {
          estado: 'SINCRONIZADO',
          synced: 1,
          numeroComprobante: res.data?.numeroComprobante || sale.numeroComprobante,
          error: null,
          updatedAt: new Date().toISOString(),
        });
        successCount++;
      } else if (res.networkError || (res.status && res.status >= 500)) {
        await db.offlineSales.update(sale.id!, {
          estado: 'PENDIENTE',
          updatedAt: new Date().toISOString(),
        });
        errorsCount++;
      } else if (res.code === 'STOCK_INSUFICIENTE') {
        await db.offlineSales.update(sale.id!, {
          estado: 'REVISION',
          error: res.message || 'Existencias insuficientes al sincronizar con el servidor.',
          updatedAt: new Date().toISOString(),
        });
        errorsCount++;
      } else {
        await db.offlineSales.update(sale.id!, {
          estado: 'ERROR',
          error: res.message || 'Error inesperado del servidor.',
          updatedAt: new Date().toISOString(),
        });
        errorsCount++;
      }

      notifyListeners();
    }
  } catch (err: any) {
    console.error('[SyncService] Excepción durante sincronización:', err);
  } finally {
    isSyncing = false;
    notifyListeners();
  }

  return { processed, successCount, errorsCount };
}

// ─── Las constantes DEFAULT_OFFLINE_* se mantienen solo como referencia de IDs a purgar.
// NUNCA se muestran al usuario como datos reales.
export const DEFAULT_OFFLINE_SUPPLIERS: LocalSupplier[] = [];
export const DEFAULT_OFFLINE_CATEGORIES: LocalCategory[] = [];
export const DEFAULT_OFFLINE_PRODUCTS: LocalProduct[] = [];

/**
 * Purga datos ficticios de Dexie (llamada manual o por migración)
 */
export async function purgeDummyData(): Promise<void> {
  try {
    const [pDel, cDel, sDel] = await Promise.all([
      db.products.where('id').anyOf(DUMMY_PRODUCT_IDS).delete(),
      db.categories.where('id').anyOf(DUMMY_CATEGORY_IDS).delete(),
      db.suppliers.where('id').anyOf(DUMMY_SUPPLIER_IDS).delete(),
    ]);
    if (pDel + cDel + sDel > 0) {
      console.log(`[SyncService] Purga de datos ficticios ejecutada: ${pDel} productos, ${cDel} categorías, ${sDel} proveedores eliminados.`);
    }
    await db.metadata.put({ key: 'dummyDataCleaned', value: 'v6' });
  } catch (e) {
    console.warn('[SyncService] Error en purga de datos ficticios:', e);
  }
}

/**
 * F-02: Guardar catálogo en caché local Dexie.
 * Modo "reemplazante total" — borra todo lo que no vino del servidor.
 * Esto garantiza que offline = exactamente lo que está en línea.
 */
export async function cacheCatalogLocally(
  products: LocalProduct[],
  categories: LocalCategory[],
  clearExisting: boolean = false,
): Promise<void> {
  try {
    // Las búsquedas/filtros son parciales: solo se mezclan. Una descarga total
    // reemplaza también si el servidor devuelve [], evitando conservar datos borrados.
    await db.transaction('rw', db.products, db.categories, db.metadata, async () => {
      const pendingLocal = clearExisting
        ? await db.products.filter((p) => p.id.startsWith('prod-local-')).toArray()
        : [];
      const pendingCategories = clearExisting
        ? await db.categories.filter((category) => category.id.startsWith('cat-local-')).toArray()
        : [];
      if (clearExisting) {
        await db.products.clear();
        await db.categories.clear();
      }
      if (products) await db.products.bulkPut([...products, ...pendingLocal]);
      if (categories) await db.categories.bulkPut([...categories, ...pendingCategories]);
      await db.metadata.put({ key: 'lastCatalogSync', value: new Date().toISOString() });
      await db.metadata.put({ key: 'dummyDataCleaned', value: 'v6' });
    });

    console.log(`[SyncService] Catálogo sincronizado en Dexie (clearExisting=${clearExisting}): ${products.length} productos, ${categories.length} categorías.`);
  } catch (err) {
    console.warn('[SyncService] Error al guardar catálogo en Dexie:', err);
  }
}

/**
 * F-02: Guardar proveedores en caché local (reemplazo limpio, preservando pendientes offline)
 */
export async function cacheSuppliersLocally(suppliers: LocalSupplier[]): Promise<void> {
  try {
    await db.transaction('rw', db.suppliers, db.metadata, async () => {
      const pendingLocal = await db.suppliers.filter((s) => s.id.startsWith('prov-local-')).toArray();
      await db.suppliers.clear();
      await db.suppliers.bulkPut([...suppliers, ...pendingLocal]);
      await db.metadata.put({ key: 'lastSuppliersSync', value: new Date().toISOString() });
    });
    console.log(`[SyncService] ${suppliers.length} proveedores sincronizados en Dexie.`);
  } catch (err) {
    console.warn('[SyncService] Error cacheando proveedores:', err);
  }
}

/**
 * Ya no se inicializa con datos ficticios. Si Dexie está vacío sin conexión,
 * el usuario verá una pantalla de "Sin datos — conéctate para sincronizar".
 */
export async function ensureLocalCatalogInitialized(): Promise<void> {
  // Solo purgar datos ficticios si quedaron de versiones anteriores
  await purgeDummyData();
}

/**
 * Obtener proveedores desde caché local Dexie.
 * Retorna array vacío si no hay datos reales — nunca retorna ficticios.
 */
export async function getLocalSuppliersFromDexie(): Promise<LocalSupplier[]> {
  try {
    await purgeDummyData();
    const supps = await db.suppliers.toArray();
    return supps;
  } catch (err) {
    console.warn('[SyncService] Error obteniendo proveedores de Dexie:', err);
    return [];
  }
}

/**
 * F-02: Obtener catálogo desde caché local Dexie cuando no hay red.
 * Solo retorna datos que vinieron del servidor (nunca ficticios).
 */
export async function getLocalCatalogFromDexie(query?: string, categoryId?: string): Promise<{
  products: LocalProduct[];
  categories: LocalCategory[];
  lastSync: string | null;
}> {
  try {
    await purgeDummyData();

    let prods = await db.products.toArray();
    let cats = await db.categories.toArray();

    const meta = await db.metadata.get('lastCatalogSync');

    // Filtros locales
    if (categoryId && categoryId !== 'all') {
      prods = prods.filter((p) => p.categoriaId === categoryId);
    }

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.codigoBarras && p.codigoBarras.includes(q))
      );
    }

    return {
      products: prods,
      categories: cats,
      lastSync: meta?.value || null,
    };
  } catch (err) {
    console.error('[SyncService] Error leyendo Dexie local:', err);
    return {
      products: [],
      categories: [],
      lastSync: null,
    };
  }
}

/**
 * Refrescar catálogo completo desde el servidor (reemplazo total)
 * Se llama al volver a estar online y periódicamente.
 */
export async function refreshCatalogInBackground(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const [pRes, cRes, sRes] = await Promise.all([
      apiFetch<LocalProduct[]>('/products?includeInactive=false&all=true'),
      apiFetch<LocalCategory[]>('/categories'),
      apiFetch<LocalSupplier[]>('/suppliers'),
    ]);

    if (pRes.success && Array.isArray(pRes.data) && cRes.success && Array.isArray(cRes.data)) {
      await cacheCatalogLocally(pRes.data, cRes.data, true);
    }

    if (sRes.success && Array.isArray(sRes.data)) {
      await cacheSuppliersLocally(sRes.data);
    }

    console.log('[SyncService] Catálogo refrescado desde el servidor.');
  } catch (e) {
    // Silencioso en segundo plano
  }
}

/**
 * Inicializador de listeners automáticos para sincronización online
 */
export function initSyncManager() {
  if (typeof window === 'undefined') return;

  // Al arrancar: purgar datos ficticios y resincronizar en segundo plano si hay internet
  purgeDummyData().then(() => {
    if (navigator.onLine) {
      syncAllFromServer().catch(() => {});
    }
  });

  // Escuchar cuando el navegador recupera la conexión a internet
  window.addEventListener('online', () => {
    console.log('🌐 [SyncManager] Conexión a Internet detectada. Sincronizando catálogo completo y ventas...');
    syncAllFromServer().catch(() => {});
  });

  // Reintentar altas con backoff y luego ventas dependientes cada 20 segundos.
  setInterval(async () => {
    if (navigator.onLine) {
      const [pendingCount, queue] = await Promise.all([
        db.offlineSales
        .where('estado')
        .anyOf('PENDIENTE')
        .count(),
        db.syncQueue.toArray(),
      ]);
      const hasDueCreates = queue.some((op) => op.status === 'PENDING' && Date.parse(op.nextAttemptAt) <= Date.now());
      if (hasDueCreates) {
        await syncPendingCreates();
        syncPendingSales();
      } else if (pendingCount > 0) {
        syncPendingSales();
      }
    }
  }, 20000);

  // Sincronizar inmediatamente al cargar si hay conexión
  if (navigator.onLine) {
    setTimeout(() => {
      syncAllFromServer().catch(() => {});
      syncPendingSales();
    }, 1500);
  }
}

/**
 * Cachear ventas del servidor en Dexie para modo offline (reemplazo limpio)
 */
export async function cacheSalesLocally(sales: any[]): Promise<void> {
  try {
    const now = new Date().toISOString();
    const localSales: LocalSale[] = (sales || []).map((s) => ({
      id: String(s.id),
      numeroComprobante: s.numeroComprobante || '',
      fecha: s.fecha || s.createdAt || now,
      total: Number(s.total) || 0,
      estado: s.estado || 'COMPLETADO',
      metodoPago: s.metodoPago || '',
      clienteNombre: s.clienteNombre ?? null,
      usuarioNombre: s.usuario?.nombre || s.usuarioNombre || 'Sistema',
      detalles: (s.detalles || []).map((d: any) => ({
        productoId: String(d.productoId || d.producto?.id || ''),
        productoNombre: d.producto?.nombre || d.productoNombre || `Producto ${d.productoId}`,
        cantidad: Number(d.cantidad) || 0,
        precioUnitario: Number(d.precioUnitario) || 0,
        subtotal: Number(d.subtotal) || 0,
      })),
      cachedAt: now,
    }));

    await db.transaction('rw', db.localSales, async () => {
      await db.localSales.clear();
      if (localSales.length > 0) {
        await db.localSales.bulkPut(localSales);
      }
    });

    await db.metadata.put({ key: 'lastSalesSync', value: now });
    console.log(`[SyncService] ${localSales.length} ventas cacheadas en Dexie (reemplazo limpio).`);
  } catch (err) {
    console.warn('[SyncService] Error cacheando ventas:', err);
  }
}

/**
 * Obtener ventas cacheadas de Dexie (modo offline)
 */
export async function getCachedSales(): Promise<LocalSale[]> {
  try {
    const sales = await db.localSales.orderBy('fecha').reverse().toArray();
    return sales;
  } catch (err) {
    console.warn('[SyncService] Error obteniendo ventas cacheadas:', err);
    return [];
  }
}

/**
 * Cachear compras del servidor en Dexie para modo offline (reemplazo limpio)
 */
export async function cachePurchasesLocally(purchases: any[]): Promise<void> {
  try {
    await db.transaction('rw', db.purchases, async () => {
      await db.purchases.clear();
      if (purchases && purchases.length > 0) {
        await db.purchases.bulkPut(purchases);
      }
    });
    console.log(`[SyncService] ${(purchases || []).length} compras cacheadas en Dexie.`);
  } catch (err) {
    console.warn('[SyncService] Error cacheando compras:', err);
  }
}

/**
 * Cachear usuarios del servidor en Dexie para modo offline (reemplazo limpio)
 */
export async function cacheUsersLocally(users: any[]): Promise<void> {
  try {
    const now = new Date().toISOString();
    const localUsers: LocalUser[] = (users || []).map((u) => ({
      id: String(u.id),
      nombre: u.nombre || '',
      email: u.email || '',
      rol: u.rol || 'CAJERO',
      estado: Boolean(u.estado),
      verificado: Boolean(u.verificado),
      createdAt: u.createdAt,
      cachedAt: now,
    }));

    await db.transaction('rw', db.localUsers, async () => {
      await db.localUsers.clear();
      if (localUsers.length > 0) {
        await db.localUsers.bulkPut(localUsers);
      }
    });

    await db.metadata.put({ key: 'lastUsersSync', value: now });
    console.log(`[SyncService] ${localUsers.length} usuarios cacheados en Dexie (reemplazo limpio).`);
  } catch (err) {
    console.warn('[SyncService] Error cacheando usuarios:', err);
  }
}

/**
 * Obtener usuarios cacheados de Dexie (modo offline)
 */
export async function getCachedUsers(): Promise<LocalUser[]> {
  try {
    const users = await db.localUsers.toArray();
    return users;
  } catch (err) {
    console.warn('[SyncService] Error obteniendo usuarios cacheados:', err);
    return [];
  }
}

/**
 * Sincronización maestra total: descarga todos los datos reales de Neon y
 * actualiza todas las tablas de Dexie de forma limpia por reemplazo.
 */
export async function syncAllFromServer(): Promise<{ success: boolean; message: string; details?: any }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, message: 'Sin conexión a Internet.' };
  }

  try {
    await purgeDummyData();

    const createSync = await syncPendingCreates();
    await syncPendingSales();

    const [pRes, cRes, sRes, uRes, salesRes, purRes] = await Promise.all([
      apiFetch<LocalProduct[]>('/products?includeInactive=false&all=true'),
      apiFetch<LocalCategory[]>('/categories'),
      apiFetch<LocalSupplier[]>('/suppliers?includeInactive=true'),
      apiFetch<any[]>('/users'),
      apiFetch<any[]>('/sales?limit=50'),
      apiFetch<any[]>('/purchases'),
    ]);

    let prodCount = 0;
    let suppCount = 0;
    let userCount = 0;

    if (pRes.success && Array.isArray(pRes.data) && cRes.success && Array.isArray(cRes.data)) {
      await cacheCatalogLocally(pRes.data, cRes.data || [], true);
      prodCount = pRes.data.length;
    }

    if (sRes.success && Array.isArray(sRes.data)) {
      await cacheSuppliersLocally(sRes.data);
      suppCount = sRes.data.length;
    }

    if (uRes.success && uRes.data) {
      await cacheUsersLocally(uRes.data);
      userCount = uRes.data.length;
    }

    if (salesRes.success && salesRes.data) {
      await cacheSalesLocally(salesRes.data);
    }

    if (purRes.success && purRes.data) {
      await cachePurchasesLocally(purRes.data);
    }

    notifyListeners();

    return {
      success: true,
      message: `Sincronización con Neon: ${prodCount} productos, ${suppCount} proveedores, ${userCount} usuarios; ${createSync.synced} altas offline confirmadas${createSync.errors ? `, ${createSync.errors} pendientes o con error` : ''}.`,
      details: { prodCount, suppCount, userCount, ...createSync },
    };
  } catch (err: any) {
    console.error('[SyncService] Error en syncAllFromServer:', err);
    return { success: false, message: err?.message || 'Error durante la sincronización total.' };
  }
}
