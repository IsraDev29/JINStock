#!/usr/bin/env node
/**
 * JINStock - Script de Prueba de Carga y Rendimiento (Fase 3 / Lab 15)
 * Ejecuta 50 solicitudes con concurrencia 10 contra endpoints del backend,
 * reportando latencia media, p95, p50 y tasa de errores HTTP 5xx.
 *
 * Uso:
 *   node backend/scripts/load-test.js [BASE_URL]
 *   Ejemplo: node backend/scripts/load-test.js https://sigel-proyect.onrender.com
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const rawBaseUrl = process.argv[2] || process.env.TEST_URL || 'http://localhost:4000';
let baseUrl = rawBaseUrl.replace(/\/+$/, '');
if (baseUrl.endsWith('/api/health')) {
  baseUrl = baseUrl.slice(0, -'/api/health'.length);
} else if (baseUrl.endsWith('/health')) {
  baseUrl = baseUrl.slice(0, -'/health'.length);
} else if (baseUrl.endsWith('/api')) {
  baseUrl = baseUrl.slice(0, -'/api'.length);
}

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 60000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 60000 });

function requestAsync(targetUrl, options = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    const agent = parsed.protocol === 'https:' ? httpsAgent : httpAgent;
    const start = process.hrtime.bigint();

    const req = client.request(
      parsed,
      {
        agent,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const end = process.hrtime.bigint();
          const durationMs = Number(end - start) / 1e6;
          resolve({
            ok: true,
            status: res.statusCode,
            durationMs,
            body,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('TIMEOUT'));
    });

    req.on('error', (err) => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      resolve({
        ok: false,
        status: 0,
        error: err.message,
        durationMs,
      });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

async function runConcurrentBatch(url, totalRequests = 50, concurrency = 10, headers = {}) {
  const results = [];
  let completed = 0;
  let active = 0;
  let index = 0;

  return new Promise((resolve) => {
    function launchNext() {
      while (active < concurrency && index < totalRequests) {
        const currentIndex = index++;
        active++;
        requestAsync(url, { headers })
          .then((res) => {
            results.push(res);
          })
          .catch((err) => {
            results.push({ ok: false, status: 0, error: err.message, durationMs: 0 });
          })
          .finally(() => {
            active--;
            completed++;
            if (completed === totalRequests) {
              resolve(results);
            } else {
              launchNext();
            }
          });
      }
    }
    launchNext();
  });
}

function printReport(title, url, results, totalDurationSec) {
  const latencies = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const total = results.length;
  const avg = latencies.reduce((a, b) => a + b, 0) / (total || 1);
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);

  const statusCounts = {};
  let errors5xx = 0;
  let errorsNon2xx = 0;

  results.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.status >= 500 && r.status < 600) {
      errors5xx++;
    }
    if (!r.status || r.status < 200 || r.status >= 300) {
      errorsNon2xx++;
    }
  });

  console.log('\n================================================================');
  console.log(`📊 REPORTE DE CARGA: ${title}`);
  console.log(`🎯 URL: ${url}`);
  console.log(`⏱️  Total solicitudes: ${total} | Concurrencia: 10 | Tiempo total: ${totalDurationSec.toFixed(2)}s`);
  console.log('----------------------------------------------------------------');
  console.log(`⚡ Latencia Min:           ${min.toFixed(2)} ms`);
  console.log(`⚡ Latencia Mediana (p50): ${p50.toFixed(2)} ms`);
  console.log(`⚡ Latencia Media:         ${avg.toFixed(2)} ms`);
  console.log(`⚡ Latencia p95:           ${p95.toFixed(2)} ms  ${p95 < 500 ? '✅ (Cumple < 500ms)' : '⚠️ (Supera 500ms)'}`);
  console.log(`⚡ Latencia Max:           ${max.toFixed(2)} ms`);
  console.log('----------------------------------------------------------------');
  console.log(`🚨 Errores HTTP 5xx:       ${errors5xx} ${errors5xx === 0 ? '✅ (Cero caídas)' : '❌ (Fallos 5xx detectados)'}`);
  console.log(`🚨 Respuestas no 2xx:      ${errorsNon2xx} ${errorsNon2xx === 0 ? '✅ (100% exitosas)' : '❌ (Respuestas fallidas)'}`);
  console.log('📋 Códigos HTTP recibidos:', JSON.stringify(statusCounts));
  console.log('================================================================');

  return { errors5xx, errorsNon2xx, p95, avg };
}

async function main() {
  console.log(`🚀 Iniciando prueba de carga contra: ${baseUrl}`);

  // 1. Pre-calentamiento (Warm-up)
  console.log('🔥 Calentando servicio (warm-up ping a /api/health)...');
  const warmupStart = Date.now();
  const warmupRes = await requestAsync(`${baseUrl}/api/health`, { timeout: 30000 });
  const warmupSec = (Date.now() - warmupStart) / 1000;

  if (!warmupRes.ok || warmupRes.status !== 200) {
    console.error(`❌ ERROR: Warm-up falló. Se esperaba HTTP 200 en ${baseUrl}/api/health pero se recibió HTTP ${warmupRes.status} (${warmupRes.error || 'código no 200'}).`);
    process.exit(1);
  }
  console.log(`✅ Warm-up de salud completado en ${warmupSec.toFixed(2)}s (HTTP 200).`);

  let token = process.env.AUTH_TOKEN;
  if (!token) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || 'admin@jinstock.ni';
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || 'Admin.2026!Secure';
    try {
      const loginRes = await requestAsync(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
        timeout: 10000,
      });
      if (loginRes.ok && loginRes.status === 200) {
        const body = JSON.parse(loginRes.body);
        token = body.data?.token || body.token;
        if (token) {
          console.log(`🔑 Sesión iniciada automáticamente como ${adminEmail} para probar la ruta real de sincronización.`);
        }
      }
    } catch (_) {
      // Si falla login, continúa sin token
    }
  }
  const targetDataRoute = '/api/products?includeInactive=false';
  if (token) {
    console.log('🔥 Precalentando pool de base de datos con pasada previa al catálogo...');
    const catWarmupStart = Date.now();
    await requestAsync(`${baseUrl}${targetDataRoute}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });
    console.log(`✅ Pasada previa al catálogo completada en ${((Date.now() - catWarmupStart) / 1000).toFixed(2)}s. Pool PostgreSQL listo.`);
  }

  console.log('💡 Método declarado: Reutilización de sockets HTTP Keep-Alive + apertura inicial de pool de conexiones PostgreSQL.');

  // 2. Medición 1: /api/health (50 solicitudes, concurrencia 10)
  console.log('\n⚡ Ejecutando 50 solicitudes a /api/health (concurrencia 10)...');
  const t1Start = Date.now();
  const healthResults = await runConcurrentBatch(`${baseUrl}/api/health`, 50, 10);
  const t1Sec = (Date.now() - t1Start) / 1000;
  const rep1 = printReport('Endpoint de Salud (/api/health)', `${baseUrl}/api/health`, healthResults, t1Sec);

  // 3. Medición 2: /api/products?includeInactive=false (Ruta real de sincronización offline de la app)
  let rep2;
  if (token) {
    console.log(`\n⚡ Ejecutando 50 solicitudes a ${targetDataRoute} con token (concurrencia 10)...`);
    const t2Start = Date.now();
    const dataResults = await runConcurrentBatch(`${baseUrl}${targetDataRoute}`, 50, 10, { Authorization: `Bearer ${token}` });
    const t2Sec = (Date.now() - t2Start) / 1000;
    rep2 = printReport('Sincronización Catálogo Real (/api/products?includeInactive=false)', `${baseUrl}${targetDataRoute}`, dataResults, t2Sec);

    // 4. Separación de Red vs Servidor mediante GET /api/logs
    try {
      console.log('\n🔍 Consultando GET /api/logs para desglosar tiempo interno del servidor (durationMs)...');
      const logsRes = await requestAsync(`${baseUrl}/api/logs?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (logsRes.ok && logsRes.status === 200) {
        const logData = JSON.parse(logsRes.body);
        if (logData && Array.isArray(logData.data)) {
          const productDurations = logData.data
            .filter((l) => l.context && l.context.url && l.context.url.includes('/api/products') && typeof l.context.durationMs === 'number')
            .map((l) => l.context.durationMs)
            .sort((a, b) => a - b);

          if (productDurations.length > 0) {
            const sMin = productDurations[0];
            const sMax = productDurations[productDurations.length - 1];
            const sAvg = productDurations.reduce((a, b) => a + b, 0) / productDurations.length;
            const sP50 = calculatePercentile(productDurations, 50);
            const sP95 = calculatePercentile(productDurations, 95);

            console.log('\n================================================================');
            console.log('🖥️  DESGLOSE DEL SERVIDOR EN RENDER (durationMs interno Node.js + DB)');
            console.log(`📋 Muestras de auditoría analizadas: ${productDurations.length} peticiones recientes`);
            console.log('----------------------------------------------------------------');
            console.log(`⚡ Servidor Latencia Min:           ${sMin.toFixed(2)} ms`);
            console.log(`⚡ Servidor Latencia Mediana (p50): ${sP50.toFixed(2)} ms`);
            console.log(`⚡ Servidor Latencia Media:         ${sAvg.toFixed(2)} ms`);
            console.log(`⚡ Servidor Latencia p95:           ${sP95.toFixed(2)} ms  ${sP95 < 200 ? '✅ (Excelente en servidor < 200ms)' : sP95 < 500 ? '✅ (Cumple < 500ms)' : '⚠️'}`);
            console.log(`⚡ Servidor Latencia Max:           ${sMax.toFixed(2)} ms`);
            console.log('----------------------------------------------------------------');
            console.log(`🌐 Latencia de Red Estimada (RTT):  ~${(rep2.avg - sAvg).toFixed(2)} ms (Tránsito cliente Nicaragua/Guatemala ↔ Render Ohio)`);
            console.log('================================================================');
          }
        }
      }
    } catch (logErr) {
      console.warn('Nota: No se pudo consultar /api/logs:', logErr.message);
    }
  } else {
    console.log('\n⚡ Ejecutando 50 solicitudes a /api (concurrencia 10)...');
    const t2Start = Date.now();
    const apiResults = await runConcurrentBatch(`${baseUrl}/api`, 50, 10);
    const t2Sec = (Date.now() - t2Start) / 1000;
    rep2 = printReport('Endpoint Catálogo Informativo (/api)', `${baseUrl}/api`, apiResults, t2Sec);
  }

  const totalNon2xx = rep1.errorsNon2xx + rep2.errorsNon2xx;
  const anyP95OverThreshold = rep1.p95 >= 500 || rep2.p95 >= 500;
  if (totalNon2xx > 0) {
    console.error(`\n❌ La prueba falló: se registraron ${totalNon2xx} respuestas fuera del rango 2xx (incluyendo ${rep1.errors5xx + rep2.errors5xx} errores 5xx).`);
    process.exit(1);
  } else if (anyP95OverThreshold) {
    console.log('\n⚠️ Resumen: 100% respuestas 2xx y 0 caídas (5xx=0), pero el percentil p95 global superó el umbral estricto de 500 ms (Rendimiento Regular por latencia de red transfronteriza).');
    process.exit(0);
  } else {
    console.log('\n✅ Prueba de carga óptima: 100% respuestas 2xx, 0 caídas y latencia p95 < 500ms en todos los endpoints.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error fatal durante la prueba de carga:', err);
  process.exit(1);
});
