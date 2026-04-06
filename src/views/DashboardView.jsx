import React, { useState, useEffect, useRef, useMemo } from 'react';
import { processVoidSale } from '../utils/voidSaleProcessor';
import { storageService } from '../utils/storageService';
import { showToast } from '../components/Toast';
import { BarChart3, TrendingUp, Package, AlertTriangle, DollarSign, ShoppingBag, Clock, ArrowUpRight, ShoppingCart, Store, Users, ChevronDown, ChevronUp, Key, Settings, LockIcon, CheckCircle2 } from 'lucide-react';
import { formatBs } from '../utils/calculatorUtils';
import { getPaymentLabel, toTitleCase, getPaymentIcon, PAYMENT_ICONS } from '../config/paymentMethods';
import SalesHistory from '../components/Dashboard/SalesHistory';
import SalesChart from '../components/Dashboard/SalesChart';
import ConfirmModal from '../components/ConfirmModal';
import CierreCajaWizard from '../components/Dashboard/CierreCajaWizard';
import { generateTicketPDF, printThermalTicket } from '../utils/ticketGenerator';
import { shareSaleWhatsApp } from '../utils/dashboardActions';
import { generateDailyClosePDF } from '../utils/dailyCloseGenerator';
import { useNotifications } from '../hooks/useNotifications';
import AnimatedCounter from '../components/AnimatedCounter';
import SyncStatus from '../components/SyncStatus';
import { useProductContext } from '../context/ProductContext';
import { useCart } from '../context/CartContext';
import { useSecurity } from '../hooks/useSecurity';
import { useAudit } from '../hooks/useAudit';
import { getLocalISODate } from '../utils/dateHelpers';
import Skeleton from '../components/Skeleton';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { TicketClientModal, DeleteHistoryModal, RecycleOfferModal } from '../components/Dashboard/DashboardModals';

