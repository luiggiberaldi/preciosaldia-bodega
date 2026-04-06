import { useEffect, useRef } from 'react';
import { supabaseCloud } from '../config/supabaseCloud';
import { storageService } from '../utils/storageService';

const IDB_KEYS = [
    'bodega_products_v1', 'my_categories_v1',
    'bodega_sales_v1', 'bodega_customers_v1',
    'bodega_suppliers_v1', 'bodega_supplier_invoices_v1',
    'bodega_accounts_v2', 'bodega_pending_cart_v1',
    'bodega_payment_methods_v1', 'abasto_audit_log_v1'
];
const LS_KEYS = [
    'premium_token', 'street_rate_bs', 'catalog_use_auto_usdt',
    'catalog_custom_usdt_price', 'catalog_show_cash_price',
    'monitor_rates_v12', 'business_name', 'business_rif',
    'printer_paper_width', 'allow_negative_stock', 'cop_enabled',
    'auto_cop_enabled', 'tasa_cop', 'bodega_use_auto_rate',
    'bodega_custom_rate', 'bodega_inventory_view', 'abasto-auth-storage'
];

async function collectAndUpload(deviceId) {
    // Recolectar datos locales
    const idbData = {};
    for (const key of IDB_KEYS) {
        const data = await storageService.getItem(key, null);
        if (data !== null) idbData[key] = data;
    }
    const lsData = {};
    for (const key of LS_KEYS) {
        const val = localStorage.getItem(key);
        if (val !== null) lsData[key] = val;
    }
    const backupData = {
        timestamp: new Date().toISOString(),
        version: '2.0',
        appName: 'TasasAlDia_Bodegas_Cloud',
        data: { idb: idbData, ls: lsData }
    };

    // Subir a cloud_backups
    const { error } = await supabaseCloud
        .from('cloud_backups')
        .upsert({ device_id: deviceId, backup_data: backupData, updated_at: new Date().toISOString() },
            { onConflict: 'device_id' });
    if (error) throw error;
}

/**
 * Escucha solicitudes de backup remoto desde la Estación Maestra.
 * Cuando llega una solicitud (status='pending'), sube el backup y la marca como completada.
 */
export function useRemoteBackupListener(deviceId) {
    const subRef = useRef(null);

    useEffect(() => {
        if (!supabaseCloud || !deviceId) return;

        const handleRequest = async () => {
            try {
                await collectAndUpload(deviceId);
                await supabaseCloud
                    .from('backup_requests')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('device_id', deviceId);
                console.log('[RemoteBackup] Backup enviado al admin.');
            } catch (err) {
                console.error('[RemoteBackup] Error al responder solicitud:', err);
                await supabaseCloud
                    .from('backup_requests')
                    .update({ status: 'error' })
                    .eq('device_id', deviceId)
                    .catch(() => {});
            }
        };

        // Verificar si hay una solicitud pendiente al conectar
        supabaseCloud
            .from('backup_requests')
            .select('status')
            .eq('device_id', deviceId)
            .single()
            .then(({ data }) => { if (data?.status === 'pending') handleRequest(); })
            .catch(() => {});

        // Suscribirse a nuevas solicitudes en tiempo real
        subRef.current = supabaseCloud
            .channel(`remote_backup:${deviceId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'backup_requests',
                filter: `device_id=eq.${deviceId}`,
            }, async (payload) => {
                if (payload.new?.status === 'pending') await handleRequest();
            })
            .subscribe();

        return () => {
            subRef.current?.unsubscribe();
            subRef.current = null;
        };
    }, [deviceId]);
}
