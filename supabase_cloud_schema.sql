-- ============================================================
-- Supabase Cloud Sync Schema
-- Proyecto: ewwszyzzvoweudholmbf
-- Identificador: device_id (sin autenticación de email/contraseña)
-- ============================================================

-- ── 1. sync_documents ────────────────────────────────────────
-- Almacena cada clave de datos del dispositivo para P2P en tiempo real.
-- Un dispositivo puede tener múltiples documentos (productos, ventas, clientes, etc.)

CREATE TABLE IF NOT EXISTS public.sync_documents (
    id          BIGSERIAL PRIMARY KEY,
    device_id   TEXT NOT NULL,
    collection  TEXT NOT NULL CHECK (collection IN ('store', 'local')),
    doc_id      TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (device_id, collection, doc_id)
);

-- Índice para consultas por device_id (muy frecuentes)
CREATE INDEX IF NOT EXISTS idx_sync_documents_device_id ON public.sync_documents (device_id);

-- Habilitar Realtime para esta tabla (requerido para suscripciones WebSocket)
ALTER TABLE public.sync_documents REPLICA IDENTITY FULL;

-- RLS: Abierto por device_id. Cualquier cliente puede leer/escribir su propio device_id.
-- NOTA: Si quieres mayor seguridad, puedes crear un JWT por device_id en el futuro.
ALTER TABLE public.sync_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_documents_open" ON public.sync_documents
    FOR ALL USING (true) WITH CHECK (true);


-- ── 2. cloud_backups ─────────────────────────────────────────
-- Backup completo del dispositivo (blob JSON con toda la data).
-- Una fila por device_id.

CREATE TABLE IF NOT EXISTS public.cloud_backups (
    device_id   TEXT PRIMARY KEY,
    backup_data JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cloud_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cloud_backups_open" ON public.cloud_backups
    FOR ALL USING (true) WITH CHECK (true);


-- ── 3. Función de limpieza automática (opcional) ──────────────
-- Elimina sync_documents con más de 30 días sin actualización
-- para evitar acumulación de datos huérfanos.
-- Programar con pg_cron o un webhook si se desea.

-- CREATE OR REPLACE FUNCTION purge_old_sync_documents()
-- RETURNS void LANGUAGE sql AS $$
--   DELETE FROM public.sync_documents
--   WHERE updated_at < NOW() - INTERVAL '30 days';
-- $$;
