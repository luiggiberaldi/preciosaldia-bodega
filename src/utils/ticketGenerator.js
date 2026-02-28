import { jsPDF } from 'jspdf';
import { formatBs } from './calculatorUtils';

/**
 * Genera un ticket PDF estilo punto de venta 80mm
 * y lo descarga o comparte via Web Share API
 */
export function generateTicketPDF(sale, bcvRate) {
    // Dimensiones ticket 80mm (ancho) x alto dinámico
    const WIDTH = 80; // mm
    const MARGIN = 5;
    const CONTENT_W = WIDTH - MARGIN * 2;

    // Calcular alto dinámico basado en contenido
    const itemCount = sale.items?.length || 0;
    const estimatedHeight = 100 + (itemCount * 10) + (sale.payments?.length > 1 ? 20 : 0);

    const doc = new jsPDF({
        unit: 'mm',
        format: [WIDTH, Math.max(estimatedHeight, 120)],
    });

    let y = 8;
    const centerX = WIDTH / 2;

    // ── ENCABEZADO ──
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.text('PRECIOS AL DIA', centerX, y, { align: 'center' });
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text('Tu Bodega Inteligente', centerX, y, { align: 'center' });
    y += 4;
    doc.text('preciosaldia.vercel.app', centerX, y, { align: 'center' });
    y += 5;

    // Línea separadora
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 4;

    // ── DATOS DE LA VENTA ──
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.text(`Orden: #${(sale.id.substring(0, 6)).toUpperCase()}`, MARGIN, y);
    y += 4;

    doc.setFont('courier', 'normal');
    doc.text(`Cliente: ${sale.customerName || 'Consumidor Final'}`, MARGIN, y);
    y += 4;

    const fecha = new Date(sale.timestamp);
    doc.text(`Fecha: ${fecha.toLocaleDateString('es-VE')}`, MARGIN, y);
    doc.text(`${fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`, WIDTH - MARGIN, y, { align: 'right' });
    y += 5;

    // Línea doble
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 1;
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 4;

    // ── DETALLE DE PRODUCTOS ──
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text('DETALLE', MARGIN, y);
    y += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);

    if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
            const qty = item.isWeight ? `${item.qty.toFixed(3)}kg` : `${item.qty}u`;
            const subtotal = (item.priceUsd * item.qty).toFixed(2);

            // Nombre del producto (truncar si es muy largo)
            const name = item.name.length > 28 ? item.name.substring(0, 25) + '...' : item.name;
            doc.text(name, MARGIN, y);
            y += 3.5;

            // Cantidad x precio = subtotal
            doc.text(`  ${qty} x $${item.priceUsd.toFixed(2)}`, MARGIN, y);
            doc.text(`$${subtotal}`, WIDTH - MARGIN, y, { align: 'right' });
            y += 4.5;
        });
    }

    // Línea separadora
    y += 1;
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 5;

    // ── TOTAL ──
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL:', MARGIN, y);
    doc.text(`$${(sale.totalUsd || 0).toFixed(2)}`, WIDTH - MARGIN, y, { align: 'right' });
    y += 5;

    // Referencia en Bs
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    const rate = sale.rate || bcvRate;
    doc.text(`Ref: ${formatBs(sale.totalBs || 0)} Bs @ ${formatBs(rate)} Bs/$`, MARGIN, y);
    y += 4;

    // Fiado
    if (sale.fiadoUsd > 0) {
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.text(`PENDIENTE (FIADO): $${sale.fiadoUsd.toFixed(2)}`, MARGIN, y);
        y += 5;
    }

    // Método de pago
    if (sale.payments && sale.payments.length > 0) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        y += 1;
        doc.line(MARGIN, y, WIDTH - MARGIN, y);
        y += 4;
        doc.text('PAGO:', MARGIN, y);
        y += 3.5;
        sale.payments.forEach(p => {
            doc.text(`  ${p.methodLabel}: $${(p.amountUsd || 0).toFixed(2)}`, MARGIN, y);
            y += 3.5;
        });
        y += 1;
    }

    // Línea doble final
    y += 2;
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 1;
    doc.line(MARGIN, y, WIDTH - MARGIN, y);
    y += 5;

    // ── PIE ──
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text('Gracias por su compra!', centerX, y, { align: 'center' });
    y += 4;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.text('Precios al Dia - POS & Inventario', centerX, y, { align: 'center' });

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
