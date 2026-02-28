import React, { useState, useEffect } from 'react';
import { storageService } from '../utils/storageService';
import { showToast } from '../components/Toast';
import { Users, Search, Plus, CreditCard, ArrowDownRight, ArrowUpRight, User, Phone, X, Save, RefreshCw } from 'lucide-react';
import { formatBs, formatUsd } from '../utils/calculatorUtils';
import { procesarImpactoCliente } from '../utils/financialLogic';
import { DEFAULT_PAYMENT_METHODS } from '../config/paymentMethods';
import ConfirmModal from '../components/ConfirmModal';

export default function CustomersView({ triggerHaptic }) {
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Modal de Abono / Crédito
    const [transactionModal, setTransactionModal] = useState({ isOpen: false, type: null, customer: null }); // type: 'ABONO' | 'CREDITO'
    const [amountBs, setAmountBs] = useState('');
    const [currencyMode, setCurrencyMode] = useState('BS'); // 'BS' | 'USD'
    const [paymentMethod, setPaymentMethod] = useState('efectivo_bs');
    const [resetBalanceCustomer, setResetBalanceCustomer] = useState(null);
    const [bcvRate, setBcvRate] = useState(0);

    useEffect(() => {
        // Leer tasa BCV del storage para conversión
        storageService.getItem('bcv_rate_v1', 0).then(r => setBcvRate(r || 0));
    }, []);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        const saved = await storageService.getItem('my_customers_v1', []);
        setCustomers(saved);
    };

    const saveCustomers = async (updatedCustomers) => {
        setCustomers(updatedCustomers);
        await storageService.setItem('my_customers_v1', updatedCustomers);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    const handleResetBalance = async (customer) => {
        triggerHaptic();
        setResetBalanceCustomer(customer);
    };

    const confirmResetBalance = async () => {
        const customer = resetBalanceCustomer;
        if (!customer) return;

        const updatedCustomer = { ...customer, deuda: 0, favor: 0 };
        const newCustomers = customers.map(c => c.id === customer.id ? updatedCustomer : c);
        await saveCustomers(newCustomers);
        showToast(`Saldo reiniciado a cero para ${customer.name}`, 'success');
        setResetBalanceCustomer(null);
    };

    const handleTransaction = async () => {
        if (!amountBs || isNaN(amountBs) || parseFloat(amountBs) <= 0) return;

        triggerHaptic();

        // Convertir a Bs si el usuario ingresó en $
        const rawAmount = parseFloat(amountBs);
        const amount = currencyMode === 'USD' && bcvRate > 0 ? rawAmount * bcvRate : rawAmount;
        const { type, customer } = transactionModal;

        // 1. Aplicar la Lógica Financiera de los Cuadrantes
        let transaccionOpts = {};
        if (type === 'ABONO') {
            transaccionOpts = { costoTotal: 0, pagoReal: amount, vueltoParaMonedero: amount }; // Todo el abono es "vuelto" para matar deuda o ir a favor
        } else if (type === 'CREDITO') {
            transaccionOpts = { esCredito: true, deudaGenerada: amount };
        }

        const updatedCustomer = procesarImpactoCliente(customer, transaccionOpts);

        // 2. Guardar el Cliente actualizado
        const newCustomers = customers.map(c => c.id === customer.id ? updatedCustomer : c);
        await saveCustomers(newCustomers);

        // 3. Registrar "COBRO_DEUDA" en Ventas/Caja si es un Abono real de Dinero
        if (type === 'ABONO') {
            const sales = await storageService.getItem('bodega_sales_v1', []);
            const cobroRecord = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                tipo: 'COBRO_DEUDA', // Etiqueta clave Anti-Duplicados
                clienteId: customer.id,
                clienteName: customer.name,
                totalBs: amount,
                totalUsd: 0, // Simplificación, el abono se hizo en Bs
                paymentMethod: paymentMethod,
                items: [{ name: `Abono de deuda: ${customer.name}`, qty: 1, priceUsd: 0, costBs: 0 }]
            };
            sales.push(cobroRecord);
            await storageService.setItem('bodega_sales_v1', sales);
        }

        // Cerrar modal
        setTransactionModal({ isOpen: false, type: null, customer: null });
        setAmountBs('');
        setCurrencyMode('BS');
        setPaymentMethod('efectivo_bs');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-3 sm:p-6 overflow-y-auto scrollbar-hide">
            {/* Header */}
            <div className="shrink-0 mb-5 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Users size={26} className="text-blue-500" /> Clientes
                    </h2>
                    <p className="text-sm text-slate-400 font-medium ml-1">
                        Deudas y Saldos a Favor
                    </p>
                </div>
                <button
                    onClick={() => { triggerHaptic(); setIsAddModalOpen(true); }}
                    className="p-3 bg-blue-500 text-white rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus size={20} className="shrink-0" />
                    <span className="text-sm font-bold hidden sm:inline">Nuevo Cliente</span>
                </button>
            </div>

            {/* Búsqueda */}
            <div className="relative mb-5 shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                />
            </div>

            {/* Listado de Clientes */}
            <div className="flex-1 space-y-3 pb-20">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-10">
                        <User size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="text-slate-500 dark:text-slate-400">No se encontraron clientes.</p>
                    </div>
                ) : (
                    filteredCustomers.map(customer => (
                        <div key={customer.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                                        {customer.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{customer.name}</h3>
                                    {customer.phone && (
                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                            <Phone size={10} /> {customer.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:items-end gap-1 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                                <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end w-full sm:w-auto">
                                    <span className="text-xs font-bold text-slate-400">SALDO</span>
                                    {customer.deuda > 0 ? (
                                        <span className="text-red-500 font-black text-lg flex items-center gap-1">
                                            <ArrowDownRight size={16} /> -{formatBs(customer.deuda)} <span className="text-[10px]">Bs</span>
                                        </span>
                                    ) : customer.favor > 0 ? (
                                        <span className="text-emerald-500 font-black text-lg flex items-center gap-1">
                                            <ArrowUpRight size={16} /> +{formatBs(customer.favor)} <span className="text-[10px]">Bs</span>
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 font-black text-lg">0.00 <span className="text-[10px]">Bs</span></span>
                                    )}
                                </div>
                                <div className="flex flex-wrap lg:flex-nowrap gap-2 mt-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => { triggerHaptic(); setTransactionModal({ isOpen: true, type: 'CREDITO', customer }); }}
                                        className="flex-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    >
                                        + Deuda (Fiado)
                                    </button>
                                    <button
                                        onClick={() => { triggerHaptic(); setTransactionModal({ isOpen: true, type: 'ABONO', customer }); }}
                                        className="flex-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                    >
                                        + Abono
                                    </button>
                                    {(customer.deuda !== 0 || customer.favor !== 0) && (
                                        <button
                                            onClick={() => handleResetBalance(customer)}
                                            className="w-full lg:w-auto px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 mt-1 lg:mt-0"
                                            title="Poner Saldo en 0"
                                        >
                                            <RefreshCw size={12} /> Poner en 0
                                        </button>
                                    )}
                                </div>
                            </div>

                        </div>
                    ))
                )}
            </div>

            {/* Modal para Agregar Cliente */}
            {isAddModalOpen && (
                <AddCustomerModal
                    onClose={() => setIsAddModalOpen(false)}
                    onSave={async (newC) => {
                        const updated = [...customers, newC];
                        await saveCustomers(updated);
                        setIsAddModalOpen(false);
                    }}
                />
            )}

            {/* Modal para Transacción (Abono / Deuda) */}
            {transactionModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className={`text-xl font-black ${transactionModal.type === 'ABONO' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {transactionModal.type === 'ABONO' ? 'Recibir Abono' : 'Añadir a Deuda'}
                            </h3>
                            <button onClick={() => setTransactionModal({ isOpen: false, type: null, customer: null })} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                Cliente: <strong className="text-slate-900 dark:text-white">{transactionModal.customer.name}</strong>
                            </p>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Monto ({transactionModal.type === 'ABONO' ? 'Pago Recibido' : 'Nuevo Fiado'}) en {currencyMode === 'BS' ? 'Bs' : '$'}</label>
                                    <button
                                        type="button"
                                        onClick={() => { setCurrencyMode(m => m === 'BS' ? 'USD' : 'BS'); setAmountBs(''); }}
                                        className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                                    >
                                        <span className={currencyMode === 'BS' ? 'text-blue-500' : 'text-slate-400'}>Bs</span>
                                        <span className="text-slate-300">/</span>
                                        <span className={currencyMode === 'USD' ? 'text-emerald-500' : 'text-slate-400'}>$</span>
                                    </button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currencyMode === 'BS' ? 'Bs' : '$'}</span>
                                    <input
                                        type="number"
                                        value={amountBs}
                                        onChange={(e) => setAmountBs(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full form-input bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pl-12 text-lg font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                                {currencyMode === 'USD' && amountBs && bcvRate > 0 && (
                                    <p className="text-[10px] text-slate-400 mt-1.5 px-1">= {formatBs(parseFloat(amountBs) * bcvRate)} Bs @ {formatBs(bcvRate)} Bs/$</p>
                                )}
                            </div>

                            {transactionModal.type === 'ABONO' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Método de Pago</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full form-select bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    >
                                        {DEFAULT_PAYMENT_METHODS.map(method => (
                                            <option key={method.id} value={method.id}>
                                                {method.icon} {method.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2 px-1">Al registrar un abono, el monto ingresará a las estadísticas y caja del día de hoy.</p>
                                </div>
                            )}

                        </div>

                        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <button
                                onClick={handleTransaction}
                                disabled={!amountBs || parseFloat(amountBs) <= 0}
                                className={`w-full py-3.5 text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex justify-center items-center gap-2 ${transactionModal.type === 'ABONO'
                                    ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50'
                                    : 'bg-red-500 hover:bg-red-600 disabled:bg-red-500/50'
                                    }`}
                            >
                                <Save size={18} /> Procesar {transactionModal.type === 'ABONO' ? 'Abono' : 'Deuda'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmación: Reiniciar Saldo */}
            <ConfirmModal
                isOpen={!!resetBalanceCustomer}
                onClose={() => setResetBalanceCustomer(null)}
                onConfirm={confirmResetBalance}
                title="Reiniciar saldo del cliente"
                message={resetBalanceCustomer ? `¿Estás seguro de reiniciar la deuda y saldo a favor a $0.00 para ${resetBalanceCustomer.name}?\n\nEsta acción es permanente y no se puede deshacer.` : ''}
                confirmText="Sí, reiniciar"
                variant="danger"
            />
        </div>
    );
}

// Sub-componente para Agregar Nuevo Cliente
function AddCustomerModal({ onClose, onSave }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({
            id: crypto.randomUUID(),
            name: name.trim(),
            phone: phone.trim(),
            deuda: 0,
            favor: 0,
            createdAt: new Date().toISOString()
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <User size={22} className="text-blue-500" /> Nuevo Cliente
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre del Cliente *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. María Pérez"
                            className="w-full form-input bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Teléfono (opcional)</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Ej. +58 412 1234567"
                            className="w-full form-input bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full py-3.5 bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl active:scale-95 transition-all mt-4 flex justify-center items-center gap-2"
                    >
                        <Save size={18} /> Guardar Cliente
                    </button>
                </form>
            </div>
        </div>
    );
}
