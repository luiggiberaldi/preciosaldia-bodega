import React from 'react';
import { Calculator, X, RefreshCw, Users, Wallet, Receipt } from 'lucide-react';
import { formatBs } from '../../utils/calculatorUtils';
import { DEFAULT_PAYMENT_METHODS, PAYMENT_COLORS } from '../../config/paymentMethods';

export default function CheckoutModal({
    onClose,
    // Cart data
    cartTotalUsd,
    cartTotalBs,
    // Checkout state
    amountGiven,
    setAmountGiven,
    amountGivenCurrency,
    setAmountGivenCurrency,
    // Payment calculations
    payments,
    totalPaidUsd,
    remainingUsd,
    remainingBs,
    changeUsd,
    changeBs,
    effectiveRate,
    // Customers
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    // Handlers
    handlePaymentMethodClick,
    removePayment,
    handleCheckout,
    onUseSaldoFavor,
    triggerHaptic,
}) {
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-3xl sm:rounded-3xl rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col sm:flex-row max-h-[90vh] sm:h-auto animate-in slide-in-from-bottom duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95">

                {/* Seccion Izquierda: Resumen y Calculadora */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-5 sm:p-6 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
                    <div>
                        <div className="flex justify-between items-center mb-4 sm:mb-6">
                            <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Calculator size={20} className="text-emerald-500 sm:w-[22px] sm:h-[22px]" />
                                Cálculo Exacto
                            </h3>
                            <button onClick={onClose} className="sm:hidden p-2 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500"><X size={16} /></button>
                        </div>

                        <div className="space-y-3 sm:space-y-4">
                            {/* Selector de Cliente */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-3 sm:p-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Users size={14} /> Cliente (Opcional)
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedCustomerId}
                                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm appearance-none"
                                    >
                                        <option value="">Consumidor Final</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.deuda !== 0 ? `(${c.deuda > 0 ? 'Debe $' + c.deuda.toFixed(2) : 'A Favor $' + Math.abs(c.deuda).toFixed(2)})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="text-xs sm:text-sm font-bold text-slate-500">Monto Total:</span>
                                <div className="text-right leading-tight">
                                    <span className="block text-xl sm:text-2xl font-black text-slate-800 dark:text-white">${cartTotalUsd.toFixed(2)}</span>
                                    <span className="block text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatBs(cartTotalBs)} Bs</span>
                                </div>
                            </div>

                            {/* Lista de Pagos Agregados */}
                            {payments.length > 0 && (
                                <div className="space-y-2 p-3 sm:p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                        <span>Pagos Recibidos</span>
                                        <span className="text-slate-600 dark:text-slate-300">${totalPaidUsd.toFixed(2)}</span>
                                    </h4>
                                    {payments.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-white dark:bg-slate-900 px-3 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                                            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                                {DEFAULT_PAYMENT_METHODS.find(m => m.id === p.methodId)?.icon} {p.methodLabel}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                                    {p.amountInputCurrency === 'USD' ? '$' : 'Bs'} {p.amountInput}
                                                </span>
                                                <button onClick={() => removePayment(p.id)} className="text-red-400 hover:text-red-600">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Input de Calculadora de Vuelto */}
                            <div className="relative flex items-center">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                                    <button onClick={() => {
                                        triggerHaptic && triggerHaptic();
                                        setAmountGivenCurrency(prev => prev === 'USD' ? 'BS' : 'USD');
                                    }}
                                        className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-black transition-colors hover:bg-slate-300 z-10 flex items-center gap-1 shadow-sm">
                                        {amountGivenCurrency} <RefreshCw size={12} />
                                    </button>
                                </div>
                                <input
                                    autoFocus={remainingUsd > 0}
                                    type="number"
                                    value={amountGiven}
                                    onChange={e => setAmountGiven(e.target.value)}
                                    placeholder="Ingresa monto..."
                                    className="w-full text-center bg-white dark:bg-slate-900 border-2 border-emerald-500/30 focus:border-emerald-500 rounded-xl py-3 sm:py-4 px-24 text-lg sm:text-xl font-black text-slate-800 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-all shadow-inner font-mono [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                    <button onClick={() => {
                                        triggerHaptic && triggerHaptic();
                                        const rest = amountGivenCurrency === 'USD' ? remainingUsd : remainingBs;
                                        setAmountGiven(rest > 0 ? (amountGivenCurrency === 'BS' ? Math.ceil(rest).toString() : Number(rest.toFixed(2)).toString()) : '');
                                    }}
                                        className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-colors hover:bg-emerald-200 dark:hover:bg-emerald-800 z-10 shadow-sm border border-emerald-200 dark:border-emerald-800 h-8 sm:h-auto flex items-center justify-center">
                                        EXACTO
                                    </button>
                                </div>
                            </div>

                            {/* Resultado de Vuelto o Restante */}
                            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all ${remainingUsd <= 0.01 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/50' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/50'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest ${remainingUsd <= 0.01 ? 'text-emerald-600' : 'text-orange-500'}`}>
                                        {remainingUsd <= 0.01 ? 'Vuelto (Sobrante)' : 'Resta por Cobrar'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className={`text-2xl sm:text-3xl font-black leading-none ${remainingUsd <= 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                        ${remainingUsd <= 0.01 ? changeUsd.toFixed(2) : remainingUsd.toFixed(2)}
                                    </span>
                                    <span className={`text-xs sm:text-sm font-bold ${remainingUsd <= 0.01 ? 'text-emerald-500' : 'text-orange-500'}`}>
                                        {formatBs(remainingUsd <= 0.01 ? changeBs : remainingBs)} Bs
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onClick={onClose} className="hidden sm:flex mt-6 text-sm font-bold text-slate-400 hover:text-slate-600 justify-center items-center gap-2">
                        <X size={16} /> Cancelar
                    </button>
                </div>

                {/* Seccion Derecha: Métodos de Pago y Checkout */}
                <div className="w-full sm:w-[360px] bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-6">
                    <h3 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
                        <Wallet size={16} /> Emitir Pago Por
                    </h3>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 sm:space-y-5 scrollbar-hide">
                        <div className="flex flex-col sm:block gap-4">
                            {/* Dólares */}
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2">Divisas (USD)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {DEFAULT_PAYMENT_METHODS.filter(m => m.currency === 'USD').map(m => (
                                        <button key={m.id} onClick={() => handlePaymentMethodClick(m.id)}
                                            className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 flex items-center sm:flex-col sm:justify-center gap-2 sm:gap-2 transition-all hover:-translate-y-0.5 border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-slate-950/50 group">
                                            <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">{m.icon}</span>
                                            <span className="text-[10px] sm:text-[11px] font-bold text-left sm:text-center leading-tight text-slate-600 dark:text-slate-400 group-hover:text-emerald-600">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bolívares */}
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2">Moneda Nacional (BS)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {DEFAULT_PAYMENT_METHODS.filter(m => m.currency === 'BS').map(m => (
                                        <button key={m.id} onClick={() => handlePaymentMethodClick(m.id)}
                                            className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 flex items-center sm:flex-col sm:justify-center gap-2 sm:gap-2 transition-all hover:-translate-y-0.5 border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-slate-950/50 group">
                                            <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">{m.icon}</span>
                                            <span className="text-[10px] sm:text-[11px] font-bold text-left sm:text-center leading-tight text-slate-600 dark:text-slate-400 group-hover:text-emerald-600">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 pt-4 mt-2 sm:border-t border-slate-100 dark:border-slate-800 space-y-2">

                        {/* Botón Saldo a Favor (Si aplica) */}
                        {customers.find(c => c.id === selectedCustomerId)?.deuda < -0.01 && remainingUsd > 0.01 && (
                            <button onClick={() => { triggerHaptic && triggerHaptic(); onUseSaldoFavor(); }}
                                className="w-full py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 font-bold text-sm rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2">
                                <Wallet size={16} /> USAR SALDO A FAVOR (${Math.abs(customers.find(c => c.id === selectedCustomerId)?.deuda || 0).toFixed(2)})
                            </button>
                        )}

                        <button onClick={handleCheckout}
                            disabled={!selectedCustomerId && remainingUsd > 0.01}
                            className={`w-full py-3.5 sm:py-4 text-white font-black text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-lg transition-all tracking-wide flex items-center justify-center gap-2 ${remainingUsd <= 0.01
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 active:scale-[0.98]'
                                : selectedCustomerId
                                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 active:scale-[0.98]'
                                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 shadow-none cursor-not-allowed'
                                }`}>
                            {remainingUsd <= 0.01 ? (
                                <><Receipt size={18} className="sm:w-[20px] sm:h-[20px]" /> CONFIRMAR VENTA</>
                            ) : selectedCustomerId ? (
                                <><Users size={18} className="sm:w-[20px] sm:h-[20px]" /> FIAR RESTANTE (${remainingUsd.toFixed(2)})</>
                            ) : (
                                <><Receipt size={18} className="sm:w-[20px] sm:h-[20px]" /> AGREGA PAGOS FALTANTES</>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
