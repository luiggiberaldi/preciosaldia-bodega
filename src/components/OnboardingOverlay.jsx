import React, { useState } from 'react';
import { LayoutDashboard, Calculator, Wallet, Store, ChevronRight, ChevronLeft, X } from 'lucide-react';

const STEPS = [
    {
        // Welcome slide
        type: 'welcome',
    },
    {
        icon: LayoutDashboard,
        color: 'text-amber-500',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        title: 'Inicio',
        headline: 'Ve las tasas del día al instante',
        description: 'Aquí ves la tasa Dólar USD, Dólar BCV y Euro actualizadas automáticamente cada 30 segundos.',
        tip: '💡 Toca ⛶ para ver en pantalla completa y guardar una foto de las tasas.',
    },
    {
        icon: Calculator,
        color: 'text-blue-500',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        title: 'Calculadora',
        headline: 'Convierte entre monedas al toque',
        description: 'Escribe el monto arriba, elige la moneda y la conversión aparece abajo. Funciona con Dólar USD, Dólar BCV, Euro y Bolívares.',
        tip: '💡 Toca ⇅ para invertir la conversión.',
    },
    {
        icon: Wallet,
        color: 'text-emerald-500',
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        title: 'Cuentas',
        headline: 'Guarda tus datos de pago',
        description: 'Agrega tus cuentas de Pago Móvil, Transferencia o Binance. Al enviar un monto por WhatsApp, tus datos de pago se incluyen automáticamente.',
        tip: '💡 Puedes tener varias cuentas y elegir cuál usar al enviar.',
    },
    {
        icon: Store,
        color: 'text-indigo-500',
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        title: 'Tienda',
        headline: 'Tu catálogo de productos',
        descriptionPremium: 'Agrega tus productos con foto y precio en dólares. La app calcula automáticamente el precio en Bolívares, efectivo y todas las tasas.',
        descriptionFree: 'Con TasasAlDía Business puedes gestionar tu inventario, calcular precios en todas las monedas y compartir tu catálogo por código.',
        tipPremium: '💡 Comparte tu catálogo con otros usando un código de 6 dígitos.',
        tipFree: '👑 Activa tu licencia para desbloquear esta función.',
    },
];

export default function OnboardingOverlay({ isPremium = false }) {
    const [done, setDone] = useState(
        () => localStorage.getItem('onboarding_done') === 'true'
    );
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

    if (done) return null;

    const current = STEPS[step];
    const isFirst = step === 0;
    const isLast = step === STEPS.length - 1;
    const isWelcome = current.type === 'welcome';

    const finish = () => {
        localStorage.setItem('onboarding_done', 'true');
        setDone(true);
    };

    const goNext = () => {
        if (isLast) { finish(); return; }
        setDirection(1);
        setStep(step + 1);
    };

    const goBack = () => {
        if (isFirst) return;
        setDirection(-1);
        setStep(step - 1);
    };

    return (
        <div className="fixed inset-0 z-[9998] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in duration-300 overflow-hidden">

            {/* Decorative background orbs */}
            <div className="absolute top-1/4 -left-20 w-64 h-64 bg-brand/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

            {/* Skip button */}
            <button
                onClick={finish}
                className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider z-10"
            >
                Omitir <X size={14} />
            </button>

            <div className="w-full max-w-sm">

                {/* Card */}
                <div
                    className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                    key={step}
                    style={{
                        animation: `${direction > 0 ? 'slideInRight' : 'slideInLeft'} 0.3s ease-out`,
                    }}
                >
                    {isWelcome ? (
                        /* ─── WELCOME SLIDE ─── */
                        <div className="p-8 text-center relative overflow-hidden">
                            {/* Gradient header accent */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand via-amber-400 to-brand" />

                            {/* Logo */}
                            <div className="relative mx-auto mb-5">
                                <img
                                    src="/logoprincipal.png"
                                    alt="TasasAlDía"
                                    className="w-44 h-auto mx-auto drop-shadow-lg"
                                />
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-brand/15 rounded-full blur-2xl -z-10 scale-150" />
                            </div>
                            <p className="text-xs font-bold text-brand uppercase tracking-[0.2em] mb-5">
                                Tu aliado financiero
                            </p>

                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 max-w-[260px] mx-auto">
                                Tasas en tiempo real, conversiones y herramientas diseñadas para el comerciante venezolano.
                            </p>

                            {/* Feature pills */}
                            <div className="flex flex-wrap justify-center gap-2 mb-2">
                                {['Tasas al instante', 'Calculadora', 'Cuentas', 'Catálogo'].map(label => (
                                    <span key={label} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-full">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* ─── FEATURE SLIDES ─── */
                        <div className="p-8">
                            {/* Icon */}
                            <div className={`w-16 h-16 rounded-2xl ${current.bg} flex items-center justify-center mx-auto mb-5`}>
                                <current.icon size={32} className={current.color} strokeWidth={2} />
                            </div>

                            {/* Step label */}
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center mb-1">
                                {current.title}
                            </p>

                            {/* Headline */}
                            <h2 className="text-xl font-black text-slate-900 dark:text-white text-center mb-3 leading-tight">
                                {current.headline}
                            </h2>

                            {/* Description */}
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed mb-4">
                                {isLast
                                    ? (isPremium ? current.descriptionPremium : current.descriptionFree)
                                    : current.description}
                            </p>

                            {/* Tip */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium text-center">
                                    {isLast
                                        ? (isPremium ? current.tipPremium : current.tipFree)
                                        : current.tip}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 px-2">
                    {/* Left: Back button or spacer */}
                    {!isFirst ? (
                        <button
                            onClick={goBack}
                            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors px-3 py-3 rounded-full text-sm font-bold"
                        >
                            <ChevronLeft size={16} strokeWidth={3} />
                            <span>Atrás</span>
                        </button>
                    ) : (
                        <div className="w-20" />
                    )}

                    {/* Dots */}
                    <div className="flex gap-2">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full transition-all duration-300 ${i === step
                                    ? 'w-6 bg-brand'
                                    : i < step
                                        ? 'w-2 bg-brand/40'
                                        : 'w-2 bg-slate-600'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Button */}
                    <button
                        onClick={goNext}
                        className="flex items-center gap-2 bg-brand text-slate-900 px-5 py-3 rounded-full font-bold text-sm shadow-lg shadow-brand/20 active:scale-95 transition-transform"
                    >
                        <span>{isLast ? '¡Empezar!' : isWelcome ? 'Inicio' : 'Siguiente'}</span>
                        {!isLast && <ChevronRight size={16} strokeWidth={3} />}
                    </button>
                </div>
            </div>

            {/* Slide animations */}
            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(30px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes slideInLeft {
                    from { opacity: 0; transform: translateX(-30px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
