import { useState, useEffect, useCallback } from 'react';

// CLAVE MAESTRA SECRETA (En un entorno real estaría ofuscada o validada en servidor, 
// pero siguiendo la directiva "Offline First" y "Sin Backend", vive aquí).
const MASTER_SECRET_KEY = "VENEZUELA_PRO_2026_GLOBAL";
const DEMO_DURATION_MS = 72 * 60 * 60 * 1000; // 72 horas (3 días)

export function useSecurity() {
    const [deviceId, setDeviceId] = useState('');
    const [isPremium, setIsPremium] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [demoExpires, setDemoExpires] = useState(null);
    const [demoExpiredMsg, setDemoExpiredMsg] = useState('');
    const [demoTimeLeft, setDemoTimeLeft] = useState('');

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
        let storedId = localStorage.getItem('device_id');
        if (!storedId) {
            const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
            storedId = `TASAS-${randomPart}`;
            localStorage.setItem('device_id', storedId);
        }
        setDeviceId(storedId);

        // 2. Verificar Licencia
        checkLicense(storedId);
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
                localStorage.removeItem('premium_token');
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
        let storedToken = localStorage.getItem('premium_token');

        if (!storedToken) {
            setIsPremium(false);
            setLoading(false);
            return;
        }

        const validTokenStr = await generateActivationCode(currentDeviceId);

        try {
            const tokenObj = JSON.parse(storedToken);
            if (tokenObj && tokenObj.code && tokenObj.expires) {
                if (tokenObj.code === validTokenStr) {
                    if (Date.now() < tokenObj.expires) {
                        setIsPremium(true);
                        setIsDemo(true);
                        setDemoExpires(tokenObj.expires);
                    } else {
                        console.warn("Demo Expirada");
                        localStorage.removeItem('premium_token');
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
            } else {
                setIsPremium(false);
            }
        }
        setLoading(false);
    };

    /**
     * Activa la demo de 3 días sin necesidad de código.
     * Solo puede usarse UNA VEZ por dispositivo.
     */
    const activateDemo = async () => {
        // Verificar si ya se usó
        if (localStorage.getItem('demo_used_history')) {
            return { success: false, status: 'DEMO_USED' };
        }

        const validCode = await generateActivationCode(deviceId);
        const expires = Date.now() + DEMO_DURATION_MS;
        const demoToken = {
            code: validCode,
            expires: expires,
            isDemo: true
        };

        localStorage.setItem('premium_token', JSON.stringify(demoToken));
        localStorage.setItem('demo_used_history', 'true');

        setIsPremium(true);
        setIsDemo(true);
        setDemoExpires(expires);

        return { success: true, status: 'DEMO_ACTIVATED' };
    };

    /**
     * Desbloquea con código de activación (licencia permanente).
     */
    const unlockApp = async (inputCode) => {
        const validCode = await generateActivationCode(deviceId);
        if (inputCode.trim().toUpperCase() === validCode) {
            localStorage.setItem('premium_token', validCode);
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
        demoUsed: typeof window !== 'undefined' && localStorage.getItem('demo_used_history') === 'true'
    };
}
