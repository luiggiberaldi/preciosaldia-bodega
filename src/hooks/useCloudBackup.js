import { useState } from 'react';
import { storageService } from '../utils/storageService';
import { showToast } from '../components/Toast';
import { supabaseCloud } from '../config/supabaseCloud';

/**
 * Hook that encapsulates all cloud backup/restore logic.
 *
 * @param {Object} params
 * @param {string}   params.deviceId
 * @param {Function} params.auditLog
 * @param {Function} params.forceHeartbeat
 * @param {Function} [params.triggerHaptic]
 * @param {string}   params.inputEmail       – bound email input value
 * @param {string}   params.inputPassword    – bound password input value
 * @param {string}   params.inputPhone       – bound phone input value
 * @param {boolean}  params.isCloudLogin     – true = login, false = register
 * @param {string}   params.businessName
 * @param {Function} params.setAdminCredentials
 * @param {Function} params.setEmailError
 * @param {Function} params.setPasswordError
 */
export function useCloudBackup({
    deviceId,
    auditLog,
    forceHeartbeat,
    triggerHaptic,
    inputEmail,
    inputPassword,
    inputPhone,
    isCloudLogin,
    businessName,
    setAdminCredentials,
    setEmailError,
    setPasswordError,
}) {
    const [importStatus, setImportStatus] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [deviceLimitError, setDeviceLimitError] = useState(null);
    const [blockedDevices, setBlockedDevices] = useState([]);
    const [dataConflictPending, setDataConflictPending] = useState(null);

    // ─── HELPER: Apply a cloud backup to local storage ───────────────────────
    // IMPORTANTE: usa storageService.setItem (instancia global de localforage)
    // NO usar localforage.createInstance() — genera una instancia separada que la app no lee
    const applyCloudBackup = async (cloudBackup) => {
        if (!cloudBackup?.data) {
            console.error('[applyCloudBackup] Backup inválido o sin datos:', cloudBackup);
            throw new Error('El backup de la nube está vacío o es inválido.');
        }
        if (cloudBackup.version === '2.0' && cloudBackup.data.idb) {
            const idbEntries = Object.entries(cloudBackup.data.idb);
            console.log(`[applyCloudBackup] Restaurando ${idbEntries.length} keys de IDB...`);
            for (const [key, value] of idbEntries) {
                await storageService.setItem(key, value);
                console.log(`[applyCloudBackup] ✓ ${key}`);
            }
        } else {
            console.warn('[applyCloudBackup] Formato no reconocido, intentando restauración legacy...');
        }
        if (cloudBackup.data.ls) {
            for (const [key, value] of Object.entries(cloudBackup.data.ls)) {
                localStorage.setItem(key, value);
            }
        }
        console.log('[applyCloudBackup] Restauración completa.');
    };

    // ─── HELPER: Collect local backup payload ────────────────────────────────
    const collectLocalBackup = async () => {
        const idbKeys = [
            'bodega_products_v1', 'my_categories_v1',
            'bodega_sales_v1', 'bodega_customers_v1',
            'bodega_suppliers_v1', 'bodega_supplier_invoices_v1',
            'bodega_accounts_v2', 'bodega_pending_cart_v1',
            'bodega_payment_methods_v1',
            'abasto_audit_log_v1'
        ];
        const idbData = {};
        for (const key of idbKeys) {
            const data = await storageService.getItem(key, null);
            if (data !== null) idbData[key] = data;
        }
        const lsKeys = [
            'premium_token', 'street_rate_bs', 'catalog_use_auto_usdt',
            'catalog_custom_usdt_price', 'catalog_show_cash_price',
            'monitor_rates_v12', 'business_name', 'business_rif',
            'printer_paper_width', 'allow_negative_stock', 'cop_enabled',
            'auto_cop_enabled', 'tasa_cop', 'bodega_use_auto_rate',
            'bodega_custom_rate', 'bodega_inventory_view', 'abasto-auth-storage'
        ];
        const lsData = {};
        for (const key of lsKeys) {
            const val = localStorage.getItem(key);
            if (val !== null) lsData[key] = val;
        }
        return {
            timestamp: new Date().toISOString(),
            version: '2.0',
            appName: 'TasasAlDia_Bodegas_Cloud',
            data: { idb: idbData, ls: lsData }
        };
    };

    // ─── HELPER: Upload local backup to cloud ────────────────────────────────
    const uploadLocalBackup = async (email, backupData) => {
        // 1. Respaldo Legacy Blobs
        const { error } = await supabaseCloud
            .from('cloud_backups')
            .upsert({
                email: email.toLowerCase(),
                backup_data: backupData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' });
        if (error) throw error;

        // 2. Inyección Inicial en Nuevo Sistema Realtime Sync
        try {
            const { data: { session } } = await supabaseCloud.auth.getSession();
            if (session?.user?.id) {
                const syncPayloads = [];
                for (const [key, value] of Object.entries(backupData.data.idb || {})) {
                    syncPayloads.push({
                        user_id: session.user.id,
                        collection: 'store',
                        doc_id: key,
                        data: { payload: value },
                        updated_at: new Date().toISOString()
                    });
                }
                // Incluir localStorage en P2P
                for (const [key, value] of Object.entries(backupData.data.ls || {})) {
                    let finalVal = value;
                    try { finalVal = JSON.parse(value); } catch { /* keep as string if not valid JSON */ } // Parsear localStorage (strings) a objetos si es posible
                    syncPayloads.push({
                        user_id: session.user.id,
                        collection: 'local',
                        doc_id: key,
                        data: { payload: finalVal },
                        updated_at: new Date().toISOString()
                    });
                }
                if (syncPayloads.length > 0) {
                    await supabaseCloud.from('sync_documents').upsert(syncPayloads, { onConflict: 'user_id,collection,doc_id' });
                }
            }
        } catch(syncErr) {
            console.warn('[Realtime Sync Init] Fallo inicializando sync_documents:', syncErr);
        }
    };

    // ─── HELPER: Register or update device in account_devices ─────────────────
    const registerDevice = async (email) => {
        await supabaseCloud.from('account_devices').upsert({
            email: email.toLowerCase(),
            device_id: deviceId || 'UNKNOWN',
            device_alias: `Dispositivo ${navigator.platform || 'Web'}`,
            last_seen: new Date().toISOString()
        }, { onConflict: 'email,device_id' });
    };

    // ─── HANDLER: Data conflict resolution ──────────────────────────────────
    const handleDataConflictChoice = async (choice) => {
        if (!dataConflictPending) return;
        const { email, cloudBackup, localBackup } = dataConflictPending;
        setDataConflictPending(null);
        setImportStatus('loading');
        setStatusMessage('Aplicando tu elección...');
        try {
            if (choice === 'cloud') {
                // Restore cloud data to this device
                await applyCloudBackup(cloudBackup);
                showToast('Datos de la nube restaurados. Reiniciando...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                // Upload local data to cloud (overwrite)
                await uploadLocalBackup(email, localBackup);
                showToast('Datos locales guardados en la nube', 'success');
            }
            setAdminCredentials(email, inputPassword);
            auditLog('NUBE', 'CONFLICTO_RESUELTO', `Conflicto datos resuelto: usuario eligió ${choice}`);
            setImportStatus(null);
        } catch (err) {
            showToast(err.message || 'Error al resolver el conflicto', 'error');
            setImportStatus('error');
        }
    };

    // ─── HANDLER: Desvincular dispositivo más antiguo y reintentar ────────────
    const handleUnlinkOldestDevice = async () => {
        if (!blockedDevices.length || !inputEmail) return;
        setImportStatus('loading');
        setStatusMessage('Desvinculando dispositivo más antiguo...');
        try {
            // Sort by created_at ascending, remove the oldest
            const oldest = [...blockedDevices].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
            await supabaseCloud.from('account_devices')
                .delete()
                .eq('email', inputEmail.toLowerCase())
                .eq('device_id', oldest.device_id);
            setDeviceLimitError(null);
            setBlockedDevices([]);
            showToast(`"${oldest.device_alias}" desvinculado. Volviendo a conectar...`, 'success');
            await handleSaveCloudAccount();
        } catch (err) {
            showToast(err.message || 'Error al desvincular', 'error');
            setImportStatus('error');
        }
    };

    const handleSaveCloudAccount = async () => {
        // Reset errors
        setEmailError('');
        setPasswordError('');
        setDeviceLimitError(null);
        setBlockedDevices([]);

        let hasError = false;
        if (!inputEmail.includes('@')) {
            setEmailError('Formato de correo no válido');
            hasError = true;
        }
        if (inputPassword.length < 6) {
            setPasswordError('Mínimo 6 caracteres para mayor seguridad');
            hasError = true;
        }
        if (!isCloudLogin && !inputPhone.trim()) {
            showToast('El teléfono es obligatorio para registrarse', 'error');
            hasError = true;
        }
        if (hasError) {
            triggerHaptic?.();
            return;
        }

        const emailToUse = inputEmail.trim().toLowerCase();

        try {
            setImportStatus('loading');
            setStatusMessage('Autenticando en la nube...');

            // ── 1. Supabase Auth ────────────────────────────────────────────────
            if (supabaseCloud) {
                if (isCloudLogin) {
                    const { error: err } = await supabaseCloud.auth.signInWithPassword({
                        email: emailToUse,
                        password: inputPassword,
                    });
                    if (err) throw new Error('Error al iniciar sesión: ' + err.message);
                } else {
                    const { data, error: err } = await supabaseCloud.auth.signUp({
                        email: emailToUse,
                        password: inputPassword,
                        options: { data: { full_name: businessName || 'Bodega', phone: inputPhone } },
                    });
                    if (err) {
                        if (err.message.includes('already registered') || err.message.includes('User already registered')) {
                            throw new Error('Este correo ya está registrado. Selecciona "Entrar".');
                        }
                        throw new Error('Error en el registro: ' + err.message);
                    }
                    if (data?.user?.identities?.length === 0) throw new Error('Este correo ya está registrado. Selecciona "Entrar".');
                    if (data?.user && !data.session) {
                        showToast('Por favor, revisa tu correo y confirma tu cuenta.', 'success');
                        setImportStatus('awaiting_email_confirmation');
                        setStatusMessage('Por favor confirma tu correo...');
                        return;
                    }
                }
            }

            // ── 2. Control de dispositivos (máx. 2) ─────────────────────────────
            setStatusMessage('Verificando dispositivos autorizados...');
            const { data: existingDevices, error: devErr } = await supabaseCloud
                .from('account_devices')
                .select('*')
                .eq('email', emailToUse)
                .order('created_at', { ascending: true });

            if (!devErr && existingDevices) {
                const myDeviceRegistered = existingDevices.find(d => d.device_id === (deviceId || 'UNKNOWN'));
                const activeCount = existingDevices.length;

                if (!myDeviceRegistered && activeCount >= 2) {
                    // ❌ Límite alcanzado - mostrar error con opción de desvincular
                    setDeviceLimitError({ devices: existingDevices });
                    setBlockedDevices(existingDevices);
                    setImportStatus('error');
                    setStatusMessage('Límite de dispositivos alcanzado.');
                    triggerHaptic?.();
                    return;
                }
            }

            // ── 3. Fetch backup en la nube ───────────────────────────────────────
            setStatusMessage('Consultando backup en la nube...');
            const { data: cloudRow } = await supabaseCloud
                .from('cloud_backups')
                .select('backup_data')
                .eq('email', emailToUse)
                .maybeSingle();

            const cloudBackup = cloudRow?.backup_data || null;

            // ── 4. Recolectar datos locales ──────────────────────────────────────
            const localBackup = await collectLocalBackup();
            const hasLocalData = Object.keys(localBackup.data.idb).length > 0;
            const hasCloudData = cloudBackup && cloudBackup.data;

            if (isCloudLogin && hasCloudData && hasLocalData) {
                // ⚠️ Conflicto: ambos tienen datos → preguntar al usuario
                setDataConflictPending({ email: emailToUse, cloudBackup, localBackup });
                await registerDevice(emailToUse);
                setAdminCredentials(emailToUse, inputPassword);
                setImportStatus(null);
                setStatusMessage('');
                auditLog('NUBE', 'LOGIN_NUBE', `Login exitoso: ${emailToUse}`);
                return; // Modal de conflicto se muestra, usuario elige
            }

            if (isCloudLogin && hasCloudData && !hasLocalData) {
                // 🆕 Dispositivo nuevo/vacío: restaurar automáticamente
                setStatusMessage('Restaurando backup de la nube...');
                await applyCloudBackup(cloudBackup);
                await registerDevice(emailToUse);
                setAdminCredentials(emailToUse, inputPassword);
                showToast('Datos restaurados automáticamente desde la nube', 'success');
                auditLog('NUBE', 'RESTORE_AUTO', `Backup restaurado automaticamente para: ${emailToUse}`);
                triggerHaptic?.();
                setImportStatus('success');
                setStatusMessage('Restauración completa. Reiniciando...');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            // ── 5. Subir datos locales a la nube (flujo normal) ─────────────────
            setStatusMessage('Guardando y sincronizando datos locales...');
            if (supabaseCloud) {
                await uploadLocalBackup(emailToUse, localBackup);

                // Registrar licencia inicial (Estación Maestra)
                try {
                    await supabaseCloud.from('cloud_licenses').upsert({
                        email: emailToUse,
                        device_id: deviceId || 'UNKNOWN_DEVICE',
                        license_type: 'trial',
                        days_remaining: 15,
                        business_name: businessName || 'Bodega',
                        phone: inputPhone || '',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'email' });
                } catch (licErr) {
                    console.warn('Licencia cloud skip:', licErr);
                }

                await registerDevice(emailToUse);
            }

            setAdminCredentials(emailToUse, inputPassword);
            showToast(isCloudLogin ? 'Sesión iniciada y sincronizada' : 'Cuenta confirmada y sincronizada', 'success');
            auditLog('NUBE', isCloudLogin ? 'LOGIN_NUBE' : 'REGISTRO_NUBE', `Sincronización completa: ${emailToUse}`);
            triggerHaptic?.();
            setImportStatus(null);

        } catch (error) {
            console.error('Error sincronizando con la nube:', error);
            showToast(error.message || 'Hubo un error contactando la nube', 'error');
            setImportStatus('error');
        }
    };

    return {
        importStatus,
        setImportStatus,
        statusMessage,
        setStatusMessage,
        deviceLimitError,
        setDeviceLimitError,
        blockedDevices,
        setBlockedDevices,
        dataConflictPending,
        setDataConflictPending,
        applyCloudBackup,
        collectLocalBackup,
        uploadLocalBackup,
        handleSaveCloudAccount,
        handleDataConflictChoice,
        handleUnlinkOldestDevice,
    };
}
