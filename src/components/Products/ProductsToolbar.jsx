import React from 'react';
import { Store, Plus, Trash2, Pencil, Search, AlertTriangle, LayoutGrid, List, ArrowUpDown, Percent, CheckSquare } from 'lucide-react';

const ProductsToolbar = ({
    products,
    categories,
    activeCategory,
    searchTerm,
    viewMode,
    selectedIds,
    lowStockCount,
    isCajero,
    categoryScrollRef,
    // Handlers
    handleSetSearchTerm,
    handleSetActiveCategory,
    toggleViewMode,
    setSelectedIds,
    setIsModalOpen,
    setIsBulkPriceOpen,
    setIsDeleteAllModalOpen,
    setIsCategoryManagerOpen,
    triggerHaptic,
    onSelectAllToast,
}) => {
    return (
        <div className="shrink-0 mb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Store size={22} className="text-brand shrink-0" />
                    <h2 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight truncate">Inventario</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {products.length > 0 && !isCajero && (
                        <>
                            <button onClick={() => { triggerHaptic && triggerHaptic(); setIsBulkPriceOpen(true); }}
                                className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-xl transition-all active:scale-95" title="Ajuste Masivo de Precios">
                                <Percent size={16} strokeWidth={2.5} />
                            </button>
                            <button onClick={() => { triggerHaptic && triggerHaptic(); setIsDeleteAllModalOpen(true); }}
                                className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-xl transition-all active:scale-95" title="Borrar Todo">
                                <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        </>
                    )}
                    {!isCajero && (
                    <button onClick={() => { triggerHaptic && triggerHaptic(); setIsModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl shadow-md shadow-brand/20 transition-all active:scale-95 font-bold text-sm" title="Agregar">
                        <Plus size={16} strokeWidth={2.5} />
                        <span className="hidden sm:inline">Nuevo</span>
                    </button>
                    )}
                </div>
            </div>

            {/* Fila 2: Stats clicables + View Toggle */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">
                    {products.length} productos
                </span>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <button
                    onClick={() => { triggerHaptic && triggerHaptic(); setSelectedIds(new Set(products.map(p => p.id))); onSelectAllToast && onSelectAllToast(); }}
                    className="text-[10px] font-bold bg-brand/10 text-brand px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-brand/20 transition-colors active:scale-95"
                >
                    <CheckSquare size={12} /> <span className="hidden sm:inline">Seleccionar todo</span><span className="sm:hidden">Todos</span>
                </button>
                {lowStockCount > 0 && (
                    <>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                        <button
                            onClick={() => { handleSetActiveCategory('bajo-stock'); triggerHaptic && triggerHaptic(); }}
                            className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                            ⚠️ {lowStockCount} bajo stock
                        </button>
                    </>
                )}
                <div className="ml-auto" />
                <button
                    onClick={toggleViewMode}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-brand hover:border-brand-light transition-all active:scale-95"
                    title={viewMode === 'grid' ? 'Cambiar a vista lista' : 'Cambiar a vista cuadrícula'}
                >
                    {viewMode === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
                </button>
            </div>

            {/* Category Filter Pills — horizontal scroll with fade */}
            <div className="relative">
                <div ref={categoryScrollRef} className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide scroll-smooth snap-x">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { handleSetActiveCategory(cat.id); triggerHaptic && triggerHaptic(); }}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all snap-start border ${activeCategory === cat.id
                                ? 'bg-brand text-white shadow-sm shadow-brand/20 border-brand'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 active:scale-95'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                    <button
                        onClick={() => { triggerHaptic && triggerHaptic(); setIsCategoryManagerOpen(true); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-transparent active:scale-95 flex items-center gap-1 snap-start"
                    >
                        <Pencil size={12} /> Editar
                    </button>
                </div>
                {/* Right fade indicator for scroll */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent sm:hidden" />
            </div>

            {/* Search Bar — slimmer on mobile */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => handleSetSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-12 pr-4 text-sm text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-brand/50 shadow-sm"
                />
            </div>
        </div>
    );
};

export default ProductsToolbar;
