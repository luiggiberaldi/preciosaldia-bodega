import { useState } from 'react';
import localforage from 'localforage';
import { Share2, Download, X, Copy, Check, Loader2, AlertTriangle, Database } from 'lucide-react';
import { storageService } from '../utils/storageService';

// Claves IDB a incluir en el backup completo
const ALL_IDB_KEYS = [
    'bodega_products_v1', 'my_categories_v1',
    'bodega_sales_v1', 'bodega_customers_v1',
    'bodega_suppliers_v1', 'bodega_supplier_invoices_v1',
    'bodega_accounts_v2', 'bodega_pending_cart_v1',
    'bodega_payment_methods_v1',
    'abasto_audit_log_v1',
];

// Claves LS a incluir en el backup completo
const ALL_LS_KEYS = [
    'business_name', 'business_rif',
    'printer_paper_width', 'allow_negative_stock',
    'cop_enabled', 'auto_cop_enabled', 'tasa_cop',
    'bodega_use_auto_rate', 'bodega_custom_rate',
    'bodega_inventory_view', 'street_rate_bs',
    'catalog_use_auto_usdt', 'catalog_custom_usdt_price',
    'catalog_show_cash_price', 'monitor_rates_v12',
    'premium_token',
];

// Recopilar todos los datos del dispositivo
async function collectAllData() {
    const idb = {};
    for (const key of ALL_IDB_KEYS) {
        const val = await storageService.getItem(key, null);
        if (val !== null) idb[key] = val;
    }
    const ls = {};
    for (const key of ALL_LS_KEYS) {
        const val = localStorage.getItem(key);
        if (val !== null) ls[key] = val;
    }
    return { idb, ls };
}

export default function ShareInventoryModal({ isOpen, onClose }) {
    const [tab, setTab] = useState('share'); // 'share' | 'import'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [shareCode, setShareCode] = useState('');
    const [shareInfo, setShareInfo] = useState(null); // { productCount }
    const [importCode, setImportCode] = useState('');
    const [importResult, setImportResult] = useState(null); // { idb, ls, isComplete, productCount }
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const API_URL = '/api/share';

    const handleShare = async () => {
        setLoading(true);
        setError('');
        setShareCode('');
        setShareInfo(null);

        try {
            const { idb, ls } = await collectAllData();

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idb, ls }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al compartir');

            setShareCode(data.code);
            setShareInfo({ productCount: data.productCount });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleImport = async () => {
        const clean = importCode.replace(/[-\s]/g, '').trim();
        if (!clean) return;
        setLoading(true);
        setError('');
        setImportResult(null);

        try {
            const res = await fetch(`${API_URL}?code=${clean}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al importar');

            setImportResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmImport = async () => {
        if (!importResult) return;
        setLoading(true);
        try {
            // Limpiar datos actuales
            await localforage.clear();

            // Limpiar localStorage de la app
            const appLsKeys = [
                'street_rate_bs', 'catalog_use_auto_usdt', 'catalog_custom_usdt_price',
                'catalog_show_cash_price', 'monitor_rates_v12', 'business_name', 'business_rif',
                'printer_paper_width', 'allow_negative_stock', 'cop_enabled', 'auto_cop_enabled',
                'tasa_cop', 'bodega_use_auto_rate', 'bodega_custom_rate', 'bodega_inventory_view',
                'premium_token', 'abasto-auth-storage',
            ];
            appLsKeys.forEach(k => localStorage.removeItem(k));

            if (importResult.isComplete && importResult.idb) {
                // Restauración completa
                for (const [key, value] of Object.entries(importResult.idb)) {
                    await localforage.setItem(key, value);
                }
                if (importResult.ls) {
                    for (const [key, value] of Object.entries(importResult.ls)) {
                        localStorage.setItem(key, value);
                    }
                }
            } else if (importResult.products) {
                // Formato legado — solo productos y categorías
                await localforage.setItem('bodega_products_v1', importResult.products);
                if (importResult.categories) {
                    await localforage.setItem('my_categories_v1', importResult.categories);
                }
            }

            // Recargar app para aplicar todos los cambios
            setTimeout(() => window.location.reload(), 300);
        } catch (err) {
            setError('Error al restaurar: ' + err.message);
            setLoading(false);
        }
    };

    const handleClose = () => {
        setShareCode('');
        setShareInfo(null);
        setImportCode('');
        setError('');
        setImportResult(null);
        setLoading(false);
        onClose();
    };

    // Formatear input como XXX-XXX
    const handleCodeInput = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 6);
        if (digits.length > 3) {
            setImportCode(`${digits.slice(0, 3)}-${digits.slice(3)}`);
        } else {
            setImportCode(digits);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={handleClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white">Compartir Datos</h2>
                    <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-5">
                    <button
                        onClick={() => { setTab('share'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${tab === 'share' ? 'bg-white dark:bg-slate-700 text-brand-dark shadow-sm' : 'text-slate-400'}`}
                    >
                        <Share2 size={14} /> Compartir
                    </button>
                    <button
                        onClick={() => { setTab('import'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${tab === 'import' ? 'bg-white dark:bg-slate-700 text-brand-dark shadow-sm' : 'text-slate-400'}`}
                    >
                        <Download size={14} /> Importar
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium mb-4">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                {/* TAB: Compartir */}
                {tab === 'share' && (
                    <div className="space-y-4">
                        {!shareCode ? (
                            <>
                                <div className="text-center py-4">
                                    <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                        <Database size={32} className="text-brand-dark" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-white mb-1">Backup completo</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Se compartirán <strong>todos los datos</strong>: inventario, ventas, clientes, proveedores, cierres, configuración y más.
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">El código expira en 24 horas.</p>
                                </div>
                                <button
                                    onClick={handleShare}
                                    disabled={loading}
                                    className="w-full py-3.5 bg-brand hover:bg-brand/90 text-slate-900 font-black rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                                    {loading ? 'Generando código...' : 'Generar Código'}
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-2">
                                <p className="text-xs text-slate-400 mb-2">Tu código para compartir:</p>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 mb-3">
                                    <p className="text-4xl font-black text-brand-dark tracking-[0.3em] font-mono">{shareCode}</p>
                                </div>
                                {shareInfo && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                                        ✓ {shareInfo.productCount} productos incluidos
                                    </p>
                                )}
                                <p className="text-[10px] text-slate-400 mb-4">El receptor va a Ajustes → Compartir Datos → Importar y escribe este código.</p>
                                <button
                                    onClick={handleCopy}
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                                >
                                    {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                    {copied ? '¡Copiado!' : 'Copiar Código'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Importar */}
                {tab === 'import' && (
                    <div className="space-y-4">
                        {!importResult ? (
                            <>
                                <div className="text-center py-2">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        Escribe el código de 6 dígitos para importar todos los datos.
                                    </p>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={importCode}
                                        onChange={(e) => handleCodeInput(e.target.value)}
                                        placeholder="000-000"
                                        maxLength={7}
                                        className="w-full text-center text-3xl font-black font-mono tracking-[0.3em] p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none focus:border-brand text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={handleImport}
                                    disabled={loading || importCode.replace(/\D/g, '').length !== 6}
                                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                    {loading ? 'Buscando...' : 'Importar Datos'}
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-2">
                                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <Check size={32} className="text-emerald-500" />
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-white mb-1">
                                    {importResult.isComplete ? '¡Backup completo encontrado!' : '¡Inventario encontrado!'}
                                </p>
                                {importResult.isComplete ? (
                                    <p className="text-xs text-slate-400 mb-1">
                                        Contiene <strong className="text-slate-600 dark:text-slate-200">{(importResult.idb?.bodega_products_v1?.length ?? 0)} productos</strong>,{' '}
                                        <strong className="text-slate-600 dark:text-slate-200">{(importResult.idb?.bodega_sales_v1?.length ?? 0)} ventas</strong>,{' '}
                                        <strong className="text-slate-600 dark:text-slate-200">{(importResult.idb?.bodega_customers_v1?.length ?? 0)} clientes</strong> y más.
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mb-1">
                                        <strong className="text-slate-600 dark:text-slate-200">{importResult.products?.length ?? 0} productos</strong> listos para importar.
                                    </p>
                                )}
                                <p className="text-[10px] text-amber-500 font-medium mb-4">
                                    ⚠️ Esto reemplazará todos los datos actuales del dispositivo.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setImportResult(null)}
                                        disabled={loading}
                                        className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmImport}
                                        disabled={loading}
                                        className="flex-1 py-3 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                                        {loading ? 'Restaurando...' : 'Confirmar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
