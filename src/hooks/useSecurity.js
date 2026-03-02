import { useState, useEffect, useCallback } from 'react';
import { storageService } from '../utils/storageService';
import { createClient } from '@supabase/supabase-js';

const APP_VERSION = '1.0.0';
const PRODUCT_ID = 'bodega';

// FIX 1: Salt desde variable de entorno
const MASTER_SECRET_KEY = import.meta.env.VITE_LICENSE_SALT;
const DEMO_DURATION_MS = 168 * 60 * 60 * 1000; // 168 horas (7 días)

// FIX 2: Ofuscación XOR + btoa para tokens en localStorage
const XOR_KEY = 'PDA_SEC_2026';

const encodeToken = (str) => {
    try {
        const xored = str.split('').map((c, i) =>
            String.fromCharCode(
                c.charCodeAt(0) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length)
            )
        ).join('');
        return btoa(unescape(encodeURIComponent(xored)));
    } catch { return str; }
};

const decodeToken = (encoded) => {
    try {
        const xored = decodeURIComponent(escape(atob(encoded)));
        return xored.split('').map((c, i) =>
            String.fromCharCode(
                c.charCodeAt(0) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length)
            )
        ).join('');
    } catch { return encoded; }
};


let supabaseClient = null;
function getSupa() {
    if (!supabaseClient && import.meta.env.VITE_SUPABASE_URL) {
        supabaseClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY
        );
    }
    if (!supabaseClient) throw new Error("No supabase");
    return supabaseClient;
}

