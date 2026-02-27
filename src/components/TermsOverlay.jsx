import React, { useState, useRef, useEffect } from 'react';
import { Check, FileText, ChevronDown } from 'lucide-react';

export default function TermsOverlay() {
    const [hasAccepted, setHasAccepted] = useState(
        () => localStorage.getItem('terms_accepted') === 'true'
    );
    const [canAccept, setCanAccept] = useState(false);
    const scrollRef = useRef(null);

    // Check if user has scrolled to bottom
    const handleScroll = () => {
        const element = scrollRef.current;
        if (!element) return;

        const scrolledToBottom =
            Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;

        if (scrolledToBottom && !canAccept) {
            setCanAccept(true);
        }
    };

    const handleAccept = () => {
        localStorage.setItem('terms_accepted', 'true');
        setHasAccepted(true);
    };

    // If already accepted, don't render anything
    if (hasAccepted) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 rounded-xl">
                        <FileText size={24} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Términos y Condiciones</h2>
                        <p className="text-xs text-slate-500 font-medium">Por favor, lee y acepta para continuar</p>
                    </div>
                </div>

                {/* Scroll Indicator */}
                {!canAccept && (
                    <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 animate-pulse">
                        <ChevronDown size={16} className="text-amber-600" />
                        <p className="text-xs font-bold text-amber-700">
                            Desplázate hasta el final para poder aceptar
                        </p>
                    </div>
                )}

                {/* Terms Content */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-6 py-6 prose prose-sm max-w-none"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    <h1 className="text-2xl font-black text-slate-900 mb-4">Términos y Condiciones de Uso - TasasAlDía</h1>
                    <p className="text-xs text-slate-500 font-bold mb-6">Última actualización: Febrero 2026</p>

                    <hr className="my-6" />

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">1. Aceptación de los Términos</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        Al acceder y utilizar la aplicación <strong>TasasAlDía</strong> (en adelante, "la Aplicación"), usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar la Aplicación.
                    </p>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">2. Descripción del Servicio</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">TasasAlDía es una aplicación web progresiva (PWA) que proporciona:</p>
                    <ul className="text-sm text-slate-700 space-y-1 mb-4">
                        <li><strong>Monitoreo de tasas de cambio</strong> en Venezuela (USDT, Dólar BCV, Euro BCV)</li>
                        <li><strong>Calculadora financiera</strong> para conversiones entre monedas</li>
                        <li><strong>Gestión de cuentas de pago</strong> (Pago Móvil, Transferencia, Binance)</li>
                        <li><strong>Envío de cotizaciones</strong> por WhatsApp con datos de pago incluidos (función Premium)</li>
                        <li><strong>Catálogo de productos</strong> con precios multi-moneda y compartir con código (función Premium)</li>
                    </ul>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">3. Descargo de Responsabilidad</h2>

                    <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">3.1 Información No Vinculante</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        <strong className="text-red-600">TODA LA INFORMACIÓN PROPORCIONADA EN LA APLICACIÓN ES ESTRICTAMENTE INFORMATIVA Y DE REFERENCIA.</strong> TasasAlDía no garantiza la exactitud, integridad, vigencia o fiabilidad de las tasas de cambio, datos financieros o cualquier otra información mostrada.
                    </p>

                    <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">3.2 No Constituye Asesoría Financiera</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        La información provista <strong>NO constituye asesoría financiera, legal, tributaria o de inversión</strong>. No debe ser utilizada como única base para tomar decisiones financieras o comerciales. Le recomendamos consultar con profesionales especializados antes de realizar cualquier transacción financiera.
                    </p>

                    <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">3.3 Limitación de Responsabilidad</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2"><strong>TasasAlDía y sus desarrolladores NO se hacen responsables por:</strong></p>
                    <ul className="text-sm text-slate-700 space-y-1 mb-4">
                        <li>Pérdidas económicas directas o indirectas derivadas del uso de la información</li>
                        <li>Errores, retrasos o interrupciones en la actualización de datos</li>
                        <li>Decisiones comerciales o financieras tomadas con base en la información de la Aplicación</li>
                        <li>Daños resultantes de la imposibilidad de acceder a la Aplicación</li>
                        <li>Cambios regulatorios o económicos en la República Bolivariana de Venezuela que afecten las tasas de cambio</li>
                    </ul>

                    <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">3.4 Uso Bajo Propio Riesgo</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        Al usar TasasAlDía, usted acepta que lo hace <strong>bajo su propio riesgo y responsabilidad</strong>. Usted es el único responsable de verificar la información con fuentes oficiales antes de ejecutar cualquier operación financiera.
                    </p>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">4. Funcionalidades Premium</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">TasasAlDía ofrece funciones gratuitas y funciones exclusivas para usuarios con <strong>Licencia Premium (TasasAlDía Business)</strong>:</p>
                    <ul className="text-sm text-slate-700 space-y-1 mb-2">
                        <li><strong>Gratuito:</strong> Monitoreo de tasas, calculadora de conversiones, hasta 2 cuentas de pago, modo kiosco con captura de imagen.</li>
                        <li><strong>Premium:</strong> Envío de cotizaciones por WhatsApp, cuentas de pago ilimitadas, catálogo de productos con precios, compartir catálogo mediante código temporal.</li>
                    </ul>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        El acceso Premium se otorga mediante código de activación único vinculado al dispositivo del usuario. La licencia es personal, intransferible y no reembolsable. Se ofrece un periodo de demostración de 24 horas por dispositivo.
                    </p>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">5. Privacidad y Datos Personales</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        TasasAlDía opera con principios de <strong>privacidad por diseño</strong>. La Aplicación NO recopila datos personales sensibles. Los datos se almacenan localmente en su dispositivo y <strong>NO se venden ni comparten con terceros</strong>.
                    </p>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">6. Legislación Aplicable</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        Estos Términos y Condiciones se rigen por las leyes de la <strong>República Bolivariana de Venezuela</strong>. Cualquier controversia será sometida a los tribunales competentes de la jurisdicción venezolana.
                    </p>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">7. Modificaciones</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                        TasasAlDía se reserva el derecho de modificar estos términos en cualquier momento. El uso continuo de la Aplicación después de dichas modificaciones constituye su aceptación.
                    </p>

                    <h2 className="text-lg font-bold text-slate-900 mt-6 mb-3">8. Código de Conducta</h2>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">Al utilizar TasasAlDía, usted se compromete a:</p>
                    <ul className="text-sm text-slate-700 space-y-1 mb-4">
                        <li><strong>NO</strong> utilizar la Aplicación para actividades ilícitas</li>
                        <li><strong>NO</strong> intentar vulnerar la seguridad del sistema</li>
                        <li><strong>NO</strong> realizar ingeniería inversa del código</li>
                        <li><strong>NO</strong> distribuir licencias Premium de forma no autorizada</li>
                    </ul>

                    <hr className="my-6" />

                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl mb-6">
                        <h3 className="text-base font-black text-slate-900 mb-2">Aceptación Final</h3>
                        <p className="text-sm text-slate-700 leading-relaxed">
                            <strong>AL USAR TASASALDÍA, USTED DECLARA HABER LEÍDO, ENTENDIDO Y ACEPTADO ESTOS TÉRMINOS Y CONDICIONES EN SU TOTALIDAD.</strong>
                        </p>
                    </div>

                    <p className="text-center text-sm font-bold text-slate-900 mt-8 mb-4">
                        TasasAlDía - Monitor Financiero de Venezuela 🇻🇪
                    </p>
                    <p className="text-center text-xs text-slate-500 mb-8">
                        Información en tiempo real para decisiones inteligentes
                    </p>

                    {/* Bottom Marker for Scroll Detection */}
                    <div id="terms-end" className="h-1"></div>
                </div>

                {/* Footer with Accept Button */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={handleAccept}
                        disabled={!canAccept}
                        className={`w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${canAccept
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Check size={20} strokeWidth={2.5} />
                        <span>{canAccept ? 'Acepto los Términos y Condiciones' : 'Lee hasta el final para aceptar'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
