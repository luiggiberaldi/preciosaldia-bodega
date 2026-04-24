import { storageService } from '../utils/storageService';
import { showToast } from '../components/Toast';
import { processSaleTransaction } from '../utils/checkoutProcessor';
import { SALES_KEY } from './useSalesData';

export function useCheckoutFlow({
    cart, cartTotalUsd, cartTotalBs, cartSubtotalUsd,
    selectedCustomerId, customers, setCustomers, products, setProducts,
    effectiveRate, tasaCop, copEnabled, discountData, useAutoRate,
    setSalesData, setShowReceipt, setShowCheckout, setSelectedCustomerId,
    setCart, setCartSelectedIndex, setShowConfetti, setTodayAperturaData, setIsAperturaOpen,
    playCheckout, playError, notifyLowStock, notifySaleComplete, triggerHaptic
}) {

    const handleCheckout = async (payments, changeBreakdown) => {
        triggerHaptic && triggerHaptic();

        const opts = {
            cart, cartTotalUsd, cartTotalBs, cartSubtotalUsd, payments, changeBreakdown,
            selectedCustomerId, customers, products, effectiveRate, tasaCop, copEnabled,
            discountData, useAutoRate
        };

        const result = await processSaleTransaction(opts);

        if (!result.success) {
            console.error('Abortando venta:', result.error);
            showToast(result.error, result.error.includes('No se pueden') ? 'warning' : 'error');
            playError();
            return;
        }

        // Apply state updates using the returned optimized datasets
        setProducts(result.updatedProducts);

        if (result.updatedCustomers) {
            setCustomers(result.updatedCustomers);
        }

        setSalesData(prev => [result.sale, ...prev]);

        setShowReceipt(result.sale);
        playCheckout();
        setShowConfetti(true);
        notifyLowStock(result.updatedProducts);
        notifySaleComplete && notifySaleComplete(result.sale);

        setCart([]);
        setShowCheckout(false);
        setSelectedCustomerId('');
        setCartSelectedIndex(-1);
    };

    const handleCreateCustomer = async (name, documentId, phone) => {
        const newCustomer = { id: crypto.randomUUID(), name, documentId: documentId || '', phone: phone || '', deuda: 0, favor: 0, createdAt: new Date().toISOString() };
        const updated = [...customers, newCustomer];
        setCustomers(updated);
        await storageService.setItem('bodega_customers_v1', updated);
        return newCustomer;
    };

    const handleSaveApertura = async (data) => {
        try {
            const today = new Date().toISOString();
            const aperturaRecord = {
                id: `apertura_${Date.now()}`,
                tipo: 'APERTURA_CAJA',
                openingUsd: data.openingUsd,
                openingBs: data.openingBs,
                ...(data.openingCop ? { openingCop: data.openingCop } : {}),
                timestamp: today,
                cajaCerrada: false
            };

            const existingSales = await storageService.getItem(SALES_KEY, []);
            const updatedSales = [...existingSales, aperturaRecord];

            await storageService.setItem(SALES_KEY, updatedSales);
            setTodayAperturaData(aperturaRecord);
            setIsAperturaOpen(false);
            showToast('Caja abierta exitosamente', 'success');
            if (triggerHaptic) triggerHaptic();

        } catch (error) {
            console.error('Error al guardar apertura:', error);
            showToast('Error al abrir la caja', 'error');
            if (playError) playError();
        }
    };

    return {
        handleCheckout,
        handleCreateCustomer,
        handleSaveApertura,
    };
}
