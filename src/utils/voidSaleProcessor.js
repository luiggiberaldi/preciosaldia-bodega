import { storageService } from './storageService';
import { logEvent } from '../services/auditService';
import { useAuthStore } from '../hooks/store/useAuthStore';
import { divR, subR, sumR } from './dinero';

const SALES_KEY = 'bodega_sales_v1';
const CUSTOMERS_KEY = 'bodega_customers_v1';

/**
 * Handles the logic of voiding a transaction, reverting stock, and reverting customer balances.
 */
export async function processVoidSale(sale, currentSales, currentProducts) {
    if (!sale) throw new Error("Sale object is required to void.");
    if (sale.status === 'ANULADA') throw new Error("Esta venta ya fue anulada.");

    return navigator.locks.request('pos_write_lock', async () => {
        // Re-read fresh sales from storage to prevent stale data
        const freshSales = await storageService.getItem(SALES_KEY, []);
        const freshSale = freshSales.find(s => s.id === sale.id);
        if (!freshSale || freshSale.status === 'ANULADA') throw new Error("Esta venta ya fue anulada.");

        // 1. Marcar venta como ANULADA
        const updatedSales = freshSales.map(s => {
            if (s.id === sale.id) return { ...s, status: 'ANULADA' };
            return s;
        });

        // 2. Revertir Stock
        let updatedProducts = [...currentProducts];
        if (sale.items && sale.items.length > 0) {
            updatedProducts = currentProducts.map(p => {
                // Un producto puede estar múltiples veces (como unidad y paquete)
                const itemsInSale = sale.items.filter(i => (i._originalId || i.id) === p.id);
                if (itemsInSale.length > 0) {
                    const totalToRestore = itemsInSale.reduce((sum, item) => {
                        if (item.isWeight) return sum + item.qty;
                        if (item._mode === 'unit') return sum + divR(item.qty, item._unitsPerPackage || 1);
                        return sum + item.qty;
                    }, 0);
                    return { ...p, stock: (p.stock || 0) + totalToRestore };
                }
                return p;
            });
        }

        // 3. Revertir Deuda/Saldo a Favor del Cliente
        const savedCustomers = await storageService.getItem(CUSTOMERS_KEY, []);
        let updatedCustomers = savedCustomers;

        const fiadoAmountUsd = sale.fiadoUsd || (sale.tipo === 'VENTA_FIADA' ? sale.totalUsd : 0) || 0;
        const favorUsed = sumR((sale.payments?.filter(p => p.methodId === 'saldo_favor') || []).map(p => p.amountUsd));

        if (sale.customerId && (fiadoAmountUsd > 0 || favorUsed > 0)) {
            updatedCustomers = savedCustomers.map(c => {
                if (c.id === sale.customerId) {
                    const newDeuda = Math.max(0, subR(c.deuda || 0, fiadoAmountUsd));
                    const newFavor = sumR(c.favor || 0, favorUsed);
                    console.log(`[Anular] Cliente ${c.name}: deuda ${c.deuda} -> ${newDeuda}, favor ${c.favor} -> ${newFavor}`);
                    return { ...c, deuda: newDeuda, favor: newFavor };
                }
                return c;
            });
        }

        // 4. Guardar todo
        await storageService.setItem(SALES_KEY, updatedSales);
        await storageService.setItem(CUSTOMERS_KEY, updatedCustomers);
        await storageService.setItem('bodega_products_v1', updatedProducts);

        const user = useAuthStore.getState().usuarioActivo;
        logEvent('VENTA', 'VENTA_ANULADA', `Venta #${sale.saleNumber || '?'} anulada - $${sale.totalUsd?.toFixed(2)}`, user, { saleId: sale.id });

        return { updatedSales, updatedProducts, updatedCustomers };
    });
}
