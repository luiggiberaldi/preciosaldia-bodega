import React from 'react';
import { DollarSign, CornerDownLeft } from 'lucide-react';
import { formatBs } from '../../utils/calculatorUtils';
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

    const subtotalBs  = bsMethods.reduce((s, [, d]) => s + d.total, 0);
    const subtotalUsd = usdMethods.reduce((s, [, d]) => s + d.total, 0);
    const subtotalCop = copMethods.reduce((s, [, d]) => s + d.total, 0);
    const totalVueltoBs  = vueltoBs.reduce((s, [, d]) => s + d.total, 0);
    const totalVueltoUsd = vueltoUsd.reduce((s, [, d]) => s + d.total, 0);
    const netoBs  = Math.max(0, subtotalBs - totalVueltoBs);
    const netoUsd = Math.max(0, subtotalUsd - totalVueltoUsd);

    const fmtCop = (v) => v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const renderMethod = ([method, data]) => {
        const label = toTitleCase(getPaymentLabel(method, data.label));
        const PayIcon = getPaymentIcon(method) || PAYMENT_ICONS[method];
        let totalBsEquiv = data.total;
        let pct = 0;
        let displayAmount = `${formatBs(data.total)} Bs`;

        if (data.currency === 'FIADO') {
            totalBsEquiv = data.total * bcvRate;
            pct = todayTotalBs > 0 ? (totalBsEquiv / todayTotalBs * 100) : 0;
            displayAmount = `$ ${data.total.toFixed(2)}`;
        } else if (data.currency === 'USD') {
            totalBsEquiv = data.total * bcvRate;
            pct = todayTotalBs > 0 ? (totalBsEquiv / todayTotalBs * 100) : 0;
            displayAmount = `$ ${data.total.toFixed(2)}`;
        } else if (data.currency === 'COP') {
            totalBsEquiv = (data.total / (tasaCop || 1)) * bcvRate;
            pct = todayTotalBs > 0 ? (totalBsEquiv / todayTotalBs * 100) : 0;
            displayAmount = `${fmtCop(data.total)} COP`;
        } else {
            pct = todayTotalBs > 0 ? (data.total / todayTotalBs * 100) : 0;
        }

        return (
            <div key={method}>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                        {PayIcon && <PayIcon size={14} className="text-slate-400" />}
                        {label}
                    </span>
                    <div className="text-right">
                        <span className="font-bold text-slate-700 dark:text-white">
                            {displayAmount}
                        </span>
                        {data.currency === 'FIADO' && (
                            <div className="text-[10px] text-slate-400 font-medium">
                                {formatBs(totalBsEquiv)} Bs
                            </div>
                        )}
                    </div>
                </div>
                {data.currency !== 'FIADO' && (
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm relative z-10" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
                <DollarSign size={12} /> Desglose por Metodo
            </h3>

            {fiadoMethods.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Por Cobrar</span>
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400">${fiadoMethods.reduce((s, [,d]) => s + d.total, 0).toFixed(2)}</span>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-amber-200 dark:border-amber-800/40">
                        <div className="pl-3 space-y-3">{fiadoMethods.map(renderMethod)}</div>
                    </div>
                </div>
            )}

            {bsMethods.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Bolivares</span>
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">{formatBs(subtotalBs)} Bs</span>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-blue-200 dark:border-blue-800/40">
                        <div className="pl-3 space-y-3">{bsMethods.map(renderMethod)}</div>
                    </div>
                    {totalVueltoBs > 0 && (
                        <div className="mt-2 pl-4 space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1 text-orange-500 dark:text-orange-400 font-medium italic">
                                    <CornerDownLeft size={11} /> Vuelto entregado
                                </span>
                                <span className="font-bold text-orange-500 dark:text-orange-400">−{formatBs(totalVueltoBs)} Bs</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Neto Bs</span>
                                <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatBs(netoBs)} Bs</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {usdMethods.length > 0 && (
                <div className={copMethods.length > 0 ? 'mb-3' : ''}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Dolares</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">${subtotalUsd.toFixed(2)}</span>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-emerald-200 dark:border-emerald-800/40">
                        <div className="pl-3 space-y-3">{usdMethods.map(renderMethod)}</div>
                    </div>
                    {totalVueltoUsd > 0 && (
                        <div className="mt-2 pl-4 space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1 text-orange-500 dark:text-orange-400 font-medium italic">
                                    <CornerDownLeft size={11} /> Vuelto entregado
                                </span>
                                <span className="font-bold text-orange-500 dark:text-orange-400">−${totalVueltoUsd.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Neto USD</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${netoUsd.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {copEnabled && copMethods.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pesos Colombianos</span>
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400">{fmtCop(subtotalCop)} COP</span>
                    </div>
                    <div className="space-y-3 pl-1 border-l-2 border-amber-200 dark:border-amber-800/40">
                        <div className="pl-3 space-y-3">{copMethods.map(renderMethod)}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