export function useSecurity() {
    const [deviceId, setDeviceId] = useState('');
    const [isPremium, setIsPremium] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [demoExpires, setDemoExpires] = useState(null);
    const [demoExpiredMsg, setDemoExpiredMsg] = useState('');
    const [demoTimeLeft, setDemoTimeLeft] = useState('');
    // FIX 3: demoUsed como estado, leído desde IndexedDB
    const [demoUsed, setDemoUsed] = useState(false);

    // Calcular tiempo restante formateado
    const updateTimeLeft = useCallback((expiresAt) => {
        if (!expiresAt) { setDemoTimeLeft(''); return; }
        const diff = expiresAt - Date.now();
        if (diff <= 0) { setDemoTimeLeft(''); return; }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) setDemoTimeLeft(`${days}d ${hours}h`);
        else if (hours > 0) setDemoTimeLeft(`${hours}h ${mins}m`);
        else setDemoTimeLeft(`${mins}m`);
    }, []);

    useEffect(() => {
        // 1. Obtener o Generar Device ID a través de fingerprinting
        const generateFingerprint = async () => {
            const nav = window.navigator;
            const screen = window.screen;

            const components = [
                nav.userAgent,
                nav.language,
                nav.hardwareConcurrency || 1,
                nav.deviceMemory || 1,
                screen.width,
                screen.height,
                screen.colorDepth,
                new Date().getTimezoneOffset()
            ].join('|');

            if (!window.crypto || !window.crypto.subtle) {
                // Fallback (solo en http sin SSL)
                let hash = 0;
                for (let i = 0; i < components.length; i++) {
                    hash = ((hash << 5) - hash) + components.charCodeAt(i);
                    hash |= 0;
                }
                const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
                return `PDA-${hex}`;
            }

            // Mismo hardware = mismo hash SHA-256
            const encoder = new TextEncoder();
            const data = encoder.encode(components);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().substring(0, 8);
            return `PDA-${hex}`;
        };

        const initDeviceId = async () => {
            let storedId = localStorage.getItem('pda_device_id');
            if (!storedId) {
                storedId = await generateFingerprint();
                localStorage.setItem('pda_device_id', storedId);
            }
            setDeviceId(storedId);
            checkLicense(storedId);
        };

        initDeviceId();

        // FIX 3: Leer demo flag desde IndexedDB
        storageService.getItem('pda_demo_flag_v1', null).then(r => {
            if (r?.used) setDemoUsed(true);
        });
    }, []);

    // Heartbeat silencioso cada 4h + chequeo de revocación
    useEffect(() => {
        if (!isPremium || !deviceId || !import.meta.env.VITE_SUPABASE_URL) return

        // Función de chequeo rápido de estado
        const verifyStatus = async () => {
            try {
                const supa = getSupa();

                const { data: license } = await supa
                    .from('licenses')
                    .select('active, type')
                    .eq('device_id', deviceId)
                    .eq('product_id', PRODUCT_ID)
                    .maybeSingle()

                if (license && license.active === false && isPremium) {
                    // Revocado
                    localStorage.removeItem('pda_premium_token');
                    setIsPremium(false);
                    setIsDemo(false);
                    setDemoExpiredMsg("Tu licencia ha sido desactivada. Contacta al administrador.");
                } else if (license && license.active === true) {
                    // Si pasó a permanente en backend pero el estado local es demo -> recargar
                    if (license.type === 'permanent' && isDemo) {
                        localStorage.removeItem('pda_premium_token');
                        window.location.reload();
                    } else if (!isPremium) {
                        // Reactivado remotamente -> Recargar para restaurar
                        window.location.reload();
                    }
                }
            } catch (e) { }
        }

        const sendHeartbeat = async () => {
            verifyStatus(); // Chequeo constante
            try {
                const supa = getSupa();
                // Actualizar last_seen
                await supa.from('licenses')
                    .update({ last_seen_at: new Date().toISOString() })
                    .eq('device_id', deviceId)
                    .eq('product_id', PRODUCT_ID)

                // Registrar heartbeat record
                await supa.from('heartbeats').insert({
                    device_id: deviceId,
                    product_id: PRODUCT_ID,
                    app_version: APP_VERSION,
                })
            } catch (e) { }
        }

        // 1. Ejecutar heartbeat completo al montar y cada 4 horas
        sendHeartbeat();
        const heartbeatInterval = setInterval(sendHeartbeat, 4 * 60 * 60 * 1000);

        // 2. Poll de estado cada 1 minuto para revocaciones rápidas
        const statusInterval = setInterval(verifyStatus, 60 * 1000);

        // 3. Revisar apenas el usuario regrese a la app
        const handleVisibility = () => { if (document.visibilityState === 'visible') verifyStatus(); };
        document.addEventListener('visibilitychange', handleVisibility);

        // 4. Supabase Realtime (Si está habilitado en la tabla)
        let subscription = null;
        try {
            const supa = getSupa();
            subscription = supa.channel(`licenses_sync_${deviceId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'licenses', filter: `device_id=eq.${deviceId}` },
                    (payload) => {
                        verifyStatus(); // Si hay un cambio, verificar inmediatamente
                    }
                )
                .subscribe();
        } catch (e) { }

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(statusInterval);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (subscription) subscription.unsubscribe();
        }
    }, [isPremium, deviceId])

    // Countdown timer para demo
    useEffect(() => {
        if (!isDemo || !demoExpires) return;
        updateTimeLeft(demoExpires);
        const interval = setInterval(() => {
            const diff = demoExpires - Date.now();
            if (diff <= 0) {
                // Demo expiró en tiempo real
                clearInterval(interval);
                localStorage.removeItem('pda_premium_token');
                setIsPremium(false);
                setIsDemo(false);
                setDemoTimeLeft('');
                setDemoExpiredMsg("Tu licencia temporal ha finalizado. Esperamos que hayas disfrutado la experiencia completa.");
            } else {
                updateTimeLeft(demoExpires);
            }
        }, 60000); // Cada minuto
        return () => clearInterval(interval);
    }, [isDemo, demoExpires, updateTimeLeft]);

    // FIX 4: Integrity check periódico cada 30 minutos
    useEffect(() => {
        if (!deviceId) return;
        const interval = setInterval(async () => {
            const raw = localStorage.getItem('pda_premium_token');

            // FIX 5: Si localStorage fue borrado, intentar restaurar desde sessionStorage
            if (!raw) {
                try {
                    const backup = sessionStorage.getItem('_pda_s');
                    if (backup) {
                        const decoded = decodeToken(backup);
                        const [backupToken, backupDevice] = decoded.split(':');
                        const validCode = await generateActivationCode(deviceId);
                        if (backupToken === validCode && backupDevice === deviceId) {
                            // Restaurar token silenciosamente
                            localStorage.setItem('pda_premium_token', encodeToken(validCode));
                            return; // No hacer reload, licencia restaurada
                        }
                    }
                } catch { }
                // Si no hay backup válido y estaba premium → revocar
                if (isPremium) {
                    setIsPremium(false);
                    setIsDemo(false);
                    window.location.reload();
                }
                return;
            }

            // Verificar integridad del token almacenado
            if (raw) {
                const token = decodeToken(raw);
                const validCode = await generateActivationCode(deviceId);
                let isValid = false;
                try {
                    const obj = JSON.parse(token);
                    isValid = obj?.code === validCode && Date.now() < obj.expires;
                } catch {
                    isValid = token === validCode;
                }

                // Si el token local ya venció o fue alterado
                if (!isValid && isPremium) {
                    localStorage.removeItem('pda_premium_token');
                    setIsPremium(false);
                    setIsDemo(false);
                    window.location.reload();
                }
            }
        }, 30 * 60 * 1000); // 30 minutos

        return () => clearInterval(interval);
    }, [deviceId, isPremium]);

    const generateActivationCode = async (devId) => {
        if (!window.crypto || !window.crypto.subtle) {
            console.warn("⚠️ Crypto API no disponible. Usando fallback.");
            let hash = 5381;
            const str = devId + MASTER_SECRET_KEY;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
            }
            const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
            return `ACTIV-${hex.substring(0, 4)}-${hex.substring(4, 8)}`;
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(devId + MASTER_SECRET_KEY);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        return `ACTIV-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}`;
    };

    const checkLicense = async (currentDeviceId) => {
        // FIX 2: Decodificar token ofuscado
        const rawStored = localStorage.getItem('pda_premium_token');
        const storedToken = rawStored ? decodeToken(rawStored) : null;

        if (!storedToken) {
            // Fallback: verificar si existe licencia activa en Supabase (ej: reactivada remotamente)
            try {
                const supa = getSupa();
                const { data: remoteLicense } = await supa
                    .from('licenses')
                    .select('type, active, expires_at')
                    .eq('device_id', currentDeviceId)
                    .eq('product_id', PRODUCT_ID)
                    .maybeSingle();

                if (remoteLicense && remoteLicense.active === true) {
                    const validCode = await generateActivationCode(currentDeviceId);
                    const isTimeLimited = (remoteLicense.type === 'demo7');
                    const expiresAt = remoteLicense.expires_at ? new Date(remoteLicense.expires_at).getTime() : null;

                    if (isTimeLimited && expiresAt) {
                        if (Date.now() < expiresAt) {
                            const token = { code: validCode, expires: expiresAt, isDemo: true };
                            localStorage.setItem('pda_premium_token', encodeToken(JSON.stringify(token)));
                            setIsPremium(true);
                            setIsDemo(true);
                            setDemoExpires(expiresAt);
                        }
                    } else {
                        // Permanente — restaurar token ofuscado
                        localStorage.setItem('pda_premium_token', encodeToken(validCode));
                        setIsPremium(true);
                        setIsDemo(false);
                    }
                    setLoading(false);
                    return;
                }
            } catch (e) {
                // Sin red — no se puede restaurar
            }

            setIsPremium(false);
            setLoading(false);
            return;
        }

        const validTokenStr = await generateActivationCode(currentDeviceId);
        let isPremiumConfirmed = false;
        let confirmedDemo = false;
        let confirmedExpires = null;

        try {
            const tokenObj = JSON.parse(storedToken);
            if (tokenObj && tokenObj.code && tokenObj.expires) {
                if (tokenObj.code === validTokenStr) {
                    if (Date.now() < tokenObj.expires) {
                        setIsPremium(true);
                        setIsDemo(true);
                        setDemoExpires(tokenObj.expires);
                        isPremiumConfirmed = true;
                        confirmedDemo = true;
                        confirmedExpires = tokenObj.expires;
                    } else {
                        console.warn("Demo Expirada");
                        localStorage.removeItem('pda_premium_token');
                        setIsPremium(false);
                        setIsDemo(false);
                        setDemoExpiredMsg("Tu licencia temporal ha finalizado. Esperamos que hayas disfrutado la experiencia completa.");
                    }
                } else {
                    setIsPremium(false);
                }
            } else {
                setIsPremium(false);
            }
        } catch (e) {
            // Formato string antiguo (Lifetime License)
            if (storedToken === validTokenStr) {
                setIsPremium(true);
                setIsDemo(false);
                isPremiumConfirmed = true;
                confirmedDemo = false;
            } else {
                setIsPremium(false);
            }
        }

        // FIX 5: Guardar backup en sessionStorage si licencia válida
        if (isPremiumConfirmed) {
            try {
                sessionStorage.setItem(
                    '_pda_s',
                    encodeToken(validTokenStr + ':' + currentDeviceId)
                );
            } catch { }
        }

        // Migración silenciosa de licencias pre-Supabase
        if (isPremiumConfirmed) {
            const migrateToSupabase = async () => {
                try {
                    const supa = getSupa();

                    // Verificar si ya existe en Supabase
                    const { data: existing } = await supa
                        .from('licenses')
                        .select('id')
                        .eq('device_id', currentDeviceId)
                        .eq('product_id', PRODUCT_ID)
                        .maybeSingle()

                    // Si NO existe, registrarla ahora
                    if (!existing) {
                        await supa.from('licenses').insert({
                            device_id: currentDeviceId,
                            product_id: PRODUCT_ID,
                            type: confirmedDemo ? 'demo7' : 'permanent',
                            active: true,
                            expires_at: confirmedExpires
                                ? new Date(confirmedExpires).toISOString()
                                : null,
                            code: 'MIGRADA-PRESUPABASE',
                            last_seen_at: new Date().toISOString(),
                        })
                    } else {
                        // Si ya existe, solo actualizar last_seen
                        await supa.from('licenses')
                            .update({ last_seen_at: new Date().toISOString() })
                            .eq('device_id', currentDeviceId)
                            .eq('product_id', PRODUCT_ID)
                    }
                } catch (e) {
                    // Silencioso — nunca afecta la app
                }
            }

            migrateToSupabase()  // llamar sin await para no bloquear
        }

        setLoading(false);
    };

    /**
     * Activa la demo de 7 días sin necesidad de código.
     * Solo puede usarse UNA VEZ por dispositivo.
     */
    const activateDemo = async () => {
        // FIX 3: Verificar demo en IndexedDB (local)
        const demoRecord = await storageService.getItem('pda_demo_flag_v1', null);
        if (demoRecord?.used) {
            return { success: false, status: 'DEMO_USED' };
        }

        const currentDeviceId = deviceId || localStorage.getItem('pda_device_id');

        // Verificar en servidor (por si borraron IndexedDB)
        try {
            const supa = getSupa();
            const { data: existingDemo } = await supa
                .from('demos')
                .select('id')
                .eq('device_id', currentDeviceId)
                .eq('product_id', PRODUCT_ID)
                .maybeSingle();

            if (existingDemo) {
                await storageService.setItem('pda_demo_flag_v1', {
                    used: true,
                    ts: Date.now(),
                    deviceId: currentDeviceId,
                });
                return { success: false, status: 'DEMO_USED' };
            }
        } catch (e) {
            // Sin red → solo validar local
        }

        const validCode = await generateActivationCode(currentDeviceId);
        const expires = Date.now() + DEMO_DURATION_MS;
        const demoToken = {
            code: validCode,
            expires: expires,
            isDemo: true
        };

        // FIX 2: Guardar token ofuscado
        localStorage.setItem('pda_premium_token', encodeToken(JSON.stringify(demoToken)));

        // FIX 3: Guardar flag en IndexedDB
        await storageService.setItem('pda_demo_flag_v1', {
            used: true,
            ts: Date.now(),
            deviceId: currentDeviceId,
        });

        setIsPremium(true);
        setIsDemo(true);
        setDemoExpires(expires);
        setDemoUsed(true);

        // Reportar demo a Supabase (silencioso)
        try {
            const supa = getSupa();
            const expiresAt = new Date(expires).toISOString()

            await supa.from('demos').upsert({
                device_id: currentDeviceId,
                product_id: PRODUCT_ID,
                expires_at: expiresAt,
                app_version: APP_VERSION,
            }, { onConflict: 'device_id,product_id' })
        } catch (e) {
            // Nunca bloquear si falla la red
        }

        return { success: true, status: 'DEMO_ACTIVATED' };
    };

    /**
     * Desbloquea con código de activación.
     * Consulta Supabase para determinar si es permanente o temporal (7/30 días).
     */
    const unlockApp = async (inputCode) => {
        const validCode = await generateActivationCode(deviceId);
        if (inputCode.trim().toUpperCase() !== validCode) {
            return { success: false, status: 'INVALID_CODE' };
        }

        // Consultar Supabase para obtener tipo y expiración
        let licenseType = 'permanent';
        let expiresAt = null;
        let lastSeenAt = null;
        try {
            const supa = getSupa();
            const { data } = await supa
                .from('licenses')
                .select('type, expires_at, last_seen_at')
                .eq('device_id', deviceId)
                .eq('product_id', PRODUCT_ID)
                .maybeSingle();

            if (data?.type) licenseType = data.type;
            // Manejo estricto de fechas UTC
            if (data?.expires_at) expiresAt = new Date(data.expires_at).getTime();
            if (data?.last_seen_at) lastSeenAt = data.last_seen_at;
        } catch (e) {
            // Sin red → tratar como permanente (fallback seguro)
        }

        const isTimeLimited = (licenseType === 'demo7');

        if (isTimeLimited) {
            let finalExpiresAt = expiresAt;
            // Si el admin generó la demo, pero no se ha conectado el dispositivo (last_seen_at nulo),
            // el contador de 7 días inicia EXACTAMENTE AHORA, no cuando se generó el código.
            if (!lastSeenAt) {
                finalExpiresAt = Date.now() + 168 * 60 * 60 * 1000;
                try {
                    // Sincronizar silenciosamente la nueva fecha en DB
                    getSupa().from('licenses').update({ expires_at: new Date(finalExpiresAt).toISOString() })
                        .eq('device_id', deviceId).eq('product_id', PRODUCT_ID).then();
                } catch (e) { }
            }

            if (finalExpiresAt) {
                expiresAt = finalExpiresAt;
                // Guardar como JSON con expiración (mismo formato que demo)
                const token = { code: validCode, expires: expiresAt, isDemo: true };
                localStorage.setItem('pda_premium_token', encodeToken(JSON.stringify(token)));
                setIsPremium(true);
                setIsDemo(true);
                setDemoExpires(expiresAt);
                return { success: true, status: 'PREMIUM_ACTIVATED' };
            }
        }

        // Permanente
        localStorage.setItem('pda_premium_token', encodeToken(validCode));
        setIsPremium(true);
        setIsDemo(false);
        return { success: true, status: 'PREMIUM_ACTIVATED' };
    };

    /**
     * Solo para el panel de admin: Genera el código para un CLIENTE (otro ID)
     */
    const generateCodeForClient = async (clientDeviceId) => {
        return await generateActivationCode(clientDeviceId);
    };

    return {
        deviceId,
        isPremium,
        loading,
        unlockApp,
        activateDemo,
        generateCodeForClient,
        isDemo,
        demoExpires,
        demoTimeLeft,
        demoExpiredMsg,
        dismissExpiredMsg: () => setDemoExpiredMsg(''),
        // FIX 3: demoUsed desde estado (IndexedDB)
        demoUsed,
    };
}
