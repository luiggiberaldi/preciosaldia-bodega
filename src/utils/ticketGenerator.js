import { jsPDF } from 'jspdf';
import { formatBs } from './calculatorUtils';

/**
 * Genera un ticket PDF estilo punto de venta 80mm
 * y lo descarga o comparte via Web Share API
 */
export async function generateTicketPDF(sale, bcvRate) {
    const WIDTH = 80; // mm
    const MARGIN = 5;

    // Calcular altura estimada (muy holgada)
    const itemCount = sale.items?.length || 0;
    const paymentCount = sale.payments?.length || 0;
    const baseHeight = 110;
    const itemHeight = itemCount * 10;
    const paymentHeight = paymentCount * 6;
    const fiadoHeight = sale.fiadoUsd > 0 ? 15 : 0;
    const estimatedHeight = baseHeight + itemHeight + paymentHeight + fiadoHeight;

    const doc = new jsPDF({
        unit: 'mm',
        format: [WIDTH, Math.max(estimatedHeight, 120)],
    });

    // ── COLORS & FONTS ──
    const TEXT_DARK = [15, 23, 42];      // slate-900 (Headers/Totals)
    const TEXT_MAIN = [51, 65, 85];      // slate-700 (Body)
    const TEXT_MUTED = [100, 116, 139];  // slate-500 (Labels/Dates)
    const BORDER_COLOR = [226, 232, 240];// slate-200

    const M = MARGIN;
    const W = WIDTH - MARGIN * 2;
    const CX = WIDTH / 2;
    const rightAlignMs = WIDTH - M;
    let y = 10;

    // ── LOGO (Cabecera Blanca -> logo.png) ──
    try {
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
        });
        const logoSize = 16;
        doc.addImage(logoImg, 'PNG', CX - (logoSize / 2), y, logoSize, logoSize);
        y += logoSize + 6;
    } catch (e) {
        y += 4;
    }

    // ── STORE DETAILS ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_DARK);
    doc.text('PRECIOS AL DÍA', CX, y, { align: 'center' });
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Tu Bodega Inteligente', CX, y, { align: 'center' });
    y += 3.5;
    doc.text('preciosaldia.vercel.app', CX, y, { align: 'center' });
    y += 7;

    // ── DIVIDER ──
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1], 0); // Dotted line looks like receipt printing
    doc.line(M, y, WIDTH - M, y);
    y += 6;

    // ── TICKET INFO ──
    doc.setLineDashPattern([], 0); // reset dash
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    doc.text(`TICKET: #${sale.id.substring(0, 6).toUpperCase()}`, M, y);

    // Right align date
    const d = new Date(sale.timestamp);
    const dateStr = `${d.toLocaleDateString('es-VE')} ${d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(dateStr, WIDTH - M, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_DARK);
    doc.text(`Cliente:`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MAIN);
    doc.text(`${sale.customerName || 'Consumidor Final'}`, M + 13, y);

    y += 6;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M, y, WIDTH - M, y);
    y += 6;

    // ── ITEMS LIST ──
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('CANT', M, y);
    doc.text('DESCRIPCIÓN', M + 10, y);
    doc.text('IMPORTE', WIDTH - M, y, { align: 'right' });
    y += 5;

    const rate = sale.rate || bcvRate || 1;

    doc.setFont('helvetica', 'normal');
    if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
            const qty = item.isWeight ? `${item.qty.toFixed(3)}L/K` : `${item.qty}u`;
            const subUsd = item.priceUsd * item.qty;
            const subBs = subUsd * rate;
            const name = item.name.substring(0, 24); // Truncate cleanly

            doc.setFontSize(8);
            doc.setTextColor(...TEXT_MAIN);
            // Cantidad
            doc.text(qty, M, y);
            // Nombre
            doc.text(name, M + 10, y);
            // Precio USD
            doc.setFont('helvetica', 'bold');
            doc.text(`$${subUsd.toFixed(2)}`, WIDTH - M, y, { align: 'right' });

            y += 4;
            // Detalle Unitario / Bs
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...TEXT_MUTED);
            doc.text(`($${item.priceUsd.toFixed(2)} c/u  ·  Bs ${formatBs(subBs)})`, M + 10, y);

            y += 6;
        });
    }

    y += 2;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M, y, WIDTH - M, y);
    y += 6;

    // ── TOTALS ──
    doc.setLineDashPattern([], 0);
    const labelX = rightAlignMs - 25;

    // Tasa
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Tasa BCV:', labelX, y);
    doc.setTextColor(...TEXT_MAIN);
    doc.text(`Bs ${formatBs(rate)} / $`, rightAlignMs, y, { align: 'right' });

    y += 5;

    // BIG TOTAL USD
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...TEXT_DARK);
    doc.text('TOTAL:', labelX, y + 4);
    doc.text(`$${parseFloat(sale.totalUsd || 0).toFixed(2)}`, rightAlignMs, y + 4, { align: 'right' });

    y += 10;
    // TOTAL BS
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MAIN);
    doc.text('En Bs:', labelX, y);
    doc.text(`Bs ${formatBs(sale.totalBs || 0)}`, rightAlignMs, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M, y, rightAlignMs, y);
    y += 6;

    // ── PAYMENTS ──
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('PAGOS REALIZADOS', M, y);
    y += 5;

    if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach(p => {
            const isBs = p.methodId.includes('_bs') || p.methodId === 'pago_movil';
            const val = isBs ? `Bs ${formatBs(p.amountUsd * rate)}` : `$${(p.amountUsd || 0).toFixed(2)}`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...TEXT_MAIN);
            doc.text(p.methodLabel, M, y);
            doc.setFont('helvetica', 'bold');
            doc.text(val, rightAlignMs, y, { align: 'right' });
            y += 5;
        });
    } else if (sale.fiadoUsd > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('A Crédito / Fiado', M, y);
        doc.text(`$${sale.fiadoUsd.toFixed(2)}`, rightAlignMs, y, { align: 'right' });
        y += 5;
    }

    if (sale.fiadoUsd > 0 && sale.payments && sale.payments.length > 0) {
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(220, 38, 38); // red-600
        doc.text('SALDO PENDIENTE:', M, y);
        doc.text(`$${sale.fiadoUsd.toFixed(2)}`, rightAlignMs, y, { align: 'right' });
        y += 5;
    }

    y += 4;
    // ── FOOTER ──
    const finalY = doc.internal.pageSize.getHeight() - 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_DARK);
    doc.text('¡Gracias por tu compra!', CX, finalY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Comprobante digital sin valor fiscal', CX, finalY + 4, { align: 'center' });

    // ── DESCARGAR / COMPARTIR ──
    const filename = `ticket_${(sale.id.substring(0, 6)).toUpperCase()}.pdf`;
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            title: `Ticket #${(sale.id.substring(0, 6)).toUpperCase()}`,
            files: [file],
        }).catch(() => {
            doc.save(filename);
        });
    } else {
        doc.save(filename);
    }
}
