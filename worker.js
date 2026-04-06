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
    // Limpiar códigos expirados al inicio
    this.sql.exec(`DELETE FROM share_codes WHERE expires_at < unixepoch()`);
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
        ? { idb, ls: ls || {}, isComplete: true, createdAt: new Date().toISOString() }
        : { products, categories: categories || null, createdAt: new Date().toISOString() };

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

    if (url.pathname === '/api/share') {
      return handleShare(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
