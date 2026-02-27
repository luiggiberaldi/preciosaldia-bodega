import React, { useRef } from 'react';
import { Camera, X, AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal';
import { UNITS } from '../../config/categories';

export default function ProductFormModal({
    isOpen,
    onClose,
    isEditing,

    // Product State Variables Let
    image, setImage,
    name, setName,
    category, setCategory,
    unit, setUnit,
    priceUsd, handlePriceUsdChange,
    priceBs, handlePriceBsChange,
    costUsd, handleCostUsdChange,
    costBs, handleCostBsChange,
    stock, setStock,
    lowStockAlert, setLowStockAlert,

    // Hierarchy variables (Lite)
    unitsPerPackage, setUnitsPerPackage,
    sellByUnit, setSellByUnit,
    unitPriceUsd, setUnitPriceUsd,

    // Actions
    handleImageUpload,
    handleSave,
    categories
}) {
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Editar Producto" : "Nuevo Producto"}>
            <div className="space-y-4">
                {/* Upload */}
                <div onClick={() => fileInputRef.current?.click()} className="h-28 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors relative overflow-hidden">
                    {image ? <img src={image} className="w-full h-full object-cover" alt="Product preview" /> : (
                        <>
                            <Camera size={24} className="text-slate-400 mb-2" />
                            <span className="text-xs font-bold text-slate-500">Toca para subir foto</span>
                        </>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    {image && <button onClick={(e) => { e.stopPropagation(); setImage(null); }} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full"><X size={12} /></button>}
                </div>

                <div className="space-y-3">
                    {/* Name */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block uppercase">Nombre</label>
                        <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Ej: Harina PAN 1kg"
                            className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 capitalize" />
                    </div>

                    {/* Category + Unit Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block uppercase">Categoría</label>
                            <select value={category} onChange={e => setCategory(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50">
                                {categories.filter(c => c.id !== 'todos').map(c => (
                                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block uppercase">Unidad</label>
                            <select value={unit} onChange={e => setUnit(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50">
                                {UNITS.map(u => (
                                    <option key={u.id} value={u.id}>{u.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Precios: USD y Bs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-1 mb-1 block uppercase tracking-wider">
                                Precio de Venta ($) {unit !== 'unidad' ? `/ ${unit === 'kg' ? 'Kilo' : unit === 'lt' || unit === 'litro' ? 'Litro' : unit}` : ''}
                            </label>
                            <input type="number" value={priceUsd} onChange={e => handlePriceUsdChange(e.target.value)} placeholder="1.50"
                                className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 p-3.5 sm:p-4 rounded-xl font-black text-emerald-800 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm sm:text-base" />
                        </div>
                        <div>
                            <label className="text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 ml-1 mb-1 block uppercase tracking-wider">
                                Precio de Venta (Bs) {unit !== 'unidad' ? `/ ${unit === 'kg' ? 'Kilo' : unit === 'lt' || unit === 'litro' ? 'Litro' : unit}` : ''}
                            </label>
                            <input type="number" value={priceBs} onChange={e => handlePriceBsChange(e.target.value)} placeholder="0.00"
                                className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 p-3.5 sm:p-4 rounded-xl font-black text-indigo-800 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm sm:text-base" />
                        </div>
                    </div>

                    {/* Costos: USD y Bs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 mb-1 block uppercase tracking-wider">
                                Costo ($) {unit !== 'unidad' ? `/ ${unit === 'kg' ? 'Kilo' : unit === 'lt' || unit === 'litro' ? 'Litro' : unit}` : ''}
                            </label>
                            <input type="number" value={costUsd} onChange={e => handleCostUsdChange(e.target.value)} placeholder="1.00"
                                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-slate-500/50 transition-all text-sm sm:text-base" />
                        </div>
                        <div>
                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 mb-1 block uppercase tracking-wider">
                                Costo (Bs) {unit !== 'unidad' ? `/ ${unit === 'kg' ? 'Kilo' : unit === 'lt' || unit === 'litro' ? 'Litro' : unit}` : ''}
                            </label>
                            <input type="number" value={costBs} onChange={e => handleCostBsChange(e.target.value)} placeholder="0.00"
                                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 sm:p-4 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-slate-500/50 transition-all text-sm sm:text-base" />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 min-h-[60px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margen de Ganancia Neto (Sobre USD)</p>
                        {priceUsd && parseFloat(priceUsd) > 0 && costUsd && parseFloat(costUsd) > 0 ? (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium tracking-wide">Beneficio/Unidad:</span>
                                <span className={`font-black tracking-tight ${(parseFloat(priceUsd) - parseFloat(costUsd)) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {((parseFloat(priceUsd) - parseFloat(costUsd)) / parseFloat(costUsd) * 100).toFixed(1)}%
                                    <span className="text-xs ml-2 opacity-80 font-bold">(${(parseFloat(priceUsd) - parseFloat(costUsd)).toFixed(2)})</span>
                                </span>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 italic">Ingresa Precio de Venta y Costo para calcular tu margen garantizado.</div>
                        )}
                    </div>

                    {/* ─── JERARQUÍA LITE: Paquete + Unidad ─── */}
                    {unit === 'paquete' && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 space-y-3">
                            {/* Cantidad por empaque */}
                            <div>
                                <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400 ml-1 mb-1 block uppercase">¿Cuántas unidades trae la {unit}?</label>
                                <input type="number" value={unitsPerPackage} onChange={e => setUnitsPerPackage(e.target.value)} placeholder="Ej: 24"
                                    className="w-full bg-white dark:bg-slate-800 p-3.5 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            </div>

                            {/* Toggle: Vender por unidad */}
                            {unitsPerPackage && parseInt(unitsPerPackage) > 1 && (
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer select-none p-2 rounded-lg hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors">
                                        <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${sellByUnit ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                            onClick={() => setSellByUnit(!sellByUnit)}>
                                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${sellByUnit ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                        </div>
                                        <div onClick={() => setSellByUnit(!sellByUnit)}>
                                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">¿Se vende también por unidad suelta?</span>
                                            <p className="text-[10px] text-indigo-500/70 dark:text-indigo-400/50 mt-0.5">Permite vender unidades individuales de esta {unit}</p>
                                        </div>
                                    </label>

                                    {/* Precio por unidad (auto-calculado o manual) */}
                                    {sellByUnit && (
                                        <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/40 space-y-2 animate-in fade-in slide-in-from-top-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Precio por Unidad Suelta ($)</label>
                                                {priceUsd && parseInt(unitsPerPackage) > 0 && (
                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                                        Auto: ${(parseFloat(priceUsd) / parseInt(unitsPerPackage)).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                            <input type="number" value={unitPriceUsd}
                                                onChange={e => setUnitPriceUsd(e.target.value)}
                                                placeholder={priceUsd && parseInt(unitsPerPackage) > 0 ? (parseFloat(priceUsd) / parseInt(unitsPerPackage)).toFixed(2) : '0.00'}
                                                className="w-full bg-indigo-50/50 dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl font-black text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm" />
                                            <p className="text-[9px] text-slate-400 italic">Déjalo vacío para usar el precio auto-calculado ({unit} ÷ unidades)</p>

                                            {/* Mini preview de ganancia por unidad suelta */}
                                            {(() => {
                                                const uPrice = unitPriceUsd ? parseFloat(unitPriceUsd) : (priceUsd && parseInt(unitsPerPackage) > 0 ? parseFloat(priceUsd) / parseInt(unitsPerPackage) : 0);
                                                const uCost = costUsd && parseInt(unitsPerPackage) > 0 ? parseFloat(costUsd) / parseInt(unitsPerPackage) : 0;
                                                if (uPrice > 0 && uCost > 0) {
                                                    const uMargin = ((uPrice - uCost) / uCost * 100);
                                                    return (
                                                        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-indigo-100 dark:border-indigo-900/30">
                                                            <span className="text-slate-400">Margen unitario:</span>
                                                            <span className={`font-black ${uMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {uMargin.toFixed(0)}% (${(uPrice - uCost).toFixed(2)})
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stock + Alert */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block uppercase">Stock</label>
                            <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0"
                                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-amber-500 ml-1 mb-1 block uppercase flex items-center gap-1">
                                <AlertTriangle size={10} /> Alerta mín.
                            </label>
                            <input type="number" value={lowStockAlert} onChange={e => setLowStockAlert(e.target.value)} placeholder="5"
                                className="w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-3.5 rounded-xl font-bold text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/50" />
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                    {isEditing ? "Actualizar Producto" : "Guardar Producto"}
                </button>
            </div>
        </Modal>
    );
}
