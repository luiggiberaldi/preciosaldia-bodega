// [CONFIGURACIÓN] Comisión de efectivo REMOVIDA
// La tasa de efectivo ahora depende exclusivamente de la calibración manual del usuario

// Formateadores
export const formatBs = (val) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
export const formatUsd = (val) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
export const formatCop = (val) => Math.round(val).toLocaleString('es-CO');

/**
 * Get COP price for a product/item: use stored priceCop if available, otherwise derive from USD.
 */
export const getCop = (item, tasaCop) => {
    if (item.priceCop != null && item.priceCop > 0) return item.priceCop;
    return Math.round((item.priceUsdt ?? item.priceUsd ?? 0) * (tasaCop || 0));
};

/**
 * Get effective USD price: when priceCop exists and tasaCop is valid, derive USD from COP in real-time.
 * This ensures USD/Bs update dynamically when the COP rate changes.
 */
export const getUsd = (item, tasaCop) => {
    if (item.priceCop != null && item.priceCop > 0 && tasaCop > 0) {
        return item.priceCop / tasaCop;
    }
    return item.priceUsdt ?? item.priceUsd ?? 0;
};

/**
 * Format price with correct currency label when COP is enabled.
 * @param {number} usdVal - price in USD
 * @param {object} opts - { copEnabled, tasaCop, showUsd, showBs, effectiveRate }
 * @returns {{ primary: string, secondary: string|null, copVal: number }}
 */
export const priceDisplay = (usdVal, opts = {}) => {
    const { copEnabled, tasaCop, effectiveRate } = opts;
    const copVal = copEnabled && tasaCop > 0 ? usdVal * tasaCop : 0;
    const bsVal = effectiveRate > 0 ? usdVal * effectiveRate : 0;
    return {
        usd: `$${formatUsd(usdVal)}`,
        usdLabel: copEnabled ? 'USD' : '$',
        cop: copEnabled && tasaCop > 0 ? `${formatCop(copVal)} COP` : null,
        bs: effectiveRate > 0 ? `${formatBs(bsVal)} Bs` : null,
        copVal,
        bsVal,
    };
};

// [REDONDEO INTELIGENTE PARA EFECTIVO]
// Regla: Si decimal <= 0.20 -> Redondeo abajo (Floor)
//        Si decimal > 0.20  -> Redondeo arriba (Ceil)
export const smartCashRounding = (amount) => {
    const integer = Math.floor(amount);
    const decimal = amount - integer;
    return decimal <= 0.2001 ? integer : integer + 1; // Usamos 0.2001 para margen de error flotante
};

import { MessageService } from '../services/MessageService';

// Re-export deprecated function referencing the new service
export const generatePaymentMessage = (params) => {
    return MessageService.buildPaymentMessage(params);
};

// Normaliza número venezolano al formato internacional para wa.me
// Acepta: 04121234567 → 584121234567
//         4121234567  → 584121234567
//         584121234567 → 584121234567
export const formatVzlaPhone = (raw) => {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('58') && digits.length >= 12) return digits;
    if (digits.startsWith('0')) return '58' + digits.slice(1);
    if (digits.length >= 10) return '58' + digits;
    return null;
};
