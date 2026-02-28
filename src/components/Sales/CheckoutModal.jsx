import React, { useState, useCallback, useMemo } from 'react';
import { X, Users, Receipt, ChevronDown, Wallet, Zap } from 'lucide-react';
import { formatBs } from '../../utils/calculatorUtils';

/**
 * CheckoutModal — Zona de Cobro con Barras de Pago (Estilo Listo POS)
 * Cada método de pago tiene su propia barra con input + botón TOTAL.
 */
export default function CheckoutModal({
    onClose,
    cartTotalUsd,
    cartTotalBs,
    effectiveRate,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    paymentMethods,
    onConfirmSale,
    onUseSaldoFavor,
    triggerHaptic,
}) {
    // ── State: un valor por barra ──
    const [barValues, setBarValues] = useState({});
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    // ── Cálculos bimoneda ──
    const totalPaidUsd = useMemo(() => {
        return paymentMethods.reduce((sum, m) => {
            const val = parseFloat(barValues[m.id]) || 0;
            return sum + (m.currency === 'USD' ? val : val / effectiveRate);
        }, 0);
    }, [barValues, paymentMethods, effectiveRate]);

    const remainingUsd = Math.max(0, cartTotalUsd - totalPaidUsd);
    const remainingBs = remainingUsd * effectiveRate;
    const changeUsd = Math.max(0, totalPaidUsd - cartTotalUsd);
    const changeBs = changeUsd * effectiveRate;
    const isPaid = remainingUsd <= 0.01;

    // ── Handlers ──
    const handleBarChange = useCallback((methodId, value) => {
        // Solo números y punto decimal
        let v = value.replace(',', '.');
        if (!/^[0-9.]*$/.test(v)) return;
        const dots = v.match(/\./g);
        if (dots && dots.length > 1) return;
        setBarValues(prev => ({ ...prev, [methodId]: v }));
    }, []);

    const fillBar = useCallback((methodId, currency) => {
        triggerHaptic && triggerHaptic();
        const remaining = currency === 'USD' ? remainingUsd : remainingBs;
        if (remaining <= 0) return;
        const val = Number(remaining.toFixed(2)).toString();
        setBarValues(prev => ({ ...prev, [methodId]: val }));
    }, [remainingUsd, remainingBs, triggerHaptic]);

    // Construir payments[] desde barValues al confirmar
    const handleConfirm = useCallback(() => {
        triggerHaptic && triggerHaptic();
        const payments = paymentMethods
            .filter(m => parseFloat(barValues[m.id]) > 0)
            .map(m => {
                const amount = parseFloat(barValues[m.id]);
                return {
                    id: crypto.randomUUID(),
                    methodId: m.id,
                    methodLabel: m.label,
                    currency: m.currency,
                    amountInput: amount,
                    amountInputCurrency: m.currency,
                    amountUsd: m.currency === 'USD' ? amount : amount / effectiveRate,
                    amountBs: m.currency === 'BS' ? amount : amount * effectiveRate,
                };
            });
        onConfirmSale(payments);
    }, [barValues, paymentMethods, effectiveRate, onConfirmSale, triggerHaptic]);

    // Saldo a favor
    const handleSaldoFavor = useCallback(() => {
        triggerHaptic && triggerHaptic();
        if (onUseSaldoFavor) onUseSaldoFavor();
    }, [onUseSaldoFavor, triggerHaptic]);

    // Agrupar métodos por moneda
    const methodsUsd = paymentMethods.filter(m => m.currency === 'USD');
    const methodsBs = paymentMethods.filter(m => m.currency === 'BS');

    // ── Estilos de barra por moneda ──
    const sectionStyles = {
        USD: {
            bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
            border: 'border-emerald-100 dark:border-emerald-900/50',
            title: 'text-emerald-800 dark:text-emerald-300',
            titleBg: 'bg-emerald-100 dark:bg-emerald-900/50',
            titleIcon: 'text-emerald-600 dark:text-emerald-400',
            inputBorder: 'border-emerald-200 dark:border-emerald-800 focus:border-emerald-500 focus:ring-emerald-500/20',
            inputActive: 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
            btnBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 active:bg-emerald-300',
        },
        BS: {
            bg: 'bg-blue-50/50 dark:bg-blue-950/20',
            border: 'border-blue-100 dark:border-blue-900/50',
            title: 'text-blue-800 dark:text-blue-300',
            titleBg: 'bg-blue-100 dark:bg-blue-900/50',
            titleIcon: 'text-blue-600 dark:text-blue-400',
            inputBorder: 'border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500/20',
            inputActive: 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30',
            btnBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 active:bg-blue-300',
        },
    };

    const renderPaymentBar = (method, styles) => {
        const val = barValues[method.id] || '';
        const hasValue = parseFloat(val) > 0;
        const equivUsd = method.currency === 'BS' && hasValue
            ? (parseFloat(val) / effectiveRate).toFixed(2)
            : null;

        return (
            <div key={method.id} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1 ml-0.5">
                    <span className="text-base">{method.icon}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${hasValue ? styles.title : 'text-slate-400 dark:text-slate-500'}`}>
                        {method.label}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={val}
                            onChange={e => handleBarChange(method.id, e.target.value)}
                            placeholder="0.00"
                            className={`w-full py-3 px-4 pr-14 rounded-xl border-2 text-lg font-bold outline-none transition-all ${hasValue
                                ? styles.inputActive
                                : `bg-white dark:bg-slate-900 ${styles.inputBorder}`
                                } text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-4`}
                        />
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black px-2 py-0.5 rounded-md border ${hasValue
                            ? `${styles.titleBg} ${styles.title} ${styles.border}`
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}>
                            {method.currency === 'USD' ? '$' : 'Bs'}
                        </span>
                    </div>
                    <button
                        onClick={() => fillBar(method.id, method.currency)}
                        className={`shrink-0 py-3 px-3.5 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1 ${styles.btnBg}`}
                    >
                        <Zap size={14} fill="currentColor" /> Total
                    </button>
                </div>
                {equivUsd && (
                    <p className="text-[11px] font-bold text-blue-500 dark:text-blue-400 mt-1 ml-1">
                        ≈ ${equivUsd}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">

            {/* ═══ HEADER ═══ */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <button onClick={onClose} className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X size={22} />
                </button>
                <h2 className="text-base font-black text-slate-800 dark:text-white tracking-wide">COBRAR</h2>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                    {formatBs(effectiveRate)} Bs/$
                </span>
            </div>

            {/* ═══ SCROLLABLE BODY ═══ */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-28">

                {/* ── TOTAL BIMONEDA ── */}
                <div className="px-4 py-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center mb-1">Total a Pagar</p>
                    <div className="text-center">
                        <span className="text-3xl font-black text-slate-900 dark:text-white">${cartTotalUsd.toFixed(2)}</span>
                        <span className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Bs {formatBs(cartTotalBs)}</span>
                    </div>
                </div>

                {/* ── SECCIÓN DÓLARES ($) ── */}
                {methodsUsd.length > 0 && (
                    <div className={`mx-3 mb-3 rounded-2xl border ${sectionStyles.USD.bg} ${sectionStyles.USD.border} p-3`}>
                        <h3 className={`text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${sectionStyles.USD.title}`}>
                            <span className={`p-1 rounded-lg ${sectionStyles.USD.titleBg}`}>💲</span>
                            Dólares ($)
                        </h3>
                        {methodsUsd.map(m => renderPaymentBar(m, sectionStyles.USD))}
                    </div>
                )}

                {/* ── SECCIÓN BOLÍVARES (Bs) ── */}
                {methodsBs.length > 0 && (
                    <div className={`mx-3 mb-3 rounded-2xl border ${sectionStyles.BS.bg} ${sectionStyles.BS.border} p-3`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${sectionStyles.BS.title}`}>
                                <span className={`p-1 rounded-lg ${sectionStyles.BS.titleBg}`}>💵</span>
                                Bolívares (Bs)
                            </h3>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${sectionStyles.BS.titleBg} ${sectionStyles.BS.title}`}>
                                Tasa: {formatBs(effectiveRate)}
                            </span>
                        </div>
                        {methodsBs.map(m => renderPaymentBar(m, sectionStyles.BS))}
                    </div>
                )}

                {/* ── BANNER VUELTO / RESTANTE ── */}
                <div className="px-3 py-2">
                    <div className={`p-3.5 rounded-xl border-2 transition-all ${isPaid
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
                        }`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isPaid ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {isPaid ? '✓ Vuelto' : 'Resta por Cobrar'}
                        </p>
                        <div className="flex items-end justify-between">
                            <span className={`text-2xl font-black ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                ${isPaid ? changeUsd.toFixed(2) : remainingUsd.toFixed(2)}
                            </span>
                            <span className={`text-sm font-bold ${isPaid ? 'text-emerald-500' : 'text-orange-500'}`}>
                                Bs {formatBs(isPaid ? changeBs : remainingBs)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── CLIENTE (colapsable) ── */}
                {customers.length > 0 && (
                    <div className="px-3 py-2">
                        <button
                            onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                    {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
                                </span>
                            </div>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCustomerPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {showCustomerPicker && (
                            <div className="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg max-h-40 overflow-y-auto">
                                <button
                                    onClick={() => { setSelectedCustomerId(''); setShowCustomerPicker(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${!selectedCustomerId ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    Consumidor Final
                                </button>
                                {customers.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setSelectedCustomerId(c.id); setShowCustomerPicker(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-medium border-t border-slate-100 dark:border-slate-800 transition-colors ${selectedCustomerId === c.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    >
                                        {c.name}
                                        {c.deuda !== 0 && (
                                            <span className={`ml-2 text-xs font-bold ${c.deuda > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {c.deuda > 0 ? `Debe $${c.deuda.toFixed(2)}` : `Favor $${Math.abs(c.deuda).toFixed(2)}`}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Saldo a Favor */}
                {selectedCustomer?.deuda < -0.01 && remainingUsd > 0.01 && (
                    <div className="px-3 py-1">
                        <button
                            onClick={handleSaldoFavor}
                            className="w-full py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <Wallet size={16} /> Usar Saldo a Favor (${Math.abs(selectedCustomer.deuda).toFixed(2)})
                        </button>
                    </div>
                )}
            </div>

            {/* ═══ BOTÓN CTA FIJO ═══ */}
            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                    onClick={handleConfirm}
                    disabled={!selectedCustomerId && remainingUsd > 0.01}
                    className={`w-full py-4 text-white font-black text-base rounded-2xl shadow-lg transition-all tracking-wide flex items-center justify-center gap-2 ${isPaid
                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25 active:scale-[0.98]'
                        : selectedCustomerId
                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25 active:scale-[0.98]'
                            : 'bg-slate-300 dark:bg-slate-800 text-slate-500 shadow-none cursor-not-allowed'
                        }`}
                >
                    {isPaid ? (
                        <><Receipt size={18} /> CONFIRMAR VENTA</>
                    ) : selectedCustomerId ? (
                        <><Users size={18} /> FIAR RESTANTE (${remainingUsd.toFixed(2)})</>
                    ) : (
                        <><Receipt size={18} /> INGRESA LOS PAGOS</>
                    )}
                </button>
            </div>
        </div>
    );
}
