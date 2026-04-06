import { useEffect, useRef } from 'react';
import { storageService } from '../utils/storageService';
import { supabaseCloud } from '../config/supabaseCloud';

// ─── Configuración optimizada ───────────────────────────────────────────────
const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const BACKUP_KEY = 'bodega_autobackup_v1';
const LAST_UPLOAD_HASH_KEY = 'bodega_last_upload_hash';

const IDB_KEYS = [
    'bodega_products_v1',
    'my_categories_v1',
    'bodega_sales_v1',
    'bodega_customers_v1',
    'bodega_suppliers_v1',
    'bodega_supplier_invoices_v1',
    'bodega_accounts_v2',
    'bodega_pending_cart_v1',
    'bodega_payment_methods_v1',
    'abasto_audit_log_v1',
];

const LS_KEYS = [
    'premium_token', 'street_rate_bs', 'catalog_use_auto_usdt',
    'catalog_custom_usdt_price', 'catalog_show_cash_price',
    'monitor_rates_v12', 'business_name', 'business_rif',
    'printer_paper_width', 'allow_negative_stock', 'cop_enabled',
    'auto_cop_enabled', 'tasa_cop', 'bodega_use_auto_rate',
    'bodega_custom_rate', 'bodega_inventory_view', 'abasto-auth-storage',
];

/** Hash ligero para detectar cambios sin comparar objetos enteros */
function quickHash(obj) {
    const str = JSON.stringify(obj) ?? '';
    let h = 0;
    for (let i = 0; i < Math.min(str.length, 5000); i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return `${str.length}_${h >>> 0}`;
}

export function useAutoBackup(isPremium, isDemo, deviceId) {
    const intervalRef = useRef(null);
    // Ref para que el handler de Realtime pueda llamar a performBackup
    const performBackupRef = useRef(null);

    useEffect(() => {
        const performBackup = async (forceUpload = false) => {
            try {
                // ── Recolectar IndexedDB ───────────────────────────────────
                const idbData = {};
                let hasData = false;
                for (const key of IDB_KEYS) {
                    const val = await storageService.getItem(key, null);
                    if (val !== null) { idbData[key] = val; hasData = true; }
                }

                if (!hasData) return;

                // ── Recolectar localStorage ────────────────────────────────
                const lsData = {};
                for (const key of LS_KEYS) {
                    const val = localStorage.getItem(key);
                    if (val !== null) lsData[key] = val;
                }

                // ── Backup completo (formato v2.0) ─────────────────────────
                const fullBackup = {
                    timestamp: new Date().toISOString(),
                    version: '2.0',
                    appName: 'TasasAlDia_Bodegas',
                    device: navigator.userAgent?.substring(0, 80),
                    data: { idb: idbData, ls: lsData }
                };

                // Guardar copia local
                await storageService.setItem(BACKUP_KEY, fullBackup);

                // Subir a la nube
                if (isPremium && !isDemo && deviceId && supabaseCloud) {
                    const currentHash = quickHash(idbData);
                    const lastHash = localStorage.getItem(LAST_UPLOAD_HASH_KEY);

                    // forceUpload=true omite la verificación de hash (solicitud manual)
                    if (!forceUpload && currentHash === lastHash) return;

                    await supabaseCloud.from('cloud_backups').upsert({
                        device_id: deviceId,
                        backup_data: fullBackup,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'device_id' });

                    localStorage.setItem(LAST_UPLOAD_HASH_KEY, currentHash);
                }

            } catch (e) {
                console.error('[AutoBackup] Error:', e);
            }
        };

        performBackupRef.current = performBackup;

        // Primer backup 30s después del arranque
        const initialTimer = setTimeout(performBackup, 30000);

        // Backup cada 30 minutos
        intervalRef.current = setInterval(performBackup, BACKUP_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPremium, isDemo, deviceId]);

    // ── Suscripción a solicitudes de backup en tiempo real ─────────────────
    useEffect(() => {
        if (!deviceId || !supabaseCloud) return;

        const channel = supabaseCloud
            .channel(`backup_request_${deviceId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'backup_requests',
                filter: `device_id=eq.${deviceId}`
            }, async (payload) => {
                if (payload.new?.status === 'pending') {
                    console.log('[AutoBackup] Solicitud de backup recibida. Ejecutando...');
                    await performBackupRef.current?.(true); // forzar subida
                    await supabaseCloud.from('backup_requests').update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    }).eq('device_id', deviceId);
                    console.log('[AutoBackup] Backup en tiempo real completado.');
                }
            })
            .subscribe();

        return () => channel.unsubscribe();
    }, [deviceId]);
}

// Restaurar desde backup local (para emergencias)
export async function restoreFromBackup() {
    const backup = await storageService.getItem('bodega_autobackup_v1', null);
    if (!backup?.data) return null;

    if (backup.version === '2.0' && backup.data.idb) {
        for (const [key, val] of Object.entries(backup.data.idb)) {
            await storageService.setItem(key, val);
        }
        if (backup.data.ls) {
            for (const [key, val] of Object.entries(backup.data.ls)) {
                localStorage.setItem(key, val);
            }
        }
        return {
            restoredKeys: [...Object.keys(backup.data.idb), ...Object.keys(backup.data.ls)],
            backupTime: new Date(backup.timestamp).toLocaleString('es-VE'),
        };
    }

    // Fallback formato legacy
    for (const [key, val] of Object.entries(backup.data)) {
        await storageService.setItem(key, val);
    }
    return {
        restoredKeys: Object.keys(backup.data),
        backupTime: new Date(backup.timestamp).toLocaleString('es-VE'),
    };
}
