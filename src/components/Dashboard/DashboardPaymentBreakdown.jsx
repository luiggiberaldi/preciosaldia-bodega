import React from 'react';
import { DollarSign } from 'lucide-react';
import { formatBs, formatCop } from '../../utils/calculatorUtils';
import { getPaymentLabel, toTitleCase, getPaymentIcon, PAYMENT_ICONS } from '../../config/paymentMethods';

export default function DashboardPaymentBreakdown({
    paymentBreakdown, todayTotalBs, bcvRate, copEnabled, tasaCop,
}) {
    if (Object.keys(paymentBreakdown).length === 0) return null;

    const allEntries = Object.entries(paymentBreakdown).filter(([, d]) => d.total > 0);
    const fiadoMethods = allEntries.filter(([, d]) => d.currency === 'FIADO' && !d.isChange);
    const bsMethods    = allEntries.filter(([, d]) => (d.currency === 'BS' || (!d.currency)) && !d.isChange);
    const usdMethods   = allEntries.filter(([, d]) => d.currency === 'USD' && !d.isChange);
    const copMethods   = allEntries.filter(([, d]) => d.currency === 'COP' && !d.isChange);
    const vueltoBs     = allEntries.filter(([, d]) => d.isChange && d.currency === 'BS');
    const vueltoUsd    = allEntries.filter(([, d]) => d.isChange && d.currency === 'USD');

    const subtotalBs   = bsMethods.reduce((s, [, d]) => s + d.total, 0);
    const subtotalUsd  = usdMethods.reduce((s, [, d]) => s + d.total, 0);
    const subtotalCop  = copMethods.reduce((s, [, d]) => s + d.total, 0);
    const totalVueltoBs  = vueltoBs.reduce((s, [, d]) => s + d.total, 0);
    const totalVueltoUsd = vueltoUsd.reduce((s, [, d]) => s + d.total, 0);
    const netoBs  = subtotalBs - totalVueltoBs;
    const netoUsd = subtotalUsd - totalVueltoUsd;

    const isCop = copEnabled && tasaCop > 0;

    // Convert any amount to Bs equivalent for consistent % calculation
    const toBsEquiv = (data) => {
        if (data.currency === 'USD' || data.currency === 'FIADO') return data.total * bcvRate;
        if (data.currency === 'COP') return tasaCop > 0 ? (data.total / tasaCop) * bcvRate : 0;
        return data.total;
    };

    const grandTotalBsEquiv = allEntries
        .filter(([, d]) => !d.isChange)
        .reduce((s, [, d]) => s + toBsEquiv(d), 0);

    // Secondary line: shows the other 2 currencies
    const SecondaryLine = ({ usd, bs, cop, omit }) => {
        if (!isCop) return null;
        const parts = [];
        if (omit !== 'cop') parts.push(`${formatCop(cop)} COP`);
        if (omit !== 'usd') parts.push(`USD ${usd.toFixed(2)}`);
        if (omit !== 'bs' && bcvRate > 0) parts.push(`${formatBs(bs)} Bs`);
        return <div className="text-[10px] text-slate-400 font-medium">{parts.join(' · ')}</div>;
    };

    const renderMethod = ([method, data], nativeCurrency) => {
        const label = toTitleCase(getPaymentLabel(method, data.label));
        const PayIcon = getPaymentIcon(method) || PAYMENT_ICONS[method];
        const bsEquiv = toBsEquiv(data);
        const pct = grandTotalBsEquiv > 0 ? (bsEquiv / grandTotalBsEquiv * 100) : 0;

        // Always show native currency as primary
        let displayAmount;
        if (data.currency === 'BS' || (!data.currency)) {
            displayAmount = `${formatBs(data.total)} Bs`;
        } else if (data.currency === 'USD' || data.currency === 'FIADO') {
            displayAmount = `USD ${data.total.toFixed(2)}`;
        } else if (data.currency === 'COP') {
            displayAmount = `${formatCop(data.total)} COP`;
        }

        // Calculate equivalents for secondary line
        let usdVal, bsVal, copVal;
        if (data.currency === 'BS' || (!data.currency)) {
            usdVal = bcvRate > 0 ? data.total / bcvRate : 0;
            bsVal = data.total;
            copVal = usdVal * (tasaCop || 0);
        } else if (data.currency === 'USD' || data.currency === 'FIADO') {
            usdVal = data.total;
            bsVal = data.total * bcvRate;
            copVal = data.total * (tasaCop || 0);
        } else if (data.currency === 'COP') {
            copVal = data.total;
            usdVal = tasaCop > 0 ? data.total / tasaCop : 0;
            bsVal = usdVal * bcvRate;
        }

        const omitCurrency = (data.currency === 'BS' || !data.currency) ? 'bs'
            : (data.currency === 'COP') ? 'cop' : 'usd';

        return (
            <div key={method}>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                        {PayIcon && <PayIcon size={14} className="text-slate-400" />}
                        {label}
                    </span>
                    <div className="text-right">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700 dark:text-white">{displayAmount}</span>
                            {data.currency !== 'FIADO' && <span className="text-[10px] text-slate-400 font-medium w-8 text-right">{pct.toFixed(0)}%</span>}
                        </div>
                        {isCop && <SecondaryLine usd={usdVal} bs={bsVal} cop={copVal} omit={omitCurrency} />}
                    </div>
                </div>
                {data.currency !== 'FIADO' && (
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                )}
            </div>
        );
    };

    const renderVuelto = ([method, data]) => {
        const bsEquiv = toBsEquiv(data);
        const pct = grandTotalBsEquiv > 0 ? (bsEquiv / grandTotalBsEquiv * 100) : 0;
        const isUsd = data.currency === 'USD';
        const displayAmount = isUsd ? `USD ${data.total.toFixed(2)}` : `${formatBs(data.total)} Bs`;

        let usdVal, bsVal, copVal;
        if (isUsd) {
            usdVal = data.total; bsVal = data.total * bcvRate; copVal = data.total * (tasaCop || 0);
        } else {
            bsVal = data.total; usdVal = bcvRate > 0 ? data.total / bcvRate : 0; copVal = usdVal * (tasaCop || 0);
        }

        return (
            <div key={method}>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-orange-500 dark:text-orange-400 font-medium">{data.label || 'Vuelto entregado'}</span>
                    <div className="text-right">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-orange-500 dark:text-orange-400">− {displayAmount}</span>
                            <span className="text-[10px] text-slate-400 font-medium w-8 text-right">{pct.toFixed(0)}%</span>
                        </div>
                        {isCop && <SecondaryLine usd={usdVal} bs={bsVal} cop={copVal} omit={isUsd ? 'usd' : 'bs'} />}
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
            </div>
        );
    };

    // Section header amounts
    const bsHeaderUsd = bcvRate > 0 ? (totalVueltoBs > 0 ? Math.abs(netoBs) / bcvRate : subtotalBs / bcvRate) : 0;
    const usdHeaderVal = totalVueltoUsd > 0 ? Math.abs(netoUsd) : subtotalUsd;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm relative z-10" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
                <DollarSign size={12} /> Medios de Pago
            </h3>

            {fiadoMethods.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Por Cobrar</span>
                        <div className="text-right">
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                USD {fiadoMethods.reduce((s, [,d]) => s + d.total, 0).toFixed(2)}
                            </span>
                            {isCop && (() => {
                                const totalFiado = fiadoMethods.reduce((s, [,d]) => s + d.total, 0);
                                return <div className="text-[10px] text-slate-400 font-medium">
                                    {formatCop(totalFiado * tasaCop)} COP · {formatBs(totalFiado * bcvRate)} Bs
                                </div>;
                            })()}
                        </div>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-amber-200 dark:border-amber-800/40">
                        <div className="pl-3 space-y-3">{fiadoMethods.map(e => renderMethod(e, 'USD'))}</div>
                    </div>
                </div>
            )}

            {(bsMethods.length > 0 || vueltoBs.length > 0) && (
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Bolívares</span>
                        <div className="text-right">
                            <span className={`text-xs font-black ${totalVueltoBs > 0 ? 'text-cyan-500 dark:text-cyan-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {totalVueltoBs > 0
                                    ? `${netoBs < 0 ? '−' : ''}${formatBs(Math.abs(netoBs))} Bs neto`
                                    : `${formatBs(subtotalBs)} Bs`}
                            </span>
                            {isCop && (
                                <div className="text-[10px] text-slate-400 font-medium">
                                    {formatCop(bsHeaderUsd * tasaCop)} COP · USD {bsHeaderUsd.toFixed(2)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-blue-200 dark:border-blue-800/40">
                        <div className="pl-3 space-y-3">
                            {bsMethods.map(e => renderMethod(e, 'BS'))}
                            {vueltoBs.map(renderVuelto)}
                        </div>
                    </div>
                </div>
            )}

            {(usdMethods.length > 0 || vueltoUsd.length > 0) && (
                <div className={copMethods.length > 0 ? 'mb-3' : ''}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Dólares</span>
                        <div className="text-right">
                            <span className={`text-xs font-black ${totalVueltoUsd > 0 ? 'text-cyan-500 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {totalVueltoUsd > 0
                                    ? `${netoUsd < 0 ? '−' : ''}USD ${Math.abs(netoUsd).toFixed(2)} neto`
                                    : `USD ${subtotalUsd.toFixed(2)}`}
                            </span>
                            {isCop && (
                                <div className="text-[10px] text-slate-400 font-medium">
                                    {formatCop(usdHeaderVal * tasaCop)} COP · {formatBs(usdHeaderVal * bcvRate)} Bs
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-emerald-200 dark:border-emerald-800/40">
                        <div className="pl-3 space-y-3">
                            {usdMethods.map(e => renderMethod(e, 'USD'))}
                            {vueltoUsd.map(renderVuelto)}
                        </div>
                    </div>
                </div>
            )}

            {copEnabled && copMethods.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pesos Colombianos</span>
                        <div className="text-right">
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">{formatCop(subtotalCop)} COP</span>
                            {isCop && (() => {
                                const copUsd = tasaCop > 0 ? subtotalCop / tasaCop : 0;
                                return <div className="text-[10px] text-slate-400 font-medium">
                                    USD {copUsd.toFixed(2)} · {formatBs(copUsd * bcvRate)} Bs
                                </div>;
                            })()}
                        </div>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-amber-200 dark:border-amber-800/40">
                        <div className="pl-3 space-y-3">{copMethods.map(e => renderMethod(e, 'COP'))}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
