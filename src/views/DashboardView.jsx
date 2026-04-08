import React, { useState, useEffect, useRef, useMemo } from 'react';
import { processVoidSale } from '../utils/voidSaleProcessor';
import { storageService } from '../utils/storageService';
import { showToast } from '../components/Toast';
import { BarChart3, TrendingUp, Package, AlertTriangle, ShoppingCart, Store, Users, Settings } from 'lucide-react';
import { formatBs } from '../utils/calculatorUtils';
import DashboardStats from '../components/Dashboard/DashboardStats';
import DashboardPaymentBreakdown from '../components/Dashboard/DashboardPaymentBreakdown';
import SalesHistory from '../components/Dashboard/SalesHistory';
import SalesChart from '../components/Dashboard/SalesChart';
import ConfirmModal from '../components/ConfirmModal';
import CierreCajaWizard from '../components/Dashboard/CierreCajaWizard';
import { generateTicketPDF, printThermalTicket } from '../utils/ticketGenerator';
import { shareSaleWhatsApp } from '../utils/dashboardActions';
import { generateDailyClosePDF } from '../utils/dailyCloseGenerator';
import { useNotifications } from '../hooks/useNotifications';
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
            <DashboardStats
                isDemo={isDemo}
                demoTimeLeft={demoTimeLeft}
                deviceId={deviceId}
                todayTotalUsd={todayTotalUsd}
                todayTotalBs={todayTotalBs}
                todaySales={todaySales}
                todayItemsSold={todayItemsSold}
                todayExpenses={todayExpenses}
                todayExpensesUsd={todayExpensesUsd}
                todayProfit={todayProfit}
                bcvRate={bcvRate}
                todayCashFlow={todayCashFlow}
                totalDeudas={totalDeudas}
                showTopDeudas={showTopDeudas}
                setShowTopDeudas={setShowTopDeudas}
                triggerHaptic={triggerHaptic}
                onDailyClose={handleDailyClose}
            />

            {/* Pago por Metodo */}
            <DashboardPaymentBreakdown
                paymentBreakdown={paymentBreakdown}
                todayTotalBs={todayTotalBs}
                bcvRate={bcvRate}
                copEnabled={copEnabled}
                tasaCop={tasaCop}
            />

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
                onConfirm={async () => {
                    if (deleteConfirmText.trim().toUpperCase() === 'BORRAR') {
                        await storageService.setItem(SALES_KEY, []);
                        setIsDeleteModalOpen(false);
                        setDeleteConfirmText('');
                        window.location.reload();
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
