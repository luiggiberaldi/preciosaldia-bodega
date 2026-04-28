import { DurableObject } from "cloudflare:workers";

// ─── Durable Object: almacenamiento de códigos de compartir ──────────────────
export class ShareStorage extends DurableObject {
  sql = this.ctx.storage.sql;

  constructor(ctx, env) {
    super(ctx, env);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS share_codes (
        code TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        expires_at INTEGER NOT NULL
      )
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS rates_cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    // Limpiar códigos expirados al inicio
    this.sql.exec(`DELETE FROM share_codes WHERE expires_at < unixepoch()`);
  }

  async getRatesCache() {
    const row = this.sql.exec(`SELECT data, updated_at FROM rates_cache WHERE key = 'bcv'`).one();
    if (!row) return null;
    const ageMs = (Date.now() / 1000 - row.updated_at) * 1000;
    if (ageMs > 14 * 60 * 1000) return null; // stale after 14 min
    return JSON.parse(row.data);
  }

  async setRatesCache(data) {
    this.sql.exec(
      `INSERT OR REPLACE INTO rates_cache (key, data, updated_at) VALUES ('bcv', ?, ?)`,
      JSON.stringify(data), Math.floor(Date.now() / 1000)
    );
  }

  async store(code, payload, ttlSeconds = 86400) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    this.sql.exec(
      `INSERT OR REPLACE INTO share_codes (code, data, expires_at) VALUES (?, ?, ?)`,
      code, JSON.stringify(payload), expiresAt
    );
  }

  async retrieve(code) {
    this.sql.exec(`DELETE FROM share_codes WHERE expires_at < unixepoch()`);
    const row = this.sql.exec(
      `SELECT data FROM share_codes WHERE code = ? AND expires_at >= unixepoch()`,
      code
    ).one();
    return row ? JSON.parse(row.data) : null;
  }

  async exists(code) {
    const row = this.sql.exec(
      `SELECT 1 FROM share_codes WHERE code = ? AND expires_at >= unixepoch()`,
      code
    ).one();
    return !!row;
  }
}

// ─── Handler de la API /api/rates ────────────────────────────────────────────
async function handleRates(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const storage = env.SHARE_STORAGE.get(env.SHARE_STORAGE.idFromName('global'));

  // Return cached rates if fresh (< 14 min)
  const cached = await storage.getRatesCache();
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }

  // Fetch fresh rates from dolarapi (public, no key required)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`dolarapi ${res.status}`);

    const data = await res.json();
    const oficial = Array.isArray(data) ? data.find(d => d.fuente === 'oficial' || d.nombre === 'Oficial') : null;
    const paralelo = Array.isArray(data) ? data.find(d => d.fuente === 'paralelo' || d.nombre === 'Paralelo') : null;

    if (!oficial?.promedio) throw new Error('No se obtuvo tasa oficial');

    const bcvPrice = parseFloat(oficial.promedio);
    const euroPrice = parseFloat(paralelo?.promedio || oficial.promedio * 1.09);

    const rates = {
      bcv: { price: bcvPrice, source: 'BCV Oficial', change: 0 },
      euro: { price: euroPrice, source: 'Euro BCV', change: 0 },
      lastUpdate: new Date().toISOString(),
    };

    await storage.setRatesCache(rates);

    return new Response(JSON.stringify(rates), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
    });
  } catch (err) {
    // Return stale cache if fetch fails
    const stale = await storage.getRatesCache().catch(() => null);
    if (stale) {
      return new Response(JSON.stringify({ ...stale, stale: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE' }
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo obtener la tasa de cambio.' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ─── Handler de la API /api/share ────────────────────────────────────────────
async function handleShare(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const storage = env.SHARE_STORAGE.get(env.SHARE_STORAGE.idFromName('global'));

  try {
    // POST — Guardar backup completo y generar código
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Cuerpo de la solicitud inválido.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { products, categories, idb, ls } = body;

      // Aceptar formato completo (idb + ls) o formato legado (products)
      if (!idb && (!products || !Array.isArray(products) || products.length === 0)) {
        return new Response(
          JSON.stringify({ error: 'No hay datos para compartir.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Construir payload
      const payload = idb
        ? { idb, ls: ls || {}, isComplete: true, groups: Array.isArray(body.groups) ? body.groups : [], createdAt: new Date().toISOString() }
        : { products, categories: categories || null, groups: [], createdAt: new Date().toISOString() };

      // Validar tamaño (máximo 10MB)
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.length > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: `Datos demasiado grandes (${(payloadStr.length / 1024 / 1024).toFixed(1)}MB). Máximo: 10MB.` }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generar código único de 6 dígitos
      let code;
      let attempts = 0;
      do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const exists = await storage.exists(code);
        if (!exists) break;
        attempts++;
      } while (attempts < 5);

      await storage.store(code, payload);

      const productCount = idb
        ? (idb.bodega_products_v1?.length ?? 0)
        : products.length;

      return new Response(
        JSON.stringify({
          code: `${code.slice(0, 3)}-${code.slice(3)}`,
          expiresIn: '24 horas',
          isComplete: !!idb,
          productCount,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET — Obtener backup por código
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const rawCode = url.searchParams.get('code') || '';
      const code = rawCode.replace(/[-\s]/g, '');

      if (code.length !== 6 || !/^\d+$/.test(code)) {
        return new Response(
          JSON.stringify({ error: 'Código inválido. Usa el formato XXX-XXX.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await storage.retrieve(code);

      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Código no encontrado o expirado.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método no permitido.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Share API] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Worker principal ─────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/rates') {
      return handleRates(request, env);
    }

    if (url.pathname === '/api/share') {
      return handleShare(request, env);
    }

    // Archivos que NUNCA deben cachearse en el CDN:
    // - index.html: si se cachea, los usuarios no reciben la nueva versión de la app
    // - sw.js / registerSW.js / workbox-*: si se cachean, el SW no detecta actualizaciones
    // - manifest.webmanifest: puede cambiar entre deploys
    const noCacheFiles = ['/', '/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest'];
    const isWorkbox = url.pathname.startsWith('/workbox-');
    if (noCacheFiles.includes(url.pathname) || isWorkbox) {
      const response = await env.ASSETS.fetch(request);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newResponse.headers.set('Pragma', 'no-cache');
      newResponse.headers.set('Expires', '0');
      return newResponse;
    }

    return env.ASSETS.fetch(request);
  }
};
