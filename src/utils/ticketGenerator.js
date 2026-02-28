import { jsPDF } from 'jspdf';
import { formatBs } from './calculatorUtils';

/**
 * Genera un ticket PDF estilo punto de venta 80mm
 * y lo descarga o comparte via Web Share API
 */
export async function generateTicketPDF(sale, bcvRate) {
    const WIDTH = 80; // mm
    const MARGIN = 6;

    // Calcular altura dinámica precisa para que no se corte
    const itemCount = sale.items?.length || 0;
    const paymentCount = sale.payments?.length || 0;
    const HEIGHT_FIADO = sale.fiadoUsd > 0 ? 12 : 0;
    // Base Header (~45) + Titles (~20) + Totals (~35) + Pagos Titles (~10) + Footer (~20) = 130 + extra
    const estimatedHeight = 145 + (itemCount * 12) + (paymentCount * 6) + HEIGHT_FIADO;

    const doc = new jsPDF({
        unit: 'mm',
        format: [WIDTH, estimatedHeight],
    });

    const rate = sale.rate || bcvRate || 1;
    let y = 0;
    const centerX = WIDTH / 2;

    // ── COLORS ──
    const BRAND_BG = [15, 23, 42]; // slate-900
    const BRAND_ACCENT = [16, 185, 129]; // emerald-500
    const TEXT_MAIN = [30, 41, 59]; // slate-800
    const TEXT_MUTED = [100, 116, 139]; // slate-500
    const LIGHT_BG = [248, 250, 252]; // slate-50

    // ── HEADER (Colored Block) ──
    doc.setFillColor(...BRAND_BG);
    doc.rect(0, 0, WIDTH, 46, 'F');

    // Cargar Logo Async 
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
    });

    y = 6;
    try {
        if (logoImg.width > 0) {
            const logoWidth = 14;
            const logoHeight = 14;
            doc.addImage(logoImg, 'PNG', centerX - (logoWidth / 2), y, logoWidth, logoHeight);
            y += 17;
        } else {
            y += 6;
        }
    } catch (e) {
        y += 6;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PRECIOS AL DÍA', centerX, y, { align: 'center' });

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Tu Bodega Inteligente', centerX, y, { align: 'center' });

    y += 4;
    doc.text('preciosaldia.vercel.app', centerX, y, { align: 'center' });

    // ── ORDER INFO ──
    y += 10;
    doc.setTextColor(...TEXT_MAIN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`TICKET #${(sale.id.substring(0, 6)).toUpperCase()}`, MARGIN, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Cliente:`, MARGIN, y);
    doc.setTextColor(...TEXT_MAIN);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sale.customerName || 'Consumidor Final'}`, MARGIN + 12, y);

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    const fecha = new Date(sale.timestamp);
    doc.text(`Fecha:`, MARGIN, y);
    doc.setTextColor(...TEXT_MAIN);
    doc.text(`${fecha.toLocaleDateString('es-VE')} - ${fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`, MARGIN + 12, y);

    y += 6;
    // Separator
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 6;

    // ── ITEMS LIST ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('CANTIDAD / PRODUCTO', MARGIN, y);
    doc.text('TOTAL', WIDTH - MARGIN, y, { align: 'right' });
    y += 4;

    if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item, index) => {
            // Alternate background
            if (index % 2 === 0) {
                doc.setFillColor(...LIGHT_BG);
                doc.rect(MARGIN - 2, y - 3, WIDTH - (MARGIN * 2) + 4, 11, 'F');
            }

            const qty = item.isWeight ? `${item.qty.toFixed(3)}kg` : `${item.qty}u`;
            const subtotalUsd = item.priceUsd * item.qty;
            const subtotalBs = subtotalUsd * rate;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...TEXT_MAIN);

            // Nombre del producto (truncar)
            const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
            doc.text(`${qty} × ${name}`, MARGIN, y + 1);

            // Subtotal $
            doc.text(`$${subtotalUsd.toFixed(2)}`, WIDTH - MARGIN, y + 1, { align: 'right' });

            // Subtotal Bs / Precio unitario
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...TEXT_MUTED);
            doc.text(`(Bs ${formatBs(subtotalBs)})`, WIDTH - MARGIN, y + 5, { align: 'right' });
            doc.text(`$${item.priceUsd.toFixed(2)} c/u`, MARGIN, y + 5);

            y += 11;
        });
    }

    y += 2;
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 6;

    // ── TOTALS HIGHLIGHT BLOCK ──
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(MARGIN, y, WIDTH - (MARGIN * 2), 22, 2, 2, 'F');

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_ACCENT);
    doc.text(`TOTAL:`, MARGIN + 4, y + 2);
    doc.text(`$${(sale.totalUsd || 0).toFixed(2)}`, WIDTH - MARGIN - 4, y + 2, { align: 'right' });

    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MAIN);
    doc.text(`En Bs:`, MARGIN + 4, y);
    doc.text(`Bs ${formatBs(sale.totalBs || 0)}`, WIDTH - MARGIN - 4, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Tasa BCV: ${formatBs(rate)} Bs/$`, centerX, y, { align: 'center' });

    y += 8;

    // ── PAYMENTS & DEBT ──
    if (sale.payments && sale.payments.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MAIN);
        doc.text('MÉTODOS DE PAGO', MARGIN, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        sale.payments.forEach(p => {
            const isBs = p.methodId.includes('_bs') || p.methodId === 'pago_movil';
            const amountToShow = isBs ? `Bs ${formatBs(p.amountUsd * rate)}` : `$${(p.amountUsd || 0).toFixed(2)}`;

            doc.setTextColor(...TEXT_MUTED);
            doc.text(p.methodLabel, MARGIN, y);
            doc.setTextColor(...TEXT_MAIN);
            doc.text(amountToShow, WIDTH - MARGIN, y, { align: 'right' });
            y += 4;
        });
    }

    // Fiado / Deuda
    if (sale.fiadoUsd > 0) {
        y += 2;
        doc.setFillColor(254, 226, 226); // red-100
        doc.roundedRect(MARGIN, y - 3, WIDTH - (MARGIN * 2), 8, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(220, 38, 38); // red-600
        doc.text(`PENDIENTE DE PAGO (FIADO)`, MARGIN + 2, y + 2);
        doc.text(`$${sale.fiadoUsd.toFixed(2)}`, WIDTH - MARGIN - 2, y + 2, { align: 'right' });
        y += 8;
    }

    // ── FOOTER ──
    const finalY = Math.max(y + 10, doc.internal.pageSize.getHeight() - 15);

    doc.setDrawColor(...BRAND_ACCENT);
    doc.setLineWidth(1);
    doc.line(MARGIN, finalY - 4, WIDTH - MARGIN, finalY - 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MAIN);
    doc.text('¡Gracias por su compra!', centerX, finalY + 2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Comprobante Digital sin valor fiscal', centerX, finalY + 6, { align: 'center' });

    // ── DESCARGAR / COMPARTIR ──
    const filename = `ticket_${(sale.id.substring(0, 6)).toUpperCase()}.pdf`;
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    // Intentar usar Web Share API (ideal para móvil → WhatsApp)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            title: `Ticket #${(sale.id.substring(0, 6)).toUpperCase()}`,
            files: [file],
        }).catch(() => {
            // Fallback: descargar directamente
            doc.save(filename);
        });
    } else {
        // Desktop o navegador que no soporta share
        doc.save(filename);
    }
}
