const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  status?: number;
  networkError?: boolean;
  isServerError?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  [key: string]: any;
}

export const getAuthToken = (): string | null => {
  return localStorage.getItem('jinstock_token') || sessionStorage.getItem('jinstock_token');
};

export const setAuthToken = (token: string, remember = true): void => {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  target.setItem('jinstock_token', token);
  other.removeItem('jinstock_token');
};

export const getStoredUser = <T = unknown>(): T | null => {
  const stored = localStorage.getItem('jinstock_user') || sessionStorage.getItem('jinstock_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as T;
  } catch {
    localStorage.removeItem('jinstock_user');
    sessionStorage.removeItem('jinstock_user');
    return null;
  }
};

export const setStoredUser = (user: unknown, remember = true): void => {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  target.setItem('jinstock_user', JSON.stringify(user));
  other.removeItem('jinstock_user');
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('jinstock_token');
  sessionStorage.removeItem('jinstock_token');
  localStorage.removeItem('jinstock_user');
  sessionStorage.removeItem('jinstock_user');
};

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export const apiFetch = async <T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<ApiResponse<T>> => {
  // Detección instantánea de offline para evitar esperas y bloqueos de interfaz
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      status: 0,
      code: 'OFFLINE',
      message: 'Sin conexión a internet (modo fuera de línea).',
      networkError: true,
      isServerError: false,
    };
  }

  const token = getAuthToken();
  const { timeoutMs = 8000, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // C-02 Punto 4: Timeout con AbortController de 8 segundos (RNF-09)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = { message: response.statusText };
    }

    // C-02 Punto 1: Conservar status y code cuando el servidor responde con error HTTP
    if (!response.ok) {
      const is5xx = response.status >= 500;
      return {
        success: false,
        status: response.status,
        code: data.code || `HTTP_${response.status}`,
        message: data.message || `Error del servidor (${response.status})`,
        networkError: is5xx, // Si la BD en la nube es inaccesible o el server falla con 5xx, se activa fallback offline
        isServerError: is5xx,
        ...data,
      };
    }

    return {
      success: true,
      status: response.status,
      networkError: false,
      isServerError: false,
      ...data,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    // C-02 Punto 1: networkError = true cuando fetch falla (sin red, servidor caído o timeout)
    const isAbort = error.name === 'AbortError';
    console.warn(`[apiFetch] Fallo de conexión hacia ${endpoint}:`, error.message);

    return {
      success: false,
      status: 0,
      code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isAbort
        ? 'Tiempo de espera agotado al conectar con el servidor (8s).'
        : 'Sin conexión con el servidor (servidor inaccesible o sin internet).',
      networkError: true,
      isServerError: true,
    };
  }
};
