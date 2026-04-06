/**
 * Utilidades para abrir ventana/iframe de impresion y escribir HTML.
 */

/**
 * Abre una ventana de impresion, escribe el HTML y dispara window.print().
 * Si la ventana emergente es bloqueada, usa un iframe oculto como fallback.
 */
export function openPrintWindow(html) {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
        // Fallback: iframe oculto
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:auto;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 2000);
            }, 300);
        };
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Esperar a que cargue la imagen del logo antes de imprimir
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
            // No cerramos automaticamente para que el usuario pueda re-imprimir
        }, 400);
    };

    // Fallback si onload no dispara
    setTimeout(() => {
        try { printWindow.print(); } catch(_) {}
    }, 1500);
}
