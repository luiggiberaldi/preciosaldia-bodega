import React, { useState, useEffect, useRef } from 'react';
import { Home, ShoppingCart, Store, Users, Download, FlaskConical } from 'lucide-react';

import SalesView from './views/SalesView';
import DashboardView from './views/DashboardView';
import { ProductsView } from './views/ProductsView';
import CustomersView from './views/CustomersView';
import { TesterView } from './views/TesterView';

import { useRates } from './hooks/useRates';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [installPrompt, setInstallPrompt] = useState(null);

  const { rates, loading, isOffline, updateData } = useRates();

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  // Theme
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Haptic
  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
  };

  // Keyboard detection
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const baseHeight = useRef(0);

  useEffect(() => {
    if (!window.visualViewport) return;
    if (!baseHeight.current) baseHeight.current = window.visualViewport.height;

    const handleViewport = () => {
      setIsKeyboardOpen(window.visualViewport.height < baseHeight.current - 100);
    };
    const handleFocusBack = () => setTimeout(handleViewport, 300);

    window.visualViewport.addEventListener('resize', handleViewport);
    window.visualViewport.addEventListener('scroll', handleViewport);
    window.addEventListener('focusin', handleFocusBack);
    window.addEventListener('focusout', handleFocusBack);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewport);
      window.visualViewport?.removeEventListener('scroll', handleViewport);
      window.removeEventListener('focusin', handleFocusBack);
      window.removeEventListener('focusout', handleFocusBack);
    };
  }, []);

  const TABS = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'ventas', label: 'Vender', icon: ShoppingCart },
    { id: 'catalogo', label: 'Inventario', icon: Store },
    { id: 'clientes', label: 'Clientes', icon: Users },
  ];

  return (
    <div className="font-sans antialiased bg-slate-50 dark:bg-black h-[100dvh] flex flex-col overflow-hidden transition-colors duration-300">

      <main className={`flex-1 w-full max-w-md md:max-w-3xl lg:max-w-7xl mx-auto relative pb-24 flex flex-col ${activeTab === 'ventas' ? 'overflow-hidden' : 'overflow-y-auto'}`}>

        {activeTab === 'ventas' && (
          <ErrorBoundary>
            <SalesView rates={rates} triggerHaptic={triggerHaptic} />
          </ErrorBoundary>
        )}

        {activeTab === 'catalogo' && (
          <ErrorBoundary>
            <ProductsView rates={rates} triggerHaptic={triggerHaptic} />
          </ErrorBoundary>
        )}

        {activeTab === 'inicio' && (
          <ErrorBoundary>
            <DashboardView rates={rates} triggerHaptic={triggerHaptic} onNavigate={setActiveTab} />
          </ErrorBoundary>
        )}

        {/* HIDDEN: Tester v2.0 — descomentar para reactivar
        {activeTab === 'tester' && (
          <TesterView onBack={() => setActiveTab('inicio')} />
        )}
        */}

        {activeTab === 'clientes' && (
          <ErrorBoundary>
            <CustomersView triggerHaptic={triggerHaptic} />
          </ErrorBoundary>
        )}
      </main>

      {/* Bottom Nav */}
      {!isKeyboardOpen && (
        <div className="fixed bottom-0 left-0 right-0 px-6 pb-[env(safe-area-inset-bottom)] pt-0 mb-6 max-w-md mx-auto z-30 pointer-events-none animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl p-1.5 flex justify-between items-center shadow-2xl shadow-slate-900/30 border border-white/10 ring-1 ring-black/5 pointer-events-auto">
            {TABS.map(tab => (
              <TabButton
                key={tab.id}
                icon={<tab.icon size={20} strokeWidth={activeTab === tab.id ? 3 : 2} />}
                label={tab.label}
                isActive={activeTab === tab.id}
                onClick={() => { triggerHaptic(); setActiveTab(tab.id); }}
              />
            ))}

            {/* HIDDEN: Botón Tester — descomentar para reactivar
            {activeTab === 'inicio' && (
              <button onClick={() => { triggerHaptic(); setActiveTab('tester'); }} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-300 text-slate-600 hover:text-indigo-400 hover:bg-white/5">
                <FlaskConical size={18} strokeWidth={2} />
              </button>
            )}
            */}

            {installPrompt && activeTab === 'inicio' && (
              <button onClick={() => { triggerHaptic(); handleInstall(); }} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-300 bg-emerald-500 text-white shadow-md animate-pulse">
                <Download size={20} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
      {icon}
      {isActive && <span className="text-[9px] font-extrabold animate-in zoom-in duration-200">{label}</span>}
    </button>
  );
}