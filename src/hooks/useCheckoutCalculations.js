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
    }, [barValues, paymentMethods, effectiveRate, onConfirmSale, triggerHaptic, changeUsdGiven, changeBsGiven, changeUsd]);

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
