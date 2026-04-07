import { useState, useCallback, useMemo } from 'react';
import { round2, divR, mulR, subR, sumR } from '../utils/dinero';

export function useCheckoutCalculations({
    paymentMethods,
    effectiveRate,
    tasaCop,
    cartTotalUsd,
    cartTotalBs,
    triggerHaptic,
    onConfirmSale,
}) {
    const [barValues, setBarValues] = useState({});
    const [changeUsdGiven, setChangeUsdGiven] = useState('');
    const [changeBsGiven, setChangeBsGiven] = useState('');

    const safeRate = effectiveRate > 0 ? effectiveRate : 1;
    const safeTasaCop = tasaCop > 0 ? tasaCop : 4150;

    const totalPaidUsd = useMemo(() => {
        return sumR(paymentMethods.map(m => {
            const val = parseFloat(barValues[m.id]) || 0;
            if (m.currency === 'USD') return round2(val);
            if (m.currency === 'COP') return divR(val, safeTasaCop);
            return divR(val, safeRate);
        }));
    }, [barValues, paymentMethods, effectiveRate, tasaCop]);

    const totalPaidBs = useMemo(() => {
        return sumR(paymentMethods.map(m => {
            const val = parseFloat(barValues[m.id]) || 0;
            if (m.currency === 'BS') return round2(val);
            if (m.currency === 'COP') return mulR(divR(val, safeTasaCop), safeRate);
            return mulR(val, safeRate);
        }));
    }, [barValues, paymentMethods, effectiveRate, tasaCop]);

    const remainingUsd = Math.max(0, subR(cartTotalUsd, totalPaidUsd));
    const remainingBs = Math.max(0, subR(cartTotalBs, totalPaidBs));
    const changeUsd = Math.max(0, subR(totalPaidUsd, cartTotalUsd));
    const changeBs = Math.max(0, subR(totalPaidBs, cartTotalBs));
    const isPaid = remainingUsd < 0.009;

    const handleBarChange = useCallback((methodId, value) => {
        let v = value.replace(',', '.');
        if (!/^[0-9.]*$/.test(v)) return;
        const dots = v.match(/\./g);
        if (dots && dots.length > 1) return;
        setBarValues(prev => ({ ...prev, [methodId]: v }));
    }, []);

    const fillBar = useCallback((methodId, currency) => {
        triggerHaptic && triggerHaptic();
        let val;
        if (currency === 'USD') {
            val = remainingUsd > 0 ? Number(remainingUsd.toFixed(2)).toString() : null;
        } else if (currency === 'COP') {
            val = remainingUsd > 0 ? Number((remainingUsd * safeTasaCop).toFixed(2)).toString() : null;
        } else {
            val = remainingBs > 0 ? Number(remainingBs.toFixed(2)).toString() : null;
        }
        if (val) {
            setBarValues(prev => ({ ...prev, [methodId]: val }));
        }
    }, [remainingUsd, remainingBs, triggerHaptic, tasaCop]);

    const handleConfirm = useCallback(() => {
        triggerHaptic && triggerHaptic();

        // ── Detección inteligente de errores de entrada ───────────────────────
        if (cartTotalUsd > 0) {
            for (const m of paymentMethods) {
                const val = parseFloat(barValues[m.id]) || 0;
                if (val === 0) continue;

                const valUsd = m.currency === 'USD' ? val
                    : m.currency === 'COP' ? val / safeTasaCop
                    : val / safeRate;
                const diff = valUsd - cartTotalUsd;

                // Capa 1 — Confusión Bs → USD
                // Si el método es USD y (monto ÷ tasa) ≈ total real (±10%), el cajero
                // probablemente ingresó el precio en Bolívares en el campo de Dólares.
                if (m.currency === 'USD' && safeRate > 1) {
                    const impliedUsd = val / safeRate;
                    const ratio = impliedUsd / cartTotalUsd;
                    if (ratio >= 0.90 && ratio <= 1.10 && val > cartTotalUsd * 3) {
                        const expectedBs = (cartTotalUsd * safeRate).toFixed(2);
                        const ok = window.confirm(
                            `⚠️ Posible error de moneda\n\n` +
                            `Ingresaste $${val.toFixed(2)} en el campo de Dólares, pero el total de la venta es $${cartTotalUsd.toFixed(2)}.\n\n` +
                            `¿Confundiste el campo? El total en Bolívares es Bs ${expectedBs}.\n\n` +
                            `Presiona Aceptar solo si el cliente realmente pagó $${val.toFixed(2)} en dólares.`
                        );
                        if (!ok) return;
                        break;
                    }
                }

                // Capa 2 — Umbral proporcional según tamaño de venta
                const threshold = cartTotalUsd <= 10  ? { factor: 4,   minDiff: 15 }
                                : cartTotalUsd <= 50  ? { factor: 3,   minDiff: 30 }
                                : cartTotalUsd <= 200 ? { factor: 2,   minDiff: 50 }
                                :                      { factor: 1.5, minDiff: 100 };

                if (valUsd > cartTotalUsd * threshold.factor && diff > threshold.minDiff) {
                    // Capa 3 — ¿Es un número redondo sospechoso?
                    const isRoundNumber = val >= 100 && val % 100 === 0;
                    const roundNote = isRoundNumber ? '\nEl monto parece un número redondeado — verifica que no hayas agregado ceros de más.' : '';

                    const ok = window.confirm(
                        `⚠️ Monto inusualmente alto\n\n` +
                        `Ingresaste ${m.currency === 'USD' ? '$' : 'Bs '}${val.toFixed(2)} para una venta de $${cartTotalUsd.toFixed(2)}.` +
                        roundNote +
                        `\n\n¿El cliente realmente pagó esa cantidad?\n\nPresiona Aceptar para confirmar o Cancelar para corregirlo.`
                    );
                    if (!ok) return;
                    break;
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        const payments = paymentMethods
            .filter(m => parseFloat(barValues[m.id]) > 0)
            .map(m => {
                const amount = round2(parseFloat(barValues[m.id]));
                return {
                    id: crypto.randomUUID(),
                    methodId: m.id,
                    methodLabel: m.label,
                    currency: m.currency,
                    amountInput: amount,
                    amountInputCurrency: m.currency,
                    amountUsd: m.currency === 'USD' ? amount : m.currency === 'COP' ? divR(amount, safeTasaCop) : divR(amount, safeRate),
                    amountBs: m.currency === 'BS' ? amount : m.currency === 'COP' ? mulR(divR(amount, safeTasaCop), safeRate) : mulR(amount, safeRate),
                };
            });
        const defaultUsdChange = (!changeUsdGiven && !changeBsGiven) ? changeUsd : round2(parseFloat(changeUsdGiven) || 0);
        const defaultBsChange = (!changeUsdGiven && !changeBsGiven) ? 0 : round2(parseFloat(changeBsGiven) || 0);

        onConfirmSale(payments, {
            changeUsdGiven: Math.min(defaultUsdChange, changeUsd),
            changeBsGiven: Math.min(defaultBsChange, changeBs),
        });
    }, [barValues, paymentMethods, effectiveRate, onConfirmSale, triggerHaptic, changeUsdGiven, changeBsGiven, changeUsd, cartTotalUsd]);

    return {
        barValues,
        totalPaidUsd,
        remainingUsd,
        remainingBs,
        changeUsd,
        changeBs,
        isPaid,
        changeUsdGiven,
        changeBsGiven,
        setChangeUsdGiven,
        setChangeBsGiven,
        handleBarChange,
        fillBar,
        handleConfirm,
        safeRate,
        safeTasaCop,
    };
}
