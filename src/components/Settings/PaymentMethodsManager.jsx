import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard } from 'lucide-react';
import { getActivePaymentMethods, savePaymentMethods, FACTORY_PAYMENT_METHODS } from '../../config/paymentMethods';
import { showToast } from '../Toast';

const ICON_OPTIONS = ['💵', '📱', '💳', '💲', '🏦', '💸', '🪙', '💰', '📲', '🔄'];

export default function PaymentMethodsManager({ triggerHaptic }) {
    const [methods, setMethods] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newCurrency, setNewCurrency] = useState('BS');
    const [newIcon, setNewIcon] = useState('💵');

    useEffect(() => {
        getActivePaymentMethods().then(setMethods);
    }, []);

    const handleAdd = async () => {
        if (!newLabel.trim()) {
            showToast('Escribe un nombre para el método', 'error');
            return;
        }
        triggerHaptic && triggerHaptic();
        const updated = [...methods, {
            id: 'custom_' + Date.now(),
            label: newLabel.trim(),
            icon: newIcon,
            currency: newCurrency,
            isFactory: false,
        }];
        await savePaymentMethods(updated);
        setMethods(updated);
        setNewLabel('');
        setShowAdd(false);
        showToast('Método de pago agregado', 'success');
    };

    const handleRemove = async (id) => {
        triggerHaptic && triggerHaptic();
        const updated = methods.filter(m => m.id !== id);
        await savePaymentMethods(updated);
        setMethods(updated);
        showToast('Método eliminado', 'success');
    };

    const methodsBs = methods.filter(m => m.currency === 'BS');
    const methodsUsd = methods.filter(m => m.currency === 'USD');

    const renderMethod = (m) => (
        <div key={m.id} className="flex items-center justify-between py-2.5 px-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-2.5">
                <span className="text-lg">{m.icon}</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{m.label}</span>
                {m.isFactory && (
                    <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Predeterminado</span>
                )}
            </div>
            {!m.isFactory && (
                <button
                    onClick={() => handleRemove(m.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <CreditCard size={16} /> Métodos de Pago
                </h3>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                >
                    <Plus size={14} /> Agregar
                </button>
            </div>

            {/* Formulario agregar */}
            {showAdd && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
                    <input
                        type="text"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Nombre del método..."
                        className="w-full py-2.5 px-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setNewCurrency('BS')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newCurrency === 'BS' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
                        >
                            Bolívares (Bs)
                        </button>
                        <button
                            onClick={() => setNewCurrency('USD')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newCurrency === 'USD' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
                        >
                            Dólares ($)
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {ICON_OPTIONS.map(icon => (
                            <button
                                key={icon}
                                onClick={() => setNewIcon(icon)}
                                className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${newIcon === icon ? 'bg-emerald-500 ring-2 ring-emerald-300 scale-110' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleAdd}
                        className="w-full py-2.5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors active:scale-[0.98]"
                    >
                        Guardar Método
                    </button>
                </div>
            )}

            {/* Sección Dólares */}
            {methodsUsd.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Dólares ($)</p>
                    {methodsUsd.map(renderMethod)}
                </div>
            )}

            {/* Sección Bolívares */}
            {methodsBs.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Bolívares (Bs)</p>
                    {methodsBs.map(renderMethod)}
                </div>
            )}
        </div>
    );
}
