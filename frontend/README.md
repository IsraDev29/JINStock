# JINStock — Frontend PWA

Aplicación web progresiva para punto de venta e inventario. El catálogo local y las ventas pendientes se gestionan con IndexedDB para permitir operación offline y sincronización posterior con el backend.

## Requisitos

- Node.js compatible con Vite 8 (Node.js 20.19+ o 22.12+).
- El backend de JINStock disponible localmente o una URL de API autorizada.

## Configuración local

Desde esta carpeta, instala dependencias y crea `.env` a partir de `.env.example`:

```bash
npm ci
cp .env.example .env
```

Configura `VITE_API_URL` para que termine en `/api`. En desarrollo local:

```dotenv
VITE_API_URL="http://localhost:4000/api"
```

No guardes tokens de usuario, secretos de producción ni credenciales de base de datos en variables `VITE_*`: Vite las incluye en el bundle del navegador.

## Comandos

```bash
npm run dev       # servidor local Vite
npm run lint      # lint de frontend
npx tsc -b        # verificación de tipos usada por CI
npm run build     # build de producción
npm run preview   # servir localmente el build para revisión
```

Abre la URL local que imprima Vite (por defecto, `http://localhost:5173`). Para validar el build antes de desplegar, ejecuta `npm run build` y luego `npm run preview`.

## Despliegue y verificación

El despliegue de producción documentado está en Cloudflare Pages: <https://jinstock-proyect.pages.dev>. El API productivo es <https://sigel-proyect.onrender.com/api>. La configuración de compilación debe establecer `VITE_API_URL` al API autorizado para ese entorno y usar las cabeceras/CSP administradas en `public/_headers` o el archivo equivalente del proyecto.

El frontend depende de que el backend permita el origen web por CORS y de que su política CSP autorice la URL del API en `connect-src`. Tras publicar, verifica la carga inicial, inicio de sesión con una cuenta QA, consulta de catálogo y sincronización en modo conectado. Para probar modo offline, usa datos de prueba, comprueba que la venta pendiente persista tras recargar y vuelve a conectar para verificar su sincronización; no realices ventas de prueba con datos de producción.

Para instrucciones de API, variables del backend, carga segura, logs, CI y arquitectura general, consulta el [README principal](../README.md).
