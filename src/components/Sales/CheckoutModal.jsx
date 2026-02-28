import React, { useState, useRef, useEffect } from 'react';
import { X, RefreshCw, Users, Wallet, Receipt, Delete, ChevronDown } from 'lucide-react';
import { formatBs } from '../../utils/calculatorUtils';
import { DEFAULT_PAYMENT_METHODS } from '../../config/paymentMethods';

export default function CheckoutModal({
    onClose,
    cartTotalUsd,
    cartTotalBs,
    amountGiven,
    setAmountGiven,
    amountGivenCurrency,
    setAmountGivenCurrency,
    payments,
    totalPaidUsd,
    remainingUsd,
    remainingBs,
    changeUsd,
    changeBs,
    effectiveRate,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    handlePaymentMethodClick,
    removePayment,
    handleCheckout,
    onUseSaldoFavor,
    triggerHaptic,
}) {
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const inputRef = useRef(null);

    // Numpad handler — builds the amount string digit by digit
    const handleNumpad = (key) => {
        triggerHaptic && triggerHaptic();
        if (key === 'C') {
            setAmountGiven('');
            return;
        }
        if (key === '⌫') {
            setAmountGiven(prev => prev.slice(0, -1));
            return;
        }
        if (key === '.') {
            if (amountGiven.includes('.')) return;
            setAmountGiven(prev => (prev === '' ? '0.' : prev + '.'));
            return;
        }
        // Prevent more than 2 decimal places
        if (amountGiven.includes('.')) {
            const decimals = amountGiven.split('.')[1];
            if (decimals && decimals.length >= 2) return;
        }
        setAmountGiven(prev => prev + key);
    };

    const toggleCurrency = () => {
        triggerHaptic && triggerHaptic();
        setAmountGivenCurrency(prev => prev === 'USD' ? 'BS' : 'USD');
    };

    const fillExact = () => {
        triggerHaptic && triggerHaptic();
        const rest = amountGivenCurrency === 'USD' ? remainingUsd : remainingBs;
        setAmountGiven(rest > 0 ? (amountGivenCurrency === 'BS' ? Math.ceil(rest).toString() : Number(rest.toFixed(2)).toString()) : '');
    };

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const isPaid = remainingUsd <= 0.01;

    // Payment method colors for the grid
    const methodStyles = {
        'efectivo_usd': 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        'efectivo_bs': 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
        'pago_movil': 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
        'punto_venta': 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    };

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">

            {/* ═══ HEADER ═══ */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                <button onClick={onClose} className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X size={22} />
                </button>
                <h2 className="text-base font-black text-slate-800 dark:text-white tracking-wide">COBRAR</h2>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                    {formatBs(effectiveRate)} Bs/$
                </span>
            </div>

            {/* ═══ SCROLLABLE BODY ═══ */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-24">

                {/* ── TOTAL BIMONEDA ── */}
                <div className="px-4 py-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center mb-1">Total a Pagar</p>
                    <div className="text-center">
                        <span className="text-3xl font-black text-slate-900 dark:text-white">${cartTotalUsd.toFixed(2)}</span>
                        <span className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Bs {formatBs(cartTotalBs)}</span>
                    </div>
                </div>

                {/* ── MÉTODOS DE PAGO ── */}
                <div className="px-4 py-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Método de Pago</p>
                    <div className="grid grid-cols-2 gap-2">
                        {DEFAULT_PAYMENT_METHODS.map(m => (
                            <button
                                key={m.id}
                                onClick={() => handlePaymentMethodClick(m.id)}
                                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${methodStyles[m.id] || 'bg-slate-50 border-slate-200 text-slate-700'}`}
                            >
                                <span className="text-xl">{m.icon}</span>
                                <div className="text-left">
                                    <span className="text-xs font-bold leading-tight block">{m.label}</span>
                                    <span className="text-[10px] opacity-60 font-medium">{m.currency === 'USD' ? 'Dólares' : 'Bolívares'}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── INPUT + NUMPAD ── */}
                <div className="px-4 py-2">
                    {/* Display del monto */}
                    <div className="relative mb-3">
                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:border-emerald-500 transition-colors">
                            <button
                                onClick={toggleCurrency}
                                className="shrink-0 px-3 py-3.5 bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700"
                            >
                                {amountGivenCurrency === 'USD' ? '$' : 'Bs'} <RefreshCw size={11} />
                            </button>
                            <input
                                ref={inputRef}
                                inputMode="none"
                                type="text"
                                value={amountGiven}
                                readOnly
                                placeholder="0.00"
                                className="flex-1 text-center text-xl font-black text-slate-800 dark:text-white bg-transparent py-3.5 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
                            />
                            <button
                                onClick={fillExact}
                                className="shrink-0 px-3 py-3.5 bg-emerald-50 dark:bg-emerald-900/30 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 transition-colors border-l border-slate-200 dark:border-slate-700"
                            >
                                EXACTO
                            </button>
                        </div>
                    </div>

                    {/* Numpad Grid */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {['1', '2', '3', '⌫', '4', '5', '6', 'C', '7', '8', '9', '00', '.', '0'].map(key => (
                            <button
                                key={key}
                                onClick={() => handleNumpad(key)}
                                className={`py-3 rounded-xl text-lg font-bold transition-all active:scale-95 ${key === '⌫' ? 'bg-red-50 dark:bg-red-950/30 text-red-500 border border-red-200 dark:border-red-800' :
                                        key === 'C' ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 border border-orange-200 dark:border-orange-800' :
                                            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {key === '⌫' ? <Delete size={20} className="mx-auto" /> : key}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── PAGOS AGREGADOS (Chips) ── */}
                {payments.length > 0 && (
                    <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagos Recibidos</p>
                            <span className="text-xs font-black text-slate-600 dark:text-slate-300">${totalPaidUsd.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {payments.map(p => (
                                <div key={p.id} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        {DEFAULT_PAYMENT_METHODS.find(m => m.id === p.methodId)?.icon} {p.amountInputCurrency === 'USD' ? '$' : 'Bs'}{p.amountInput}
                                    </span>
                                    <button onClick={() => removePayment(p.id)} className="text-red-400 hover:text-red-600 ml-0.5">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── BANNER VUELTO / RESTANTE ── */}
                <div className="px-4 py-2">
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
                    <div className="px-4 py-2">
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
                    <div className="px-4 py-1">
                        <button
                            onClick={() => { triggerHaptic && triggerHaptic(); onUseSaldoFavor(); }}
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
                    onClick={handleCheckout}
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
                        <><Receipt size={18} /> AGREGA PAGOS FALTANTES</>
                    )}
                </button>
            </div>
        </div>
    );
}
