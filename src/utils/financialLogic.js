export function procesarImpactoCliente(clienteInicial, transaccion) {
    // CLONAR PARA INMUTABILIDAD
    let cliente = { ...clienteInicial };

    // INPUTS INTERMEDIOS
    const { usaSaldoFavor = 0, esCredito = false, deudaGenerada = 0, vueltoParaMonedero = 0 } = transaccion;

    // 0. Q0: CONSUMO DE SALDO A FAVOR
    if (usaSaldoFavor > 0) {
        cliente.favor = Math.max(0, (cliente.favor || 0) - usaSaldoFavor);
    }

    // 1. Q1: GENERACIÓN DE DEUDA
    if (esCredito) {
        cliente.deuda = (cliente.deuda || 0) + deudaGenerada;
    }

    // 2. Q2 & Q3: VUELTO (ABONO A DEUDA O MONEDERO)
    // El "vuelto" digital es lo que sobra que NO se entregó en efectivo.
    if (vueltoParaMonedero > 0) {
        const deudaActual = cliente.deuda || 0;

        if (deudaActual > 0.001) {
            // PRIORITY: DEBT FIRST
            if (deudaActual >= vueltoParaMonedero) {
                // Paga parte de la deuda
                cliente.deuda = parseFloat((deudaActual - vueltoParaMonedero).toFixed(2));
                // Nada al favor real, todo se consumió en deuda
            } else {
                // Paga toda la deuda y sobra
                const sobra = vueltoParaMonedero - deudaActual;
                cliente.deuda = 0;
                cliente.favor = (cliente.favor || 0) + sobra; // Q3
            }
        } else {
            // No deuda, todo a favor
            cliente.favor = (cliente.favor || 0) + vueltoParaMonedero;
        }
    }

    // 3. NORMALIZACIÓN ESTRICTA (The Golden Rule)
    const saldoNeto = (cliente.favor || 0) - (cliente.deuda || 0);

    if (saldoNeto >= 0) {
        cliente.favor = parseFloat(saldoNeto.toFixed(2));
        cliente.deuda = 0;
    } else {
        cliente.favor = 0;
        cliente.deuda = parseFloat(Math.abs(saldoNeto).toFixed(2));
    }

    return cliente;
}
