// Categorías predefinidas para el Inventario
export const BODEGA_CATEGORIES = [
    { id: 'todos', label: 'Todos', icon: '◉', color: 'slate' },
    { id: 'bebidas', label: 'Bebidas', icon: '◆', color: 'blue' },
    { id: 'limpieza', label: 'Limpieza', icon: '◆', color: 'cyan' },
    { id: 'charcuteria', label: 'Charcutería', icon: '◆', color: 'amber' },
    { id: 'snacks', label: 'Snacks', icon: '◆', color: 'orange' },
    { id: 'granos', label: 'Granos', icon: '◆', color: 'yellow' },
    { id: 'lacteos', label: 'Lácteos', icon: '◆', color: 'slate' },
    { id: 'carnes', label: 'Carnes', icon: '◆', color: 'red' },
    { id: 'verduras', label: 'Verduras', icon: '◆', color: 'green' },
    { id: 'panaderia', label: 'Panadería', icon: '◆', color: 'amber' },
    { id: 'viveres', label: 'Víveres', icon: '◆', color: 'green' },
    { id: 'otros', label: 'Otros', icon: '◆', color: 'gray' },
];

export const UNITS = [
    { id: 'unidad', label: 'Unidad', short: 'ud' },
    { id: 'paquete', label: 'Caja/Bulto', short: 'cja' },
    { id: 'kg', label: 'Kilogramo', short: 'kg' },
    { id: 'litro', label: 'Litro', short: 'lt' },
];

// Colores de Tailwind para las pastillas de categoría
export const CATEGORY_COLORS = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
};
