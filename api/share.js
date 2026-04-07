// Vercel Serverless Function — Relay de inventario con código de 6 dígitos
// Storage: Supabase (tabla shares) — sin dependencia de Upstash Redis

const SUPABASE_URL = process.env.SUPABASE_CLOUD_URL;
const SUPABASE_KEY = process.env.SUPABASE_CLOUD_KEY;
const TTL_HOURS = 24;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB

async function supabase(method, path, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        method,
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: method === 'POST' ? 'return=representation' : '',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
    const origin = req.headers?.origin || '';
    const allowed =
        origin.includes('localhost') ||
        origin.includes('vercel.app') ||
        origin.includes('tasasaldia') ||
        origin.includes('preciosaldia') ||
        origin.includes('github.io');
    res.setHeader('Access-Control-Allow-Origin', allowed ? origin : '');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({
            error: 'Supabase no configurado. Agrega SUPABASE_CLOUD_URL y SUPABASE_CLOUD_KEY en las variables de entorno de Vercel.',
        });
    }

    try {
        // POST — Compartir
        if (req.method === 'POST') {
            const body = req.body;
            const payloadStr = JSON.stringify(body);

            if (payloadStr.length > MAX_PAYLOAD_BYTES) {
                return res.status(413).json({
                    error: `Payload demasiado grande (${(payloadStr.length / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB.`,
                });
            }

            // Contar productos
            let productCount = 0;
            if (body?.idb?.bodega_products_v1) {
                productCount = Array.isArray(body.idb.bodega_products_v1) ? body.idb.bodega_products_v1.length : 0;
            } else if (Array.isArray(body?.products)) {
                productCount = body.products.length;
            }

            // Generar código único
            let code;
            for (let i = 0; i < 10; i++) {
                const candidate = generateCode();
                const check = await supabase('GET', `/shares?code=eq.${candidate}&select=code`);
                if (!check.data || check.data.length === 0) { code = candidate; break; }
            }
            if (!code) return res.status(500).json({ error: 'No se pudo generar un código único.' });

            const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString();
            const payload = JSON.stringify({ ...body, isComplete: !!(body.idb), createdAt: new Date().toISOString() });

            const insert = await supabase('POST', '/shares', { code, payload, expires_at: expiresAt });
            if (!insert.ok) throw new Error(JSON.stringify(insert.data));

            return res.status(200).json({
                code: `${code.slice(0, 3)}-${code.slice(3)}`,
                expiresIn: '24 horas',
                productCount,
            });
        }

        // GET — Importar
        if (req.method === 'GET') {
            const rawCode = req.query.code || '';
            const clean = rawCode.replace(/[-\s]/g, '');

            if (clean.length !== 6 || !/^\d+$/.test(clean)) {
                return res.status(400).json({ error: 'Código inválido. Usa el formato XXX-XXX.' });
            }

            const now = new Date().toISOString();
            const result = await supabase('GET', `/shares?code=eq.${clean}&expires_at=gt.${now}&select=payload&limit=1`);

            if (!result.ok || !result.data || result.data.length === 0) {
                return res.status(404).json({ error: 'Código no encontrado o expirado.' });
            }

            return res.status(200).json(JSON.parse(result.data[0].payload));
        }

        return res.status(405).json({ error: 'Método no permitido.' });
    } catch (err) {
        console.error('Share API error:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}
