import React, { useState, useCallback } from 'react';
import { X, Users, Receipt, Wallet, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { formatBs } from '../../utils/calculatorUtils';
import { mulR, divR, subR } from '../../utils/dinero';
import { useCheckoutCalculations } from '../../hooks/useCheckoutCalculations';
import CheckoutPaymentBars from './CheckoutPaymentBars';
import CheckoutCustomerPicker from './CheckoutCustomerPicker';

/**
 * CheckoutModal — Zona de Cobro con Barras de Pago (Estilo Listo POS)
 */
export default function CheckoutModal({
    onClose,
    cartSubtotalUsd,
    cartSubtotalBs,
    cartTotalUsd,
    cartTotalBs,
    discountData,
    effectiveRate,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    paymentMethods,
    onConfirmSale,
    onUseSaldoFavor,
    triggerHaptic,
    onCreateCustomer,
    copEnabled,
    tasaCop,
    currentFloatUsd = 0,
    currentFloatBs = 0
}) {
    const [confirmFiar, setConfirmFiar] = useState(false);

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    const {
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
    } = useCheckoutCalculations({
        paymentMethods,
        effectiveRate,
        tasaCop,
        cartTotalUsd,
        cartTotalBs,
        triggerHaptic,
        onConfirmSale,
    });

    const handleSaldoFavor = useCallback(() => {
        triggerHaptic && triggerHaptic();
        if (onUseSaldoFavor) onUseSaldoFavor();
    }, [onUseSaldoFavor, triggerHaptic]);

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">

            {/* --- HEADER --- */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <button onClick={onClose} className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X size={22} />
                </button>
                <h2 className="text-base font-black text-slate-800 dark:text-white tracking-wide">COBRAR</h2>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                    {formatBs(effectiveRate)} Bs/$
                </span>
            </div>

            {/* --- SCROLLABLE BODY --- */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-28">

                {/* -- TOTAL BIMONEDA -- */}
                <div className="px-4 py-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    {discountData?.active && (
                        <div className="flex flex-col items-center justify-center space-y-1 mb-3 pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                                <span>Subtotal:</span>
                                <span>${cartSubtotalUsd.toFixed(2)}</span>
                                <span className="text-[10px]">&bull;</span>
                                <span className="text-xs">Bs {formatBs(cartSubtotalBs)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-black text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg">
                                <span>Descuento ({discountData.type === 'percentage' ? `${discountData.value}%` : 'Fijo'}):</span>
                                <span>-${discountData.amountUsd.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    <p className={`text-[11px] font-bold uppercase tracking-widest text-center mb-1 ${discountData?.active ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {discountData?.active ? 'Total Final' : 'Total a Pagar'}
                    </p>
                    <div className="text-center">
                        <span className={`text-4xl sm:text-5xl font-black ${discountData?.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            ${cartTotalUsd.toFixed(2)}
                        </span>
                        <span className="block text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            Bs {formatBs(cartTotalBs)}
                        </span>
                        {copEnabled && (
                            <span className="block text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                COP {(cartTotalUsd * tasaCop).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                </div>

                {/* -- PAYMENT BARS -- */}
                <CheckoutPaymentBars
                    paymentMethods={paymentMethods}
                    barValues={barValues}
                    effectiveRate={effectiveRate}
                    tasaCop={tasaCop}
                    copEnabled={copEnabled}
                    onBarChange={handleBarChange}
                    onFillBar={fillBar}
                />

                {/* -- BANNER VUELTO / RESTANTE -- */}
                <div className="px-3 py-2">
                    <div className={`p-3.5 rounded-xl border-2 transition-all ${isPaid
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
                        }`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isPaid ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {isPaid ? 'Vuelto' : 'Resta por Cobrar'}
                        </p>
                        <div className="flex items-end justify-between">
                            <div className="flex flex-col">
                                <span className={`text-2xl font-black ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                    ${isPaid ? changeUsd.toFixed(2) : remainingUsd.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className={`text-sm font-bold ${isPaid ? 'text-emerald-500' : 'text-orange-500'}`}>
                                    Bs {formatBs(isPaid ? changeBs : remainingBs)}
                                </span>
                                {copEnabled && (
                                    <span className={`text-sm font-bold ${isPaid ? 'text-emerald-500' : 'text-orange-500'}`}>
                                        COP {isPaid ? (changeUsd * tasaCop).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (remainingUsd * tasaCop).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* DESGLOSE DE VUELTO */}
                        {isPaid && changeUsd > 0.009 && (
                            <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800 space-y-2">
                                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                                    <ArrowLeftRight size={10} />
                                    Desglosar vuelto
                                </p>

                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={changeUsdGiven}
                                            onChange={e => {
                                                const v = e.target.value;
                                                const usd = Math.min(Math.max(0, parseFloat(v) || 0), changeUsd);
                                                setChangeUsdGiven(v);
                                                setChangeBsGiven(Math.max(0, mulR(subR(changeUsd, usd), effectiveRate)).toFixed(0));
                                            }}
                                            className="w-full py-2 px-3 pr-10 rounded-lg border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-900 font-black text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded">USD</span>
                                    </div>

                                    <span className="text-slate-400 font-black text-xs shrink-0">+</span>

                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={changeBsGiven}
                                            onChange={e => {
                                                const v = e.target.value;
                                                const bsTotal = mulR(changeUsd, effectiveRate);
                                                const bs = Math.min(Math.max(0, parseFloat(v) || 0), bsTotal);
                                                setChangeBsGiven(v);
                                                setChangeUsdGiven(Math.max(0, subR(changeUsd, divR(bs, effectiveRate))).toFixed(2));
                                            }}
                                            className="w-full py-2 px-3 pr-8 rounded-lg border-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 font-black text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded">Bs</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setChangeUsdGiven(changeUsd.toFixed(2)); setChangeBsGiven('0'); }}
                                        className="flex-1 py-1.5 rounded-lg text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 active:scale-95 transition-all border border-emerald-200 dark:border-emerald-800"
                                    >
                                        Todo $
                                    </button>
                                    <button
                                        onClick={() => { setChangeUsdGiven('0'); setChangeBsGiven(mulR(changeUsd, effectiveRate).toFixed(0)); }}
                                        className="flex-1 py-1.5 rounded-lg text-[9px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 active:scale-95 transition-all border border-blue-200 dark:border-blue-800"
                                    >
                                        Todo Bs
                                    </button>
                                </div>

                                {/* FLOAT WARNINGS */}
                                {(parseFloat(changeUsdGiven) > currentFloatUsd + 0.05 || parseFloat(changeBsGiven) > currentFloatBs + 1) && (
                                    <div className="mt-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-start gap-1.5">
                                        <AlertTriangle size={12} className="text-orange-500 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 leading-tight">
                                                Precaución: El vuelto excede el fondo de caja registrado.
                                            </p>
                                            <p className="text-[9px] font-medium text-orange-500 leading-tight mt-0.5">
                                                Fondo actual:
                                                <span className="font-bold ml-1">${currentFloatUsd.toFixed(2)}</span> y
                                                <span className="font-bold ml-1">Bs {formatBs(currentFloatBs)}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* -- CLIENTE -- */}
                <CheckoutCustomerPicker
                    customers={customers}
                    selectedCustomerId={selectedCustomerId}
                    setSelectedCustomerId={setSelectedCustomerId}
                    effectiveRate={effectiveRate}
                    onCreateCustomer={onCreateCustomer}
                />

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

            {/* --- BOTON CTA FIJO --- */}
            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                    onClick={() => {
                        if (!isPaid && selectedCustomerId && remainingUsd > 0.01) {
                            triggerHaptic && triggerHaptic();
                            setConfirmFiar(true);
                        } else {
                            handleConfirm();
                        }
                    }}
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

            {/* --- MODAL CONFIRMACION FIAR --- */}
            {confirmFiar && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmFiar(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                <AlertTriangle size={24} className="text-amber-600 sm:w-7 sm:h-7" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">Confirmar Fiado</h3>
                                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Revisa los detalles antes de continuar</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 sm:p-5 mb-5">
                            <div className="text-center mb-3">
                                <p className="text-[11px] sm:text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Monto a fiar</p>
                                <p className="text-3xl sm:text-4xl font-black text-amber-600">${remainingUsd.toFixed(2)}</p>
                                <p className="text-sm sm:text-base font-bold text-amber-500/70 mt-0.5">{formatBs(remainingBs)} Bs</p>
                            </div>
                            <div className="border-t border-amber-200/50 dark:border-amber-800/20 pt-3 space-y-2">
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                    Se registrara como deuda a nombre de <span className="font-black text-slate-800 dark:text-white">{selectedCustomer?.name}</span>.
                                </p>
                                {totalPaidUsd > 0.01 && (
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        El cliente abona <span className="font-bold text-emerald-600">${totalPaidUsd.toFixed(2)}</span> ahora y el restante queda pendiente.
                                    </p>
                                )}
                                {totalPaidUsd <= 0.01 && (
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        El monto total de la venta quedara como deuda del cliente.
                                    </p>
                                )}
                                {selectedCustomer && (selectedCustomer.deuda || 0) > 0.01 && (
                                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-2.5 mt-2">
                                        <p className="text-[11px] sm:text-xs font-bold text-red-600 dark:text-red-400">
                                            Este cliente ya tiene una deuda de ${(selectedCustomer.deuda || 0).toFixed(2)}. La deuda total pasara a ser ${((selectedCustomer.deuda || 0) + remainingUsd).toFixed(2)}.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmFiar(false)}
                                className="flex-1 py-3.5 sm:py-4 font-bold text-sm sm:text-base text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setConfirmFiar(false); handleConfirm(); }}
                                className="flex-1 py-3.5 sm:py-4 font-black text-sm sm:text-base text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                            >
                                Confirmar fiado
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
