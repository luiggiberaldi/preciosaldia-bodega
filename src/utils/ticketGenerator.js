import { jsPDF } from 'jspdf';
import { formatBs } from './calculatorUtils';

/**
 * Genera un ticket PDF estilo recibo térmico 80mm
 * Diseño limpio, profesional, sin solapamientos.
 */
export async function generateTicketPDF(sale, bcvRate) {
    const WIDTH = 80; // mm
    const M = 6;      // margen lateral
    const CONTENT_W = WIDTH - M * 2;
    const CX = WIDTH / 2;
    const RIGHT = WIDTH - M;

    // ── Calcular altura dinámica ──
    const itemCount = sale.items?.length || 0;
    const paymentCount = sale.payments?.length || 0;
    const hasFiado = sale.fiadoUsd > 0;
    const hasFiadoWithPayments = hasFiado && paymentCount > 0;
    // Cada item = ~11mm (nombre + detalle + gap), cada pago = ~5mm
    const estimatedHeight = 130 + (itemCount * 11) + (paymentCount * 5) + (hasFiado ? 12 : 0) + (hasFiadoWithPayments ? 8 : 0);

    const doc = new jsPDF({
        unit: 'mm',
        format: [WIDTH, Math.max(estimatedHeight, 130)],
    });

    // ── PALETA ──
    const INK = [33, 37, 41];     // casi negro
    const BODY = [73, 80, 87];     // gris oscuro
    const MUTED = [134, 142, 150];  // gris medio
    const ACCENT = [16, 124, 65];    // verde marca
    const RULE_CLR = [206, 212, 218];  // gris claro para líneas
    const RED = [220, 53, 69];    // rojo para deuda

    const rate = sale.rate || bcvRate || 1;
    let y = 8;

    // ═══════════════════════════════════
    //  HELPER: línea separadora punteada
    // ═══════════════════════════════════
    function dottedLine(yPos) {
        doc.setDrawColor(...RULE_CLR);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(M, yPos, RIGHT, yPos);
        doc.setLineDashPattern([], 0);
    }

    // ═══════════════════════════════════
    //  CABECERA: Logo + Nombre tienda
    // ═══════════════════════════════════
    try {
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
        });
        const logoH = 14;
        const logoW = 14;
        doc.addImage(logoImg, 'PNG', CX - logoW / 2, y, logoW, logoH);
        y += logoH + 3;
    } catch (_) {
        y += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text('PRECIOS AL DÍA', CX, y, { align: 'center' });
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('Tu Bodega Inteligente', CX, y, { align: 'center' });
    y += 3;
    doc.text('preciosaldia.vercel.app', CX, y, { align: 'center' });
    y += 5;

    dottedLine(y);
    y += 5;

    // ═══════════════════════════════════
    //  INFO DEL TICKET
    // ═══════════════════════════════════
    const ticketId = sale.id.substring(0, 6).toUpperCase();
    const d = new Date(sale.timestamp);
    const dateStr = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(`Ticket #${ticketId}`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`${dateStr}  ${timeStr}`, RIGHT, y, { align: 'right' });
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    doc.text(`Cliente: ${sale.customerName || 'Consumidor Final'}`, M, y);
    y += 5;

    dottedLine(y);
    y += 5;

    // ═══════════════════════════════════
    //  ENCABEZADO DE PRODUCTOS
    // ═══════════════════════════════════
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text('CANT', M, y);
    doc.text('DESCRIPCIÓN', M + 10, y);
    doc.text('IMPORTE', RIGHT, y, { align: 'right' });
    y += 4;

    // ═══════════════════════════════════
    //  LISTA DE PRODUCTOS
    // ═══════════════════════════════════
    if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
            const qty = item.isWeight ? `${item.qty.toFixed(2)}` : `${item.qty}`;
            const unit = item.isWeight ? 'Kg' : 'u';
            const subUsd = item.priceUsd * item.qty;
            const subBs = subUsd * rate;
            const name = item.name.length > 22 ? item.name.substring(0, 22) + '…' : item.name;

            // Línea principal: cantidad, nombre, subtotal
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...INK);
            doc.text(`${qty}${unit}`, M, y);
            doc.text(name, M + 10, y);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${subUsd.toFixed(2)}`, RIGHT, y, { align: 'right' });
            y += 3.5;

            // Línea secundaria: precio unitario y equivalente Bs
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...MUTED);
            doc.text(`$${item.priceUsd.toFixed(2)} c/u  ·  Bs ${formatBs(subBs)}`, M + 10, y);
            y += 5;
        });
    }

    y += 2;
    dottedLine(y);
    y += 6;

    // ═══════════════════════════════════
    //  TASA DE CAMBIO
    // ═══════════════════════════════════
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Tasa BCV:  Bs ${formatBs(rate)} / $`, CX, y, { align: 'center' });
    y += 6;

    // ═══════════════════════════════════
    //  TOTAL EN USD (grande y centrado)
    // ═══════════════════════════════════
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('TOTAL A PAGAR', CX, y, { align: 'center' });
    y += 7;

    doc.setFontSize(18);
    doc.setTextColor(...ACCENT);
    doc.text(`$${parseFloat(sale.totalUsd || 0).toFixed(2)}`, CX, y, { align: 'center' });
    y += 5;

    // ── Total en Bs (debajo, centrado) ──
    doc.setFontSize(10);
    doc.setTextColor(...BODY);
    doc.text(`Bs ${formatBs(sale.totalBs || 0)}`, CX, y, { align: 'center' });
    y += 6;

    dottedLine(y);
    y += 6;

    // ═══════════════════════════════════
    //  PAGOS REALIZADOS
    // ═══════════════════════════════════
    if ((sale.payments && sale.payments.length > 0) || hasFiado) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text('PAGOS REALIZADOS', M, y);
        y += 4.5;

        if (sale.payments && sale.payments.length > 0) {
            sale.payments.forEach(p => {
                const isBs = p.methodId.includes('_bs') || p.methodId === 'pago_movil';
                const displayVal = isBs
                    ? `Bs ${formatBs(p.amountUsd * rate)}`
                    : `$${(p.amountUsd || 0).toFixed(2)}`;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(...BODY);
                doc.text(p.methodLabel || 'Pago', M, y);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...INK);
                doc.text(displayVal, RIGHT, y, { align: 'right' });
                y += 4.5;
            });
        }

        if (hasFiado) {
            if (paymentCount > 0) y += 1;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...RED);
            doc.text('Deuda pendiente:', M, y);
            doc.text(`$${sale.fiadoUsd.toFixed(2)}`, RIGHT, y, { align: 'right' });
            y += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(`Bs ${formatBs(sale.fiadoUsd * rate)}`, RIGHT, y, { align: 'right' });
            y += 5;
        }

        y += 2;
        dottedLine(y);
        y += 6;
    }

    // ═══════════════════════════════════
    //  PIE DE PÁGINA
    // ═══════════════════════════════════
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('¡Gracias por tu compra!', CX, y, { align: 'center' });
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text('Comprobante digital · Sin valor fiscal', CX, y, { align: 'center' });

    // ── DESCARGAR / COMPARTIR ──
    const filename = `ticket_${ticketId}.pdf`;
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            title: `Ticket #${ticketId}`,
            files: [file],
        }).catch(() => {
            doc.save(filename);
        });
    } else {
        doc.save(filename);
    }
}
