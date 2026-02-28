import { useState, useEffect, useCallback } from 'react';
import { storageService } from '../utils/storageService';

// FIX 1: Salt desde variable de entorno
const MASTER_SECRET_KEY = import.meta.env.VITE_LICENSE_SALT;
const DEMO_DURATION_MS = 72 * 60 * 60 * 1000; // 72 horas (3 días)

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
        // 1. Obtener o Generar Device ID
        let storedId = localStorage.getItem('pda_device_id');
        if (!storedId) {
            const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
            storedId = `PDA-${randomPart}`;
            localStorage.setItem('pda_device_id', storedId);
        }
        setDeviceId(storedId);

        // 2. Verificar Licencia
        checkLicense(storedId);

        // FIX 3: Leer demo flag desde IndexedDB
        storageService.getItem('pda_demo_flag_v1', null).then(r => {
            if (r?.used) setDemoUsed(true);
        });
    }, []);

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
                setDemoExpiredMsg("Tu prueba gratuita de 3 días ha finalizado. Esperamos que hayas disfrutado la experiencia completa.");
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
            setIsPremium(false);
            setLoading(false);
            return;
        }

        const validTokenStr = await generateActivationCode(currentDeviceId);
        let isPremiumConfirmed = false;

        try {
            const tokenObj = JSON.parse(storedToken);
            if (tokenObj && tokenObj.code && tokenObj.expires) {
                if (tokenObj.code === validTokenStr) {
                    if (Date.now() < tokenObj.expires) {
                        setIsPremium(true);
                        setIsDemo(true);
                        setDemoExpires(tokenObj.expires);
                        isPremiumConfirmed = true;
                    } else {
                        console.warn("Demo Expirada");
                        localStorage.removeItem('pda_premium_token');
                        setIsPremium(false);
                        setIsDemo(false);
                        setDemoExpiredMsg("Tu prueba gratuita de 3 días ha finalizado. Esperamos que hayas disfrutado la experiencia completa.");
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

        setLoading(false);
    };

    /**
     * Activa la demo de 3 días sin necesidad de código.
     * Solo puede usarse UNA VEZ por dispositivo.
     */
    const activateDemo = async () => {
        // FIX 3: Verificar demo en IndexedDB
        const demoRecord = await storageService.getItem('pda_demo_flag_v1', null);
        if (demoRecord?.used) {
            return { success: false, status: 'DEMO_USED' };
        }

        const currentDeviceId = deviceId || localStorage.getItem('pda_device_id');
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

        return { success: true, status: 'DEMO_ACTIVATED' };
    };

    /**
     * Desbloquea con código de activación (licencia permanente).
     */
    const unlockApp = async (inputCode) => {
        const validCode = await generateActivationCode(deviceId);
        if (inputCode.trim().toUpperCase() === validCode) {
            // FIX 2: Guardar token ofuscado
            localStorage.setItem('pda_premium_token', encodeToken(validCode));
            setIsPremium(true);
            setIsDemo(false);
            return { success: true, status: 'PREMIUM_ACTIVATED' };
        }
        return { success: false, status: 'INVALID_CODE' };
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
