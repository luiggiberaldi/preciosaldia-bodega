import { storageService } from './storageService';
import { procesarImpactoCliente } from './financialLogic';
import { divR, mulR, round2 } from './dinero';

/**
 * Procesa la lógica de abonar o endeudar a un cliente desde el TransactionModal.
 * Guarda en `bodega_customers_v1` y añade un registro en `bodega_sales_v1`.
 */
export async function processCustomerTransaction({
    transactionAmount,
    currencyMode,
    type,
    customer,
    paymentMethod,
    bcvRate,
    tasaCop,
    copEnabled
}) {
    // 1. Convert to float and USD
    const rawAmount = parseFloat(transactionAmount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        return { error: 'Monto inválido' };
    }
    let amountUsd = rawAmount;
    if (currencyMode === 'BS' && bcvRate > 0) amountUsd = divR(rawAmount, bcvRate);
    if (currencyMode === 'COP') {
        if (!tasaCop || tasaCop <= 0) return { error: 'Tasa COP no configurada' };
        amountUsd = divR(rawAmount, tasaCop);
    }

    // 2. Financial quadrant logic
    let transaccionOpts = {};
    if (type === 'ABONO') {
        transaccionOpts = { costoTotal: 0, pagoReal: amountUsd, vueltoParaMonedero: amountUsd };
    } else if (type === 'CREDITO') {
        transaccionOpts = { esCredito: true, deudaGenerada: amountUsd };
    }

    const updatedCustomer = procesarImpactoCliente(customer, transaccionOpts);

    // 3. Update customer storage
    const customers = await storageService.getItem('bodega_customers_v1', []);
    const newCustomers = customers.map(c => c.id === customer.id ? updatedCustomer : c);
    await storageService.setItem('bodega_customers_v1', newCustomers);

    // 4. Update sales storage
    const sales = await storageService.getItem('bodega_sales_v1', []);
    const nextSaleNumber = sales.reduce((mx, s) => Math.max(mx, s.saleNumber || 0), 0) + 1;
    const totalEnBs = currencyMode === 'BS' ? rawAmount : mulR(rawAmount, bcvRate);
    const totalEnUsd = amountUsd;
    const totalEnCop = currencyMode === 'COP' ? rawAmount : mulR(amountUsd, tasaCop);

    if (type === 'ABONO') {
        const cobroRecord = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            tipo: 'COBRO_DEUDA',
            saleNumber: nextSaleNumber,
            rate: bcvRate,
            status: 'COMPLETADA',
            clienteId: customer.id,
            clienteName: customer.name,
            totalBs: totalEnBs,
            totalUsd: totalEnUsd,
            ...(copEnabled && { totalCop: totalEnCop }),
            paymentMethod: paymentMethod, // Legacy keep just in case
            payments: [{
                methodId: paymentMethod,
                amount: currencyMode === 'USD' ? totalEnUsd : (currencyMode === 'COP' ? totalEnCop : totalEnBs),
                currency: currencyMode,
                amountUsd: totalEnUsd,
                amountBs: totalEnBs,
                methodLabel: paymentMethod.replace('_', ' ')
            }],
            items: [{ name: `Abono de deuda: ${customer.name}`, qty: 1, priceUsd: totalEnUsd, costBs: 0 }]
        };
        sales.unshift(cobroRecord);
    } else if (type === 'CREDITO') {
        const fiadoRecord = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            tipo: 'VENTA_FIADA',
            saleNumber: nextSaleNumber,
            rate: bcvRate,
            status: 'COMPLETADA',
            clienteId: customer.id,
            clienteName: customer.name,
            totalBs: totalEnBs,
            totalUsd: totalEnUsd,
            ...(copEnabled && { totalCop: totalEnCop }),
            fiadoUsd: totalEnUsd,
            items: [{ name: `Credito manual: ${customer.name}`, qty: 1, priceUsd: totalEnUsd, costBs: 0 }]
        };
        sales.unshift(fiadoRecord);
    }

    await storageService.setItem('bodega_sales_v1', sales);

    return { updatedCustomer, newCustomers };
}
