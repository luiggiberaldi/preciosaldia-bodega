// Métodos de pago predefinidos para el POS de bodega (Sistema Bimoneda)
export const DEFAULT_PAYMENT_METHODS = [
    // ── BOLÍVARES ──
    { id: 'efectivo_bs', label: 'Efectivo Bs', icon: '💵', currency: 'BS', color: 'emerald' },
    { id: 'pago_movil', label: 'Pago Móvil', icon: '📱', currency: 'BS', color: 'indigo' },
    { id: 'punto_venta', label: 'Punto de Venta', icon: '💳', currency: 'BS', color: 'violet' },
    // ── DÓLARES ──
    { id: 'efectivo_usd', label: 'Efectivo $', icon: '💲', currency: 'USD', color: 'blue' },
];

// Colores para los métodos de pago en el checkout y dashboard
export const PAYMENT_COLORS = {
    emerald: {
        active: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        icon: 'text-emerald-500',
        bar: 'bg-emerald-500',
    },
    indigo: {
        active: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
        text: 'text-indigo-600 dark:text-indigo-400',
        icon: 'text-indigo-500',
        bar: 'bg-indigo-500',
    },
    violet: {
        active: 'border-violet-500 bg-violet-50 dark:bg-violet-900/20',
        text: 'text-violet-600 dark:text-violet-400',
        icon: 'text-violet-500',
        bar: 'bg-violet-500',
    },
    blue: {
        active: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-600 dark:text-blue-400',
        icon: 'text-blue-500',
        bar: 'bg-blue-500',
    },
};

// Helper: obtener el label de un método por su id
export const getPaymentLabel = (id) => {
    const method = DEFAULT_PAYMENT_METHODS.find(m => m.id === id);
    return method ? `${method.icon} ${method.label}` : id;
};

// Helper: obtener info completa de método
export const getPaymentMethod = (id) => {
    return DEFAULT_PAYMENT_METHODS.find(m => m.id === id) || DEFAULT_PAYMENT_METHODS[0];
};
