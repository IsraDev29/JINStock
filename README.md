# 📚 JINStock (SIGEL) - Manual Técnico y de Operaciones

> **Sistema Web PWA Offline-First para la Gestión de Ventas e Inventario**  
> Diseñado para librerías y papelerías nicaragüenses con soporte multimoneda (C$ NIO / $ USD), sincronización resiliente y transacciones ACID.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-vitest%20passing-brightgreen)](backend/tests/api.test.ts)
[![Frontend Build](https://img.shields.io/badge/frontend%20build-vite%20passing-brightgreen)](frontend/)
[![Architecture](https://img.shields.io/badge/stack-React%2019%20%7C%20Express%20%7C%20Prisma%20%7C%20Neon%20Postgres-purple)](README.md)
[![PWA](https://img.shields.io/badge/PWA-Dexie%20v2%20%7C%20Workbox-blue)](frontend/src/pwa/db.ts)

---

## 🌐 1. URLs de Producción y Propósito del Sistema

| Componente | URL de Producción | Propósito |
| :--- | :--- | :--- |
| **Frontend (PWA)** | [https://jinstock-proyect.pages.dev](https://jinstock-proyect.pages.dev) | Aplicación Web Progresiva para punto de venta (POS), catálogo local en IndexedDB, gestión de inventario y sincronización automática bidireccional. |
| **Backend (API REST)** | [https://sigel-proyect.onrender.com](https://sigel-proyect.onrender.com) | Servicio REST con Express, validación estricta con Zod, autenticación JWT, Kardex transaccional y persistencia en PostgreSQL (Neon). Base API: `/api`. |

### Propósito del Negocio
JINStock resuelve la problemática de interrupciones operativas (cortes de energía o conectividad) en librerías y papelerías de Nicaragua:
- **Facturación ininterrumpida:** El cajero puede seguir cobrando sin Internet. Las ventas se guardan en IndexedDB ([Dexie.js](frontend/src/pwa/db.ts)) y se transmiten al servidor con reconciliación de inventario e idempotencia (`offlineId`).
- **Multimoneda:** Manejo nativo de pagos en Córdobas (NIO) y Dólares (USD), con cálculo de vuelto exacto en Córdobas a la tasa oficial configurada.
- **Trazabilidad de inventario:** Movimientos Kardex (`ENTRADA`, `SALIDA`, `AJUSTE`) protegidos contra stocks negativos mediante operaciones atómicas con Prisma.

---

## 🔐 2. Variables de Entorno

### Backend (`backend/.env` o variables en Render)

| Variable | Tipo | Obligatoria | Descripción / Valor por Defecto |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | String | **SÍ** | Cadena de conexión PostgreSQL (con pooler Neon, e.g. `?sslmode=require`). |
| `DIRECT_URL` | String | **SÍ** | Conexión directa a PostgreSQL para migraciones Prisma sin pgbouncer. |
| `JWT_SECRET` | String | **SÍ** | Clave secreta para firmar tokens JWT (mínimo 32 caracteres). El servidor falla al arrancar si falta. |
| `CORS_ORIGIN` | String | **SÍ en prod** | Lista de orígenes permitidos separados por coma. **En producción no se permite `*`** (el servidor falla si no está definida). En local puede ser `http://localhost:5173`. |
| `TRUST_PROXY_HOPS` | Número | No | Saltos de proxy confiables para Express. En Render detrás de Cloudflare se recomienda `2`; evita evadir los rate limits manipulando `X-Forwarded-For`. |
| `HEALTH_CACHE_TTL_MS` | Número | No | Tiempo de reutilización del último health check saludable. Por defecto `5000` ms en producción y `0` en pruebas. |
| `PORT` | Número | No | Puerto de escucha (Render lo asigna dinámicamente; por defecto `4000`). |
| `NODE_ENV` | String | No | Entorno de ejecución (`development`, `production`, `test`). |
| `INITIAL_ADMIN_EMAIL` | String | No | Correo para auto-creación del primer administrador si la BD está vacía. |
| `INITIAL_ADMIN_PASSWORD` | String | No | Contraseña para el administrador inicial. Si no se define, se usa `npm run seed:admin`. |
| `INITIAL_ADMIN_NAME` | String | No | Nombre del administrador inicial (`Administrador JINStock`). |
| `ENABLE_KEEP_ALIVE` | Boolean | No | `true` activa un ping `SELECT 1` cada 3 min para evitar sleep en Neon Free Tier. |
| `KEEP_ALIVE_INTERVAL_MS`| Número | No | Intervalo de ping en milisegundos (por defecto `180000`). |
| `SMTP_HOST`, `SMTP_PORT`| String | No | Configuración SMTP para envío de correos (opcional). |
| `SMTP_USER`, `SMTP_PASS`| String | No | Credenciales SMTP (opcional). |

### Frontend (`frontend/.env` o variables en Cloudflare Pages)

| Variable | Tipo | Obligatoria | Descripción |
| :--- | :---: | :---: | :--- |
| `VITE_API_URL` | String | **SÍ** | URL base de la API backend. En producción: `https://sigel-proyect.onrender.com/api`. En local: `http://localhost:4000/api`. |

---

## 🧪 3.1 Guía de validación para evaluadores

La autoevaluación provisional frente a la rúbrica del Laboratorio 15, sus evidencias y los criterios aún no verificables están en [docs/evaluacion-rubrica-lab15.md](docs/evaluacion-rubrica-lab15.md).

Para una comprobación rápida y segura del despliegue, utilice primero los endpoints públicos:

```bash
curl -i https://sigel-proyect.onrender.com/api/live
curl -i https://sigel-proyect.onrender.com/api/health
curl -i https://sigel-proyect.onrender.com/api
```

`/api/live` es la sonda de **liveness**: confirma que el proceso está activo y no consulta PostgreSQL. Configúrela para comprobar el proceso sin convertir cada sonda en carga de base de datos. `/api/health` es la sonda de **readiness**: confirma que el proceso y PostgreSQL están disponibles. Reutiliza durante cinco segundos el último resultado saludable y agrupa comprobaciones concurrentes. `HEALTH_CACHE_TTL_MS=0` desactiva esa reutilización y consulta la base de datos en cada comprobación; no lo configure así para monitorización frecuente en producción.

Ambas respuestas de health llevan `Cache-Control: no-store`. `/api/health` añade `Server-Timing`: `db;dur=...;desc="checked"` indica el tiempo de la consulta; `desc="cached"` significa que se reutilizó una comprobación saludable reciente, y `app;dur=...` mide el tiempo del handler. En una respuesta 503 se marca `desc="failed"`. Compare esta duración de servidor con el tiempo medido por el cliente: si el servidor es rápido y el p95 de cliente alto, investigue cold start, región y ruta de red antes de optimizar PostgreSQL.

La prueba de carga de referencia se ejecuta sin modificar datos:

```bash
node backend/scripts/load-test.js https://sigel-proyect.onrender.com
```

El script realiza 50 solicitudes con concurrencia 10 y reporta p50, media, p95, códigos HTTP y errores 5xx. Para una comparación repetible, ejecute tres corridas desde la misma máquina/región, conserve cada salida y distinga el tiempo de warm-up del p95 de las ráfagas; no compare mediciones de regiones o condiciones distintas. Para probar el catálogo autenticado, defina temporalmente `AUTH_TOKEN` en el entorno del evaluador; no lo escriba en el repositorio ni en una captura pública.

Durante la revisión de logs, use un `X-Request-Id` controlado y búsquelo en los logs de Render. El endpoint `/api/logs` requiere un token de administrador y debe probarse únicamente con una cuenta QA. Las cuentas y contraseñas de evaluación deben compartirse por un canal privado y rotarse al finalizar la coevaluación.

En producción, configure `TRUST_PROXY_HOPS=2` para la cadena Cloudflare → Render Ingress → contenedor. No use `trust proxy=true`: la cantidad explícita de saltos evita que un cliente evada el rate limiting manipulando `X-Forwarded-For`.

El gate de calidad se ejecuta desde `.github/workflows/ci.yml`. El job de backend levanta PostgreSQL 15, aplica el schema Prisma, define `TEST_DATABASE_URL` y ejecuta las pruebas de integración real de concurrencia. El job de frontend ejecuta Oxlint, compilación Vite y verificación de `_headers`.

---

## 📡 4. Tabla Completa de Endpoints de la API

Todas las rutas están bajo el prefijo `/api`. Las respuestas de error de negocio devuelven JSON con `{ success: false, code: string, message: string }`. Los errores originados en una solicitud HTTP incluyen además `requestId` cuando el middleware de logging logró asignarlo.

| Método | Ruta | Rol Requerido | Parámetros (Query / Body) | Ejemplo de Respuesta Exitosa | Errores Posibles |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `GET` | `/health` | Público | Ninguno | `{"success": true, "status": "healthy", "timestamp": "...", "uptimeSeconds": 120}` | `503` (DB caída o timeout >2s) |
| `GET` | `/live` | Público | Ninguno | `{"success": true, "status": "alive"}` | No consulta la base de datos |
| `POST` | `/auth/login` | Público | Body: `{ email, password }` | `{"success": true, "data": {"token": "ey...", "usuario": {...}}}` | `400` (datos vacíos), `401` (credenciales inválidas o cuenta inactiva), `429` (rate limit 20 req/15min) |
| `POST` | `/auth/register` | Público | Body: `{ nombre, email, password }` | `{"success": true, "message": "Usuario registrado exitosamente"}` | `400` (política contraseña <8 chars), `409` (email duplicado), `429` (rate limit 10 req/hora) |
| `POST` | `/auth/verify` | Público | Body: `{ token }` | `{"success": true, "message": "Correo verificado."}` | `400` (token faltante o inválido) |
| `GET` | `/auth/me` | Autenticado | Ninguno | `{"success": true, "data": {"id": "...", "nombre": "...", "rol": "..."}}` | `401` |
| `GET` | `/products` | Autenticado | Query: `page`, `limit` (max 100), `search` (máx. 100 caracteres), `categoriaId`, `lowStock=true/false`, `includeInactive=true/false`, `all=true/false` | `{"success": true, "data": [...], "pagination": {"page": 1, "limit": 20, "total": 45}}` | `400` (parámetros inválidos), `401` (sin token) |
| `GET` | `/products/:id` | Autenticado | Params: `id` | `{"success": true, "data": {"id": "...", "nombre": "Cuaderno", ...}}` | `401`, `404` (producto inexistente) |
| `POST` | `/products` | `ADMINISTRADOR` | Body: `{ nombre, precioVenta, costo, stock, stockMinimo, categoriaId, codigoBarras?, sku?, unidadMedida? }` | `{"success": true, "data": {...}}` | `400` (validación Zod), `401`, `403` (rol insuficiente), `409` (código de barra duplicado) |
| `PUT` | `/products/:id` | `ADMINISTRADOR` | Params: `id`, Body: campos a actualizar | `{"success": true, "data": {...}}` | `400`, `401`, `403`, `404` |
| `PATCH` | `/products/:id/status` | `ADMINISTRADOR` | Params: `id` | `{"success": true, "data": {...}, "message": "Producto activado/desactivado correctamente."}` | `401`, `403`, `404` |
| `DELETE` | `/products/:id` | `ADMINISTRADOR` | Params: `id` | `{"success": true, "message": "Producto eliminado permanentemente del sistema."}` | `400` (si tiene ventas/compras históricas: se desactiva), `401`, `403`, `404` |
| `POST` | `/products/adjust` | `ADMINISTRADOR` | Body: `{ productoId, cantidad, motivo }` | `{"success": true, "data": {"product": {...}, "movement": {...}}}` | `400` (cantidad 0 o motivo vacío, stock negativo resultante), `401`, `403`, `404` |
| `GET` | `/products/movements` | Autenticado | Query: `productoId`, `tipo`, `desde`, `hasta`, `page`, `limit` | `{"success": true, "data": [...], "pagination": {...}}` | `401` |
| `POST` | `/sales` | Autenticado | Body: `{ detalles: [{ productoId, cantidad, precioUnitario?, subtotal? }], metodoPago, montoPagadoNIO?, montoPagadoUSD?, cambioNIO?, offlineId? }` | `{"success": true, "data": {"id": "...", "numeroComprobante": "FAC-2026-00001", "total": 150.0}}` | `200` si `offlineId` ya existe (idempotencia), `400` (`STOCK_INSUFICIENTE`), `401` |
| `GET` | `/sales` | Autenticado | Query: `desde`, `hasta` (YYYY-MM-DD), `page`, `limit`, `cajeroId` | `{"success": true, "data": [...], "pagination": {...}}` | `400` (fechas inválidas), `401` |
| `PATCH` | `/sales/:id/anular` | `ADMINISTRADOR` | Params: `id`, Body: `{ motivo }` | `{"success": true, "message": "Venta anulada exitosamente y stock restaurado en Kardex."}` | `400` (venta ya anulada o motivo <3 chars), `401`, `403`, `404` |
| `GET` | `/sales/stats` | Autenticado | Ninguno | `{"success": true, "data": {"ventasHoy": 1250, "stockBajo": 3, ...}}` | `401` |
| `GET` | `/categories` | Autenticado | Query: `includeInactive=true/false` | `{"success": true, "data": [{"id": "...", "nombre": "Papelería"}]}` | `401` |
| `POST` | `/categories` | `ADMINISTRADOR` | Body: `{ nombre, descripcion? }` | `{"success": true, "data": {...}}` | `400`, `401`, `403` |
| `PUT` | `/categories/:id` | `ADMINISTRADOR` | Params: `id`, Body: `{ nombre, descripcion? }` | `{"success": true, "data": {...}}` | `400`, `401`, `403`, `404` |
| `PATCH` | `/categories/:id/status` | `ADMINISTRADOR` | Params: `id` | `{"success": true, "data": {...}}` | `401`, `403`, `404` |
| `GET` | `/suppliers` | `ADMINISTRADOR` | Ninguno | `{"success": true, "data": [...]}` | `401`, `403` |
| `POST` | `/suppliers` | `ADMINISTRADOR` | Body: `{ nombre, ruc?, telefono?, email?, direccion? }` | `{"success": true, "data": {...}}` | `400`, `401`, `403`, `409` |
| `PUT` | `/suppliers/:id` | `ADMINISTRADOR` | Params: `id`, Body: campos a actualizar | `{"success": true, "data": {...}}` | `400`, `401`, `403`, `404` |
| `PATCH` | `/suppliers/:id/status` | `ADMINISTRADOR` | Params: `id` | `{"success": true, "data": {...}}` | `401`, `403`, `404` |
| `GET` | `/purchases` | `ADMINISTRADOR` | Query: `desde`, `hasta`, `proveedorId` | `{"success": true, "data": [...]}` | `400`, `401`, `403` |
| `POST` | `/purchases` | `ADMINISTRADOR` | Body: `{ proveedorId, detalles: [{ productoId, cantidad, costoUnitario }] }` | `{"success": true, "data": {...}}` | `400`, `401`, `403`, `409` (P2003 proveedor inexistente) |
| `PATCH` | `/purchases/:id/anular` | `ADMINISTRADOR` | Params: `id`, Body: `{ motivo }` | `{"success": true, "message": "Compra anulada correctamente y stock descontado."}` | `400`, `401`, `403`, `404` |
| `GET` | `/users` | `ADMINISTRADOR` | Ninguno | `{"success": true, "data": [...]}` | `401`, `403` |
| `POST` | `/users` | `ADMINISTRADOR` | Body: `{ nombre, email, password, rol }` | `{"success": true, "data": {...}}` | `400` (password <8 chars), `401`, `403`, `409` |
| `PATCH` | `/users/:id/status` | `ADMINISTRADOR` | Params: `id` | `{"success": true, "data": {...}, "message": "Estado del usuario actualizado correctamente."}` | `400` (auto-desactivación no permitida), `401`, `403`, `404` |
| `DELETE` | `/users/:id` | `ADMINISTRADOR` | Params: `id` | `{"success": true, "message": "Usuario eliminado correctamente."}` | `400` (auto-eliminación no permitida o con ventas registradas), `401`, `403`, `404` |
| `GET` | `/reports/cash-closing` | Autenticado | Query: `fecha` (YYYY-MM-DD), `cajeroId?` | `{"success": true, "data": {...}}` | `400`, `401` |
| `GET` | `/reports/sales` | `ADMINISTRADOR` | Query: `desde`, `hasta` (YYYY-MM-DD) | `{"success": true, "data": [...]}` | `400`, `401`, `403` |
| `GET` | `/reports/purchases` | `ADMINISTRADOR` | Query: `desde`, `hasta` (YYYY-MM-DD) | `{"success": true, "data": [...]}` | `400`, `401`, `403` |
| `GET` | `/reports/top-products` | `ADMINISTRADOR` | Query: `desde`, `hasta` (YYYY-MM-DD) | `{"success": true, "data": [...]}` | `400`, `401`, `403` |
| `GET` | `/logs` | `ADMINISTRADOR` | Query: `limit` (max 100), `type=all/error` | `{"success": true, "count": 25, "data": [...]}` | `401`, `403` (requiere ADMINISTRADOR) |

---

## 💻 4. Ejemplos de Peticiones con `curl`

### 1. Chequeo de Salud del Servicio (`/health`)
Verifica el estado del backend y la conectividad a la base de datos con timeout de 2 segundos:
```bash
curl -i -X GET https://sigel-proyect.onrender.com/api/health
```
**Respuesta:**
```json
HTTP/1.1 200 OK
X-Request-Id: 4f981e4b-7489-4bc2-b362-7d2d380f2d91
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "message": "Servidor JINStock Backend operativo",
  "status": "healthy",
  "timestamp": "2026-10-30T04:40:00.000Z"
}
```

### 2. Inicio de Sesión (`/auth/login`)
```bash
curl -i -X POST https://sigel-proyect.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jinstock.ni",
    "password": "TuPasswordSegura2026!"
  }'
```
**Respuesta:**
```json
HTTP/1.1 200 OK
X-Request-Id: e1a35790-2e4a-4a25-94cf-6cb314c1aa57
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id": "usr-uuid-001",
      "nombre": "Administrador General",
      "email": "admin@jinstock.ni",
      "rol": "ADMINISTRADOR"
    }
  },
  "message": "Inicio de sesión exitoso"
}
```

### 3. Listado de Productos con Paginación (`/products`)
```bash
TOKEN="tu_jwt_token_aqui"

# Paginado (página 1, 10 elementos)
curl -i -X GET "https://sigel-proyect.onrender.com/api/products?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Modo catálogo completo para sincronización offline del frontend
curl -i -X GET "https://sigel-proyect.onrender.com/api/products?all=true" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Creación de Venta con Idempotencia Offline (`/sales`)
```bash
curl -i -X POST https://sigel-proyect.onrender.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "offlineId": "offline-pos-uuid-88234-a1",
    "metodoPago": "EFECTIVO_CORDOBAS",
    "montoRecibido": 500,
    "detalles": [
      {
        "productoId": "prod-cuaderno-100h",
        "cantidad": 2,
        "precioUnitario": 45.0
      }
    ]
  }'
```
*Si se reenvía la misma petición con el mismo `offlineId`, el backend responde `200 OK` con la venta previamente creada, garantizando idempotencia estricta sin duplicar cargos ni descuentos de inventario.*

---

## 📊 5. Monitoreo, Logs y Trazabilidad

### Estructura de los Logs
El backend emite registros JSON estructurados a `stdout`/`stderr` y almacena localmente en `logs/combined.log` y `logs/error.log`:
```json
{
  "timestamp": "2026-10-30T04:39:02.505Z",
  "level": "INFO",
  "message": "HTTP GET /api/health 200 (1ms)",
  "requestId": "5e9c237b-4b0a-4d1e-811a-fcbeec7eaad4",
  "context": {
    "requestId": "5e9c237b-4b0a-4d1e-811a-fcbeec7eaad4",
    "method": "GET",
    "url": "/api/health",
    "status": 200,
    "durationMs": 1,
    "ip": "127.0.0.1",
    "userAgent": "curl/7.88.1"
  }
}
```

### Trazabilidad con `X-Request-Id`
- Cada solicitud recibe un identificador único `X-Request-Id` (o preserva el enviado por el cliente/proxy).
- El `requestId` se propaga en el encabezado de respuesta HTTP, en los logs del servidor y dentro del cuerpo JSON de cualquier respuesta de error (`4xx`/`5xx`).
- Ante cualquier reporte de fallo en producción, el usuario o tester puede proporcionar el `requestId` mostrado en la interfaz para ubicar el registro exacto en los logs.

### Sanitización de Datos Sensibles
El motor de logs filtra y reemplaza recursivamente por `[REDACTED]` cualquier clave que contenga: `password`, `token`, `secret`, `authorization` o `cookie`. Los cuerpos completos de autenticación nunca se escriben en disco ni en la consola.

### Cómo ver los Logs en Render
1. Inicie sesión en el [Dashboard de Render](https://dashboard.render.com).
2. Seleccione el servicio web `jinstock-proyect`.
3. Abra la pestaña **Logs**. Allí se transmiten en tiempo real todos los eventos formateados en JSON.
> ⚠️ **IMPORTANTE:** El sistema de archivos en los Web Services estándar de Render es **efímero**. Los archivos locales `logs/combined.log` y `logs/error.log` se reinician con cada deploy o reinicio del contenedor. La fuente confiable y persistente de auditoría en producción es la pestaña **Logs** de Render o un recolector syslog/Datadog conectado.

---

## 🚀 6. Guía de Despliegue

### Despliegue en Render (Backend)
1. **Crear Servicio Web:**
   - Tipo: **Web Service**.
   - Conectar el repositorio de GitHub: `SIGEL-PROYECT-main` (o el fork correspondiente).
   - Root Directory: `backend`.
   - Runtime: **Node**.
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
2. **Configurar Variables de Entorno en Render:**
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: URL del pooler de Neon (`?sslmode=require`)
   - `DIRECT_URL`: URL directa de Neon
   - `JWT_SECRET`: Cadena aleatoria segura (>= 32 chars)
   - `CORS_ORIGIN`: `https://jinstock-proyect.pages.dev` (OBLIGATORIO en producción; no colocar `*`)
   - `INITIAL_ADMIN_EMAIL`: Correo del administrador inicial
   - `INITIAL_ADMIN_PASSWORD`: Contraseña segura del administrador inicial
   - `INITIAL_ADMIN_NAME`: Nombre del administrador
   - `ENABLE_KEEP_ALIVE`: `true`
3. **Migración de Base de Datos:**
   - El script `npm run build` compila TypeScript (`tsc`).
   - Para aplicar el schema: `npx prisma db push` o ejecutar `npx prisma generate` (ya incluido en el ciclo de build).

### Despliegue en Cloudflare Pages (Frontend)
1. **Crear Proyecto en Cloudflare Pages:**
   - Conectar el repositorio de GitHub.
   - Build setting: **Vite**.
   - Root directory: `frontend`.
   - Build command: `npm run build`
   - Build output directory: `dist`
2. **Variables de Entorno en Cloudflare Pages:**
   - `VITE_API_URL`: `https://sigel-proyect.onrender.com/api`
3. **Cabeceras de Seguridad:**
   - El archivo `frontend/public/_headers` se copia automáticamente a `dist/_headers` durante el build. Cloudflare Pages inyecta automáticamente:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Content-Security-Policy`: Restringe orígenes a `self`, Google Fonts, Render (`sigel-proyect.onrender.com`) y generador de QR.

---

## 🧪 7. Cómo Verificar el Funcionamiento

### 1. Chequeo de Salud Automatizado
```bash
curl -s -f https://sigel-proyect.onrender.com/api/health | jq .
```
Debe devolver `"status": "healthy"`.

### 2. Ejecutar Pruebas Automatizadas Unitarias y de Integración
```bash
cd backend
npm test
```
Ejecuta la suite con 24 tests de Vitest cubriendo seguridad, concurrencia, idempotencia, rate limit y paginación.

### 3. Verificación de Tipos TypeScript y Build
```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend
cd frontend && npm run build
```

### 4. Prueba de Carga y Concurrencia
Se incluye un script que realiza warm-up y lanza 50 peticiones con concurrencia 10, midiendo percentiles de latencia (min, p50, avg, p95, max) y tasa de errores 5xx:
```bash
cd backend
# Ejecutar contra endpoint de producción
./scripts/load-test.sh https://sigel-proyect.onrender.com/api/health
```

---

## 👥 8. Matriz de Roles y Permisos

| Módulo / Funcionalidad | Ruta Frontend | CAJERO | ADMINISTRADOR |
| :--- | :--- | :---: | :---: |
| **Punto de Venta (POS)** | `/pos` | ✅ | ✅ |
| **Historial de Ventas Propias** | `/ventas` | ✅ | ✅ |
| **Dashboard y KPIs Gerenciales**| `/dashboard` | ❌ (403) | ✅ |
| **Gestión de Inventario y Kardex**| `/inventario` | ❌ (403) | ✅ |
| **Compras a Proveedores** | `/compras` | ❌ (403) | ✅ |
| **Gestión de Proveedores** | `/proveedores`| ❌ (403) | ✅ |
| **Reportes y Cierres de Caja** | `/reportes` | ❌ (403) | ✅ |
| **Administración de Usuarios** | `/usuarios` | ❌ (403) | ✅ |
| **Consulta de Logs del Sistema**| `/api/logs` | ❌ (403) | ✅ |

---

## 🛠️ 9. Operación Local para Nuevos Desarrolladores

```bash
# 1. Clonar repositorio
git clone <url-del-repo>
cd SIGEL-PROYECT-main

# 2. Configurar variables locales
cp .env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Instalar dependencias
cd backend && npm install
cd ../frontend && npm install

# 4. Iniciar backend en terminal 1
cd backend && npm run dev

# 5. Iniciar frontend en terminal 2
cd frontend && npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.