import React, { useState, useRef } from 'react';
import {
    ArrowLeft, Store, Printer, Coins, Package, CreditCard, Database,
    Palette, Fingerprint, Upload, Download, Share2, Check, X,
    AlertTriangle, Copy, Sun, Moon, ChevronRight, Trash2, Users, FileText, Lock
} from 'lucide-react';
import { showToast } from '../components/Toast';
import PaymentMethodsManager from '../components/Settings/PaymentMethodsManager';
import AuditLogViewer from '../components/Settings/AuditLogViewer';
import { useSecurity } from '../hooks/useSecurity';
import { useProductContext } from '../context/ProductContext';
import ShareInventoryModal from '../components/ShareInventoryModal';
import { useAudit } from '../hooks/useAudit';
import SettingsTabNegocio from '../components/Settings/tabs/SettingsTabNegocio';
import SettingsTabVentas from '../components/Settings/tabs/SettingsTabVentas';
import SettingsTabUsuarios from '../components/Settings/tabs/SettingsTabUsuarios';
import SettingsTabSistema from '../components/Settings/tabs/SettingsTabSistema';
import { Toggle, SectionCard } from '../components/Settings/SettingsUI';
import { useCloudBackup } from '../hooks/useCloudBackup';
import { useDataImportExport } from '../hooks/useDataImportExport';
import { useAuthStore } from '../hooks/store/useAuthStore';


// ───────────────────────────────────────────────────── Tab Config
const TABS = [
    { id: 'negocio', label: 'Negocio', icon: Store },
    { id: 'ventas', label: 'Ventas', icon: CreditCard },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'sistema', label: 'Sistema', icon: Database },
];

// ═══════════════════════════════════════════════════════ MAIN
export default function SettingsView({ onClose, theme, toggleTheme, triggerHaptic }) {
    const {
        products, categories, setProducts, setCategories,
        copEnabled, setCopEnabled,
        autoCopEnabled, setAutoCopEnabled,
        tasaCopManual, setTasaCopManual,
        copPrimary, setCopPrimary,
        tasaCop: calculatedTasaCop
    } = useProductContext();

    const { requireLogin, setRequireLogin, usuarioActivo } = useAuthStore();
    const [autoLockMinutes, setAutoLockMinutes] = useState(() => localStorage.getItem('admin_auto_lock_minutes') || '3');

    const isAdmin = !requireLogin || !usuarioActivo || usuarioActivo.rol === 'ADMIN';

    const { deviceId, forceHeartbeat } = useSecurity();
    const { log: auditLog } = useAudit();
    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('negocio');
    const [idCopied, setIdCopied] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);

    // Business Data
    const [businessName, setBusinessName] = useState(() => localStorage.getItem('business_name') || '');
    const [businessRif, setBusinessRif] = useState(() => localStorage.getItem('business_rif') || '');
    const [paperWidth, setPaperWidth] = useState(() => localStorage.getItem('printer_paper_width') || '58');
    const [allowNegativeStock, setAllowNegativeStock] = useState(() => localStorage.getItem('allow_negative_stock') === 'true');

    const visibleTabs = TABS;

    // ─── Cloud backup hook ────────────────────────────────
    const {
        importStatus,
        setImportStatus,
        statusMessage,
        setStatusMessage,
        dataConflictPending,
        setDataConflictPending,
        handleDataConflictChoice,
    } = useCloudBackup({
        deviceId,
        auditLog,
        forceHeartbeat,
        triggerHaptic,
    });

    // ─── Data import/export hook ──────────────────────────
    const {
        showDeleteConfirm,
        setShowDeleteConfirm,
        deleteInput,
        setDeleteInput,
        handleExport,
        handleFileChange,
        handleDeleteAllData,
    } = useDataImportExport({
        auditLog,
        triggerHaptic,
        setImportStatus,
        setStatusMessage,
    });

    // ─── HANDLERS ─────────────────────────────────────────
    const handleSaveBusinessData = () => {
        localStorage.setItem('business_name', businessName);
        localStorage.setItem('business_rif', businessRif);
        localStorage.setItem('printer_paper_width', paperWidth);
        forceHeartbeat();
        showToast('Datos del negocio guardados', 'success');
        auditLog('CONFIG', 'NEGOCIO_ACTUALIZADO', `Datos negocio: ${businessName || 'sin nombre'}`);
        triggerHaptic?.();
    };

    const handleImportClick = () => fileInputRef.current?.click();

    // ─── RENDER ───────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[150] bg-slate-50 dark:bg-slate-950 flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden animate-in slide-in-from-right duration-300">

            {/* ════ MODAL: Conflicto de Datos ════ */}
            {dataConflictPending && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 pb-8 animate-in fade-in">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="bg-amber-500 px-5 py-4 text-white">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle size={20} />
                                <span className="font-black text-base">Conflicto de Datos</span>
                            </div>
                            <p className="text-xs text-white/80">Este dispositivo ya tiene datos. ¿Con cuáles quieres quedarte?</p>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleDataConflictChoice('cloud')}
                                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 active:scale-95 transition-all"
                                >
                                    <Database size={24} />
                                    <span className="text-xs font-black text-center leading-tight">Usar datos<br/>de la nube</span>
                                    <span className="text-[9px] text-indigo-400 text-center">
                                        {dataConflictPending?.cloudBackup?.timestamp
                                            ? `Guardado: ${new Date(dataConflictPending.cloudBackup.timestamp).toLocaleDateString('es-VE')}`
                                            : 'Backup en la nube'
                                        }
                                    </span>
                                </button>
                                <button
                                    onClick={() => handleDataConflictChoice('local')}
                                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400 active:scale-95 transition-all"
                                >
                                    <Download size={24} />
                                    <span className="text-xs font-black text-center leading-tight">Mantener datos<br/>de este equipo</span>
                                    <span className="text-[9px] text-emerald-400 text-center">Sube tus datos locales a la nube</span>
                                </button>
                            </div>
                            <p className="text-[9px] text-center text-slate-400 dark:text-slate-500 px-2">
                                La opción que no elijas se perderá. Esta acción no se puede deshacer.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="shrink-0 px-4 pt-[env(safe-area-inset-top)] bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 py-4">
                    <button
                        onClick={onClose}
                        className="p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Configuracion</h1>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
                    {visibleTabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); triggerHaptic?.(); }}
                                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
                                    isActive
                                        ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                                        : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <Icon size={14} />
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body - scroll */}
            <div className="flex-1 overflow-y-auto pb-[calc(3rem+env(safe-area-inset-bottom))]">
                <div className="max-w-md mx-auto p-4 space-y-4">

                                    {/* ═══ TAB: NEGOCIO ═══ */}
                    {activeTab === 'negocio' && (
                        <SettingsTabNegocio
                            businessName={businessName} setBusinessName={setBusinessName}
                            businessRif={businessRif} setBusinessRif={setBusinessRif}
                            paperWidth={paperWidth} setPaperWidth={setPaperWidth}
                            copEnabled={copEnabled} setCopEnabled={setCopEnabled}
                            autoCopEnabled={autoCopEnabled} setAutoCopEnabled={setAutoCopEnabled}
                            tasaCopManual={tasaCopManual} setTasaCopManual={setTasaCopManual}
                            copPrimary={copPrimary} setCopPrimary={setCopPrimary}
                            calculatedTasaCop={calculatedTasaCop}
                            handleSaveBusinessData={handleSaveBusinessData}
                            forceHeartbeat={forceHeartbeat}
                            showToast={showToast}
                            triggerHaptic={triggerHaptic}
                        />
                    )}

                    {/* ═══ TAB: VENTAS ═══ */}
                    {activeTab === 'ventas' && (
                        <SettingsTabVentas
                            allowNegativeStock={allowNegativeStock} setAllowNegativeStock={setAllowNegativeStock}
                            forceHeartbeat={forceHeartbeat}
                            showToast={showToast}
                            triggerHaptic={triggerHaptic}
                        />
                    )}

                    {/* ═══ TAB: USUARIOS ═══ */}
                    {activeTab === 'usuarios' && (
                        <SettingsTabUsuarios
                            requireLogin={requireLogin}
                            setRequireLogin={setRequireLogin}
                            autoLockMinutes={autoLockMinutes}
                            setAutoLockMinutes={setAutoLockMinutes}
                            showToast={showToast}
                            triggerHaptic={triggerHaptic}
                        />
                    )}

                    {/* ═══ TAB: SISTEMA ═══ */}
                    {activeTab === 'sistema' && (
                        <SettingsTabSistema
                            theme={theme} toggleTheme={toggleTheme}
                            deviceId={deviceId} idCopied={idCopied} setIdCopied={setIdCopied}
                            isAdmin={isAdmin}
                            importStatus={importStatus} statusMessage={statusMessage}
                            handleExport={handleExport}
                            handleImportClick={handleImportClick}
                            setIsShareOpen={setIsShareOpen}
                            setShowDeleteConfirm={setShowDeleteConfirm}
                            triggerHaptic={triggerHaptic}
                        />
                    )}

                    {/* Version footer */}
                    <div className="text-center py-4">
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 font-bold">PreciosAlDia Bodegas v1.0</p>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Estas seguro?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Esta accion eliminara <strong>todo el historial de ventas</strong> y dejara las estadisticas en cero.
                            <br/><br/>
                            Para confirmar, escribe <span className="font-mono font-bold text-red-500 bg-red-50 dark:bg-red-900/40 px-1 rounded">ELIMINAR</span> abajo:
                        </p>
                        <input
                            type="text"
                            value={deleteInput}
                            onChange={e => setDeleteInput(e.target.value.toUpperCase())}
                            placeholder="Escribe ELIMINAR"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center font-mono font-bold text-slate-800 dark:text-white mb-4 focus:ring-2 focus:ring-red-500/50 outline-none uppercase transition-colors"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                                className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                disabled={deleteInput !== 'ELIMINAR'}
                                onClick={handleDeleteAllData}
                                className="flex-1 py-3 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Si, borrar todo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* INPUT OCULTO — requerido para que handleImportClick funcione */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
            />

            <ShareInventoryModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
            />
        </div>
    );
}