const SALES_KEY = 'bodega_sales_v1';
export default function DashboardView({ rates, triggerHaptic, onNavigate, theme, toggleTheme, isActive, isDemo, demoTimeLeft }) {
    const { notifyCierrePendiente, requestPermission } = useNotifications();
    const { deviceId } = useSecurity();
    const isAdmin = true;
    const { log: auditLog } = useAudit();
    const { products, setProducts, isLoadingProducts, effectiveRate: bcvRate, copEnabled, tasaCop } = useProductContext();
    const { loadCart } = useCart();

    // Data loading
    const { sales, setSales, customers, setCustomers, isLoadingLocal, refreshData } = useDashboardData(isActive, requestPermission);
    const isLoading = isLoadingProducts || isLoadingLocal;

    // UI state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [voidSaleTarget, setVoidSaleTarget] = useState(null);
    const [isCashReconOpen, setIsCashReconOpen] = useState(false);
    const [ticketPendingSale, setTicketPendingSale] = useState(null);
    const [ticketClientName, setTicketClientName] = useState('');
    const [ticketClientPhone, setTicketClientPhone] = useState('');
    const [ticketClientDocument, setTicketClientDocument] = useState('');
    const [recycleOffer, setRecycleOffer] = useState(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedChartDate, setSelectedChartDate] = useState(null);
    const [showTopDeudas, setShowTopDeudas] = useState(false);
    const touchStartY = useRef(0);
    const scrollRef = useRef(null);

    // Metrics
    const {
        today, todaySales, todayCashFlow, todayApertura,
        todayTotalBs, todayTotalUsd, todayItemsSold,
        todayExpenses, todayExpensesUsd, todayProfit,
        getRecentSales, weekData, lowStockProducts,
        totalDeudas, topProducts, paymentBreakdown, todayTopProducts,
    } = useDashboardMetrics(sales, customers, products, bcvRate);

    const recentSales = useMemo(() => getRecentSales(selectedChartDate), [getRecentSales, selectedChartDate]);

    // Notificar cierre de caja pendiente (>7pm con ventas o cobros sin cerrar)
    useEffect(() => {
        if (todayCashFlow.length > 0) notifyCierrePendiente(todayCashFlow.length);
    }, [todayCashFlow.length, notifyCierrePendiente]);

    // ── Funciones de Historial Avanzado ──
    const handleVoidSale = async (sale) => {
        setVoidSaleTarget(sale);
    };

    const confirmVoidSale = async () => {
        const sale = voidSaleTarget;
        if (!sale) return;
        setVoidSaleTarget(null);

        try {
            const { updatedSales, updatedProducts, updatedCustomers } = await processVoidSale(sale, sales, products);
            setSales(updatedSales);
            setProducts(updatedProducts);
            setCustomers(updatedCustomers);
            showToast('Venta anulada con éxito', 'success');
            setRecycleOffer(sale);
        } catch (error) {
            console.error('Error anulando venta:', error);
            showToast('Hubo un problema anulando la venta', 'error');
        }
    };

    const handleShareWhatsApp = (sale) => {
        const saleCustomer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;
        shareSaleWhatsApp(sale, saleCustomer, bcvRate);
    };

    const handleDownloadPDF = (sale) => {
        triggerHaptic();
        generateTicketPDF(sale, bcvRate);
    };

    const handlePrintTicket = (sale) => {
        triggerHaptic();
        printThermalTicket(sale, bcvRate);
    };

    // ── Registrar cliente para ticket ──
    const handleRegisterClientForTicket = async () => {
        if (!ticketClientName.trim() || !ticketPendingSale) return;

        const newCustomer = {
            id: crypto.randomUUID(),
            name: ticketClientName.trim(),
            documentId: ticketClientDocument.trim() || '',
            phone: ticketClientPhone.trim() || '',
            deuda: 0,
            favor: 0,
            createdAt: new Date().toISOString(),
        };

        const updatedCustomers = [...customers, newCustomer];
        setCustomers(updatedCustomers);
        await storageService.setItem('bodega_customers_v1', updatedCustomers);

        const updatedSale = {
            ...ticketPendingSale,
            customerId: newCustomer.id,
            customerName: newCustomer.name,
            customerPhone: newCustomer.phone,
        };
        const updatedSales = sales.map(s => s.id === updatedSale.id ? updatedSale : s);
        setSales(updatedSales);
        await storageService.setItem(SALES_KEY, updatedSales);

        setTicketPendingSale(null);
        setTicketClientName('');
        setTicketClientPhone('');
        setTicketClientDocument('');
        handleShareWhatsApp(updatedSale);
    };

    // Handler: Cierre de Caja
    const handleDailyClose = () => {
        triggerHaptic && triggerHaptic();
        if (todayCashFlow.length === 0 && todaySales.length === 0) {
            showToast('No hay movimientos hoy para cerrar caja', 'error');
            return;
        }
        setIsCashReconOpen(true);
    };

    const handleConfirmCashRecon = async (reconData) => {
        if (todayCashFlow.length > 0 || todaySales.length > 0) {
            const allTodayForReport = sales.filter(s => {
                const saleLocalDay = s.timestamp ? getLocalISODate(new Date(s.timestamp)) : getLocalISODate(new Date());
                return saleLocalDay === today && !s.cajaCerrada && s.tipo !== 'APERTURA_CAJA';
            });
            const salesForPDF = todayCashFlow.filter(s => s.tipo !== 'APERTURA_CAJA');

            await generateDailyClosePDF({
                sales: salesForPDF,
                allSales: allTodayForReport,
                bcvRate,
                paymentBreakdown,
                topProducts: todayTopProducts,
                todayTotalUsd,
                todayTotalBs,
                todayProfit,
                todayItemsSold,
                reconData,
                apertura: todayApertura,
            });
        }

        const currentCierreId = new Date().getTime();
        const validTiposParaCerrar = ['VENTA', 'VENTA_FIADA', 'COBRO_DEUDA', 'PAGO_PROVEEDOR', 'APERTURA_CAJA'];
        const updatedSales = sales.map(s => {
            if (!s.cajaCerrada && validTiposParaCerrar.includes(s.tipo || 'VENTA')) {
                return { ...s, cajaCerrada: true, cierreId: currentCierreId };
            }
            return s;
        });

        await storageService.setItem(SALES_KEY, updatedSales);
        setSales(updatedSales);
        setIsCashReconOpen(false);
        showToast('Cierre de caja completado (Historial conservado)', 'success');
        auditLog('VENTA', 'CIERRE_CAJA', 'Cierre de caja completado');
    };

    if (isLoading) {
        return (
            <div className="flex-1 p-3 sm:p-6 space-y-4">
                <Skeleton className="h-14 w-40 rounded-2xl" />
                <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                </div>
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-24 rounded-2xl" />
            </div>
        );
    }

    // Pull-to-refresh handlers
    const handleTouchStart = (e) => {
        if (scrollRef.current?.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
        }
    };
    const handleTouchMove = (e) => {
        if (scrollRef.current?.scrollTop > 0) return;
        const diff = e.touches[0].clientY - touchStartY.current;
        if (diff > 0) setPullDistance(Math.min(diff * 0.4, 80));
    };
    const handleTouchEnd = async () => {
        if (pullDistance > 60) {
            setIsRefreshing(true);
            await refreshData(setProducts);
            setIsRefreshing(false);
        }
        setPullDistance(0);
    };

    return (
        <div
            ref={scrollRef}
            className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-3 sm:p-6 overflow-y-auto scrollbar-hide"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull-to-refresh indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div className="flex justify-center pb-3 transition-all" style={{ height: pullDistance > 0 ? pullDistance : 40 }}>
                    <div className={`w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-brand ${isRefreshing || pullDistance > 60 ? 'animate-spin-slow' : ''}`}
                        style={{ opacity: Math.min(pullDistance / 60, 1), transform: `rotate(${pullDistance * 4}deg)` }}
                    />
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4 pt-2">
                <div className="flex flex-col items-start gap-0.5">
                    <img src={theme === 'dark' ? '/logodark.png' : '/logo.png'} alt="PreciosAlDía" className="h-14 sm:h-16 w-auto object-contain drop-shadow-sm" />
                    <div className="flex items-center gap-1.5 pl-3">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.18em] leading-none">Bodegas</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <SyncStatus />
                    <button
                        onClick={() => { triggerHaptic(); onNavigate('ajustes'); }}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 rounded-full shadow-sm hover:shadow active:scale-95 transition-all outline-none"
                        title="Configuracion"
                    >
                        <Settings size={22} className="text-slate-700 dark:text-slate-200" />
                    </button>
                </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <button onClick={() => { if (onNavigate) { triggerHaptic(); onNavigate('ventas'); } }} className="bg-brand hover:bg-brand-dark text-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all">
                    <ShoppingCart size={22} />
                    <span className="text-xs font-bold">Vender</span>
                </button>
                <button onClick={() => { if (onNavigate) { triggerHaptic(); onNavigate('catalogo'); } }} className="bg-indigo-500 text-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <Store size={22} />
                    <span className="text-xs font-bold">Inventario</span>
                </button>
                <button onClick={() => { if (onNavigate) { triggerHaptic(); onNavigate('clientes'); } }} className="bg-blue-500 text-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    <Users size={22} />
                    <span className="text-xs font-bold">Clientes</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Licencia Demo */}
                {isDemo && demoTimeLeft && (
                    <div className="col-span-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 shadow-sm relative overflow-hidden text-white flex items-center justify-between">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <Key size={20} className="text-amber-100" />
                            </div>
                            <div>
                                <h3 className="text-[13px] font-bold text-amber-50 leading-tight">Licencia de Prueba</h3>
                                <p className="text-xl font-black mt-0.5">{demoTimeLeft}</p>
                            </div>
                        </div>
                        <div className="relative z-10 text-right">
                            <button className="text-[10px] font-bold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg active:scale-95" onClick={() => window.open(`https://wa.me/584124051793?text=Hola! Quiero adquirir la licencia Premium de PreciosAlDía Bodega. Mi ID de instalación es: ${deviceId || 'N/A'}`.replace(/\s+/g, '%20'), '_blank')}>
                                ADQUIRIR
                            </button>
                        </div>
                    </div>
                )}

                {/* Ventas Hoy */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shadow-inner">
                            <span className="text-emerald-600 dark:text-emerald-400 font-black text-xl">$</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg tracking-wider">HOY</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">$<AnimatedCounter value={todayTotalUsd} /></span>
                        </div>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-0.5">{formatBs(todayTotalBs)} Bs</p>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">Ingresos brutos</p>
                    </div>
                </div>

                {/* Transacciones */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                            <ShoppingBag size={18} className="text-indigo-500" />
                        </div>
                    </div>
                    <p className="text-xl font-black text-slate-800 dark:text-white leading-none"><AnimatedCounter value={todaySales.length} /> <span className="text-xs font-bold text-slate-400">{todaySales.length === 1 ? 'venta' : 'ventas'}</span></p>
                    <p className="text-[11px] text-slate-400 mt-1"><AnimatedCounter value={todayItemsSold} /> {todayItemsSold === 1 ? 'artículo vendido' : 'artículos vendidos'}</p>
                </div>

                {/* Egresos del Día */}
                {todayExpensesUsd > 0 && (
                    <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-orange-200 dark:border-orange-800/30 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-50 dark:bg-orange-900/10 rounded-full blur-2xl"></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center shadow-inner">
                                    <Package size={20} className="text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium text-slate-400">Egresos del dia (Proveedores)</p>
                                    <p className="text-lg font-black text-orange-600 dark:text-orange-400">-$<AnimatedCounter value={todayExpensesUsd} /></p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-lg">{todayExpenses.length} {todayExpenses.length === 1 ? 'pago' : 'pagos'}</span>
                        </div>
                    </div>
                )}

                {/* Ganancia Estimada */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-green-50 dark:bg-green-900/10 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center shadow-inner">
                            <TrendingUp size={20} className="text-green-600 dark:text-green-400" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-black tracking-tight ${todayProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                {todayProfit >= 0 ? '+' : ''}${bcvRate > 0 ? (todayProfit / bcvRate).toFixed(2) : '0.00'}
                            </span>
                        </div>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-0.5">{formatBs(todayProfit)} Bs</p>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">Ganancia estimada</p>
                    </div>
                </div>

                {/* Tasa BCV */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                            <ArrowUpRight size={18} className="text-blue-500" />
                        </div>
                    </div>
                    <p className="text-xl font-black text-slate-800 dark:text-white leading-none">{formatBs(bcvRate)} <span className="text-xs font-bold text-slate-400">Bs/$</span></p>
                    <p className="text-[11px] text-slate-400 mt-1">Tasa BCV actual</p>
                </div>

                {/* BOTON CERRAR CAJA */}
                <div className="col-span-2">
                    {(todayCashFlow.length > 0 || todaySales.length > 0) ? (
                        <button
                            onClick={handleDailyClose}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl p-4 shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <LockIcon size={22} />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-black">Cerrar Caja</p>
                                    <p className="text-[11px] font-medium text-white/70">${todayTotalUsd.toFixed(2)} | {todaySales.length} {todaySales.length === 1 ? 'venta' : 'ventas'}</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <LockIcon size={16} />
                            </div>
                        </button>
                    ) : (
                        <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                                <CheckCircle2 size={20} className="text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Sin ventas pendientes</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">La caja esta limpia</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Deudas Pendientes */}
                {totalDeudas.count > 0 && (
                    <div
                        onClick={() => { setShowTopDeudas(!showTopDeudas); triggerHaptic && triggerHaptic(); }}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-red-100 dark:border-red-800/30 shadow-sm relative overflow-hidden col-span-2 cursor-pointer active:scale-[0.99] transition-all"
                    >
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-full blur-2xl"></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shadow-inner">
                                    <Users size={20} className="text-red-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-red-400 uppercase">Deudas por cobrar</p>
                                    <p className="text-xl font-black text-red-500">${totalDeudas.totalUsd.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                                <div>
                                    <p className="text-sm font-bold text-slate-400">{totalDeudas.count} {totalDeudas.count === 1 ? 'cliente' : 'clientes'}</p>
                                    {bcvRate > 0 && <p className="text-[10px] text-slate-400">{formatBs(totalDeudas.totalUsd * bcvRate)} Bs</p>}
                                </div>
                                {showTopDeudas ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                        </div>

                        {showTopDeudas && (
                            <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-800/20 space-y-2 relative z-10" style={{ animation: 'fadeIn 0.2s ease' }}>
                                {totalDeudas.top5.map((c, i) => (
                                    <div key={c.id} className="flex items-center justify-between py-1.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-[10px] font-black text-red-300 w-4 text-center shrink-0">{i + 1}</span>
                                            <div className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-black text-red-400">{c.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{c.name}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-black text-red-500">${(c.deuda || 0).toFixed(2)}</p>
                                            {bcvRate > 0 && <p className="text-[9px] text-red-400/60">{formatBs((c.deuda || 0) * bcvRate)} Bs</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pago por Metodo */}
            {Object.keys(paymentBreakdown).length > 0 && (() => {
                const entries = Object.entries(paymentBreakdown).filter(([, d]) => d.total > 0);
                const fiadoMethods = entries.filter(([, d]) => d.currency === 'FIADO');
                const bsMethods = entries.filter(([, d]) => d.currency === 'BS' || (!d.currency));
                const usdMethods = entries.filter(([, d]) => d.currency === 'USD');
                const copMethods = entries.filter(([, d]) => d.currency === 'COP');
                const subtotalBs = bsMethods.reduce((s, [, d]) => s + d.total, 0);
                const subtotalUsd = usdMethods.reduce((s, [, d]) => s + d.total, 0);
                const subtotalCop = copMethods.reduce((s, [, d]) => s + d.total, 0);
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
            })()}

            {/* Gráfica semanal */}
            <SalesChart
                weekData={weekData}
                selectedDate={selectedChartDate}
                onDayClick={(date) => {
                    triggerHaptic();
                    setSelectedChartDate(prev => prev === date ? null : date);
                    setTimeout(() => {
                        window.scrollBy({ top: 150, behavior: 'smooth' });
                    }, 50);
                }}
            />

            {/* Bajo Stock */}
            {lowStockProducts.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/30 shadow-sm mb-5">
                    <h3 className="text-xs font-bold text-amber-500 uppercase mb-3 flex items-center gap-1">
                        <AlertTriangle size={12} /> Bajo Stock ({lowStockProducts.length})
                    </h3>
                    <div className="space-y-2">
                        {lowStockProducts.map(p => (
                            <div key={p.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                    {p.image ? <img src={p.image} className="w-full h-full object-contain" /> : <Package size={14} className="text-slate-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                                </div>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${(p.stock ?? 0) === 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                    }`}>
                                    {p.stock ?? 0} {p.unit === 'kg' ? 'kg' : p.unit === 'litro' ? 'lt' : 'ud'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Productos */}
            {topProducts.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm mb-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
                        <TrendingUp size={12} /> Más Vendidos
                    </h3>
                    <div className="space-y-2">
                        {topProducts.map((p, i) => (
                            <div key={p.name} className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-500' : 'bg-orange-50 text-orange-400'
                                    }`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{p.qty} vendidos</p>
                                    <p className="text-[10px] text-slate-400">{formatBs(p.revenue)} Bs</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <SalesHistory
                sales={sales}
                recentSales={recentSales}
                bcvRate={bcvRate}
                totalSalesCount={sales.length}
                isAdmin={isAdmin}
                onVoidSale={handleVoidSale}
                onShareWhatsApp={handleShareWhatsApp}
                onDownloadPDF={handleDownloadPDF}
                onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
                onRequestClientForTicket={(sale) => {
                    triggerHaptic && triggerHaptic();
                    setTicketPendingSale(sale);
                }}
                onRecycleSale={(sale) => {
                    triggerHaptic && triggerHaptic();
                    loadCart(sale.items);
                    if (onNavigate) onNavigate('ventas');
                }}
                onPrintTicket={handlePrintTicket}
            />

            {/* Empty state */}
            {sales.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 py-10 space-y-3">
                    <BarChart3 size={64} strokeWidth={1} />
                    <p className="text-sm font-medium">Sin datos aún</p>
                    <p className="text-xs text-slate-400">Las estadísticas aparecerán cuando hagas tu primera venta</p>
                </div>
            )}

            {/* Modals */}
            <TicketClientModal
                ticketPendingSale={ticketPendingSale}
                ticketClientName={ticketClientName}
                ticketClientPhone={ticketClientPhone}
                ticketClientDocument={ticketClientDocument}
                setTicketClientName={setTicketClientName}
                setTicketClientPhone={setTicketClientPhone}
                setTicketClientDocument={setTicketClientDocument}
                onClose={() => { setTicketPendingSale(null); setTicketClientName(''); setTicketClientPhone(''); setTicketClientDocument(''); }}
                onRegister={handleRegisterClientForTicket}
            />

            <DeleteHistoryModal
                isOpen={isDeleteModalOpen}
                deleteConfirmText={deleteConfirmText}
                setDeleteConfirmText={setDeleteConfirmText}
                onClose={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
                onConfirm={() => {
                    if (deleteConfirmText.trim().toUpperCase() === 'BORRAR') {
                        setSales([]);
                        storageService.removeItem('my_sales_v1');
                        setIsDeleteModalOpen(false);
                        setDeleteConfirmText('');
                    }
                }}
            />

            <RecycleOfferModal
                recycleOffer={recycleOffer}
                onClose={() => setRecycleOffer(null)}
                onRecycle={() => {
                    loadCart(recycleOffer.items);
                    setRecycleOffer(null);
                    if (onNavigate) onNavigate('ventas');
                }}
            />

            {/* Modal Confirmación: Anular Venta */}
            <ConfirmModal
                isOpen={!!voidSaleTarget}
                onClose={() => setVoidSaleTarget(null)}
                onConfirm={confirmVoidSale}
                title={`Anular venta #${voidSaleTarget?.id?.substring(0, 6).toUpperCase() || ''}`}
                message={`Esta acción:\n• Marcará la venta como ANULADA\n• Devolverá el stock a la bodega\n• Revertirá deudas o saldos a favor\n\nEsta acción no se puede deshacer.`}
                confirmText="Sí, anular"
                variant="danger"
            />
            <CierreCajaWizard
                isOpen={isCashReconOpen}
                onClose={() => setIsCashReconOpen(false)}
                onConfirm={handleConfirmCashRecon}
                todaySales={todaySales}
                todayTotalUsd={todayTotalUsd}
                todayTotalBs={todayTotalBs}
                todayProfit={todayProfit}
                todayItemsSold={todayItemsSold}
                todayExpensesUsd={todayExpensesUsd}
                paymentBreakdown={paymentBreakdown}
                todayTopProducts={todayTopProducts}
                bcvRate={bcvRate}
                copEnabled={copEnabled}
                tasaCop={tasaCop}
            />
        </div>
    );
}
