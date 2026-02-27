// ============================================================
// 🧪 SYSTEM TESTER VIEW v2.0 — Premium Dashboard
// With 7-Day Simulation + Groq AI Analysis
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SystemTester } from '../testing/SystemTester';
import {
    FlaskConical, Play, Square, Copy, CheckCircle2, XCircle,
    Zap, ChevronLeft, ChevronDown, ChevronUp, TerminalSquare, Trash2, Brain
} from 'lucide-react';

const SUITE_ICONS = {
    storage: '💾', productos: '📦', carrito: '🛒', bimoneda: '💱',
    checkout: '🧾', clientes: '👥', payments: '💳', modules: '🧩',
    '7days': '🗓️'
};

export const TesterView = ({ onBack }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(null);
    const [summary, setSummary] = useState(null);
    const [copied, setCopied] = useState(false);
    const [expandedAI, setExpandedAI] = useState(true);
    const logsEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const handleRunAll = useCallback(async () => {
        setIsRunning(true);
        setLogs([]);
        setSummary(null);
        setCopied(false);
        try {
            await SystemTester.runAll({
                onLog: (entry) => setLogs(prev => [...prev, entry]),
                onProgress: (p) => setProgress(p),
                onComplete: (s) => { setSummary(s); setProgress(null); }
            });
        } catch (err) {
            setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `💥 Error fatal: ${err.message}`, type: 'fail' }]);
        }
        setIsRunning(false);
    }, []);

    const handleRunSuite = useCallback(async (suiteKey) => {
        setIsRunning(true);
        setLogs([]);
        setSummary(null);
        setCopied(false);
        try {
            const result = await SystemTester.runSuite(suiteKey, {
                onLog: (entry) => setLogs(prev => [...prev, entry]),
            });
            setSummary(result);
        } catch (err) {
            setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `💥 ${err.message}`, type: 'fail' }]);
        }
        setIsRunning(false);
    }, []);

    const handleStop = useCallback(() => {
        SystemTester.stop();
        setIsRunning(false);
    }, []);

    const handleCopy = useCallback(() => {
        const text = logs.map(l => `[${l.time}] ${l.msg}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [logs]);

    const handleCopyAll = useCallback(() => {
        let text = '═══ SYSTEM TESTER v2.0 — Precios al Día ═══\n\n';
        text += '── LOG COMPLETO ──\n';
        text += logs.map(l => `[${l.time}] ${l.msg}`).join('\n');

        if (summary) {
            text += '\n\n── RESUMEN ──\n';
            text += `Total: ${summary.total} | Pass: ${summary.passed} | Fail: ${summary.failed} | Tiempo: ${summary.elapsed}s\n`;
            text += `Pass Rate: ${((summary.passed / Math.max(summary.total, 1)) * 100).toFixed(0)}%\n`;

            if (summary.results?.length) {
                text += '\n── DETALLE ──\n';
                summary.results.forEach(r => {
                    text += `${r.passed ? '✅' : '❌'} [${r.suite}] ${r.test}${!r.passed && r.detail ? ` — ${r.detail}` : ''}\n`;
                });
            }

            if (summary.aiAnalysis) {
                text += '\n── ANÁLISIS AI (GROQ) ──\n';
                text += summary.aiAnalysis;
            }
        }

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [logs, summary]);

    const handleClear = useCallback(() => {
        setLogs([]);
        setSummary(null);
        setProgress(null);
        setCopied(false);
    }, []);

    const suites = SystemTester.getSuites();

    const logColors = {
        pass: 'text-emerald-400',
        fail: 'text-rose-400',
        warn: 'text-amber-400',
        info: 'text-slate-400',
        section: 'text-indigo-400 font-bold',
        ai: 'text-cyan-400',
        day: 'text-violet-400 font-bold',
    };

    const passRate = summary ? ((summary.passed / Math.max(summary.total, 1)) * 100).toFixed(0) : null;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-3 sm:p-6 space-y-3 sm:space-y-4">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all active:scale-95">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                        <FlaskConical size={18} />
                    </div>
                    <div>
                        <h1 className="text-sm sm:text-lg font-black tracking-tight">System Tester <span className="text-indigo-400">v2.0</span></h1>
                        <p className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-widest font-bold">E2E • 7-Day Sim • Groq AI</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Copy All button */}
                    {logs.length > 0 && !isRunning && (
                        <button onClick={handleCopyAll}
                            className={`flex items-center gap-1 px-2 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>
                            {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                            <span className="hidden sm:inline">{copied ? '¡Copiado!' : 'Copiar Todo'}</span>
                        </button>
                    )}

                    {isRunning ? (
                        <button onClick={handleStop}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-rose-600/30 active:scale-95">
                            <Square size={14} /> <span className="hidden sm:inline">Detener</span>
                        </button>
                    ) : (
                        <button onClick={handleRunAll}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-600/30 animate-pulse hover:animate-none active:scale-95">
                            <Play size={14} /> Run All
                        </button>
                    )}
                </div>
            </div>

            {/* ── Suite Buttons ── */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {suites.map(s => (
                    <button
                        key={s.key}
                        onClick={() => handleRunSuite(s.key)}
                        disabled={isRunning}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] sm:text-xs font-bold transition-all border active:scale-95 ${s.key === '7days'
                            ? 'bg-violet-950/50 hover:bg-violet-900/50 border-violet-800/40 hover:border-violet-600/60 text-violet-300'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-500'
                            }`}
                    >
                        <span>{SUITE_ICONS[s.key]}</span>
                        <span className="hidden sm:inline">{s.name.replace(/^[^\s]+\s/, '')}</span>
                        <span className="sm:hidden">{s.key === '7days' ? '7d' : s.key.slice(0, 4)}</span>
                    </button>
                ))}
            </div>

            {/* ── Progress Bar ── */}
            {progress && (
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-400">
                            <Zap size={12} className="inline mr-1 text-amber-400" />
                            {progress.name}
                        </span>
                        <span className="text-xs font-mono text-slate-500">{progress.current}/{progress.total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* ── Stats Bar ── */}
            {summary && (
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    <div className="bg-slate-800/80 rounded-xl p-2 sm:p-3 text-center border border-slate-700">
                        <p className="text-lg sm:text-2xl font-black text-white">{summary.total}</p>
                        <p className="text-[7px] sm:text-[9px] text-slate-500 uppercase font-bold">Total</p>
                    </div>
                    <div className="bg-emerald-950/50 rounded-xl p-2 sm:p-3 text-center border border-emerald-800/30">
                        <p className="text-lg sm:text-2xl font-black text-emerald-400">{summary.passed}</p>
                        <p className="text-[7px] sm:text-[9px] text-emerald-500 uppercase font-bold">Pass</p>
                    </div>
                    <div className="bg-rose-950/50 rounded-xl p-2 sm:p-3 text-center border border-rose-800/30">
                        <p className="text-lg sm:text-2xl font-black text-rose-400">{summary.failed}</p>
                        <p className="text-[7px] sm:text-[9px] text-rose-500 uppercase font-bold">Fail</p>
                    </div>
                    <div className="bg-slate-800/80 rounded-xl p-2 sm:p-3 text-center border border-slate-700">
                        <p className="text-lg sm:text-2xl font-black text-slate-300">{summary.elapsed}s</p>
                        <p className="text-[7px] sm:text-[9px] text-slate-500 uppercase font-bold">Tiempo</p>
                    </div>
                </div>
            )}

            {/* ── Pass Rate Badge ── */}
            {summary && (
                <div className={`flex items-center justify-center gap-3 p-3 rounded-xl border ${summary.failed === 0
                    ? 'bg-emerald-950/30 border-emerald-700/30'
                    : summary.failed <= 3 ? 'bg-amber-950/30 border-amber-700/30'
                        : 'bg-rose-950/30 border-rose-700/30'
                    }`}>
                    <span className="text-3xl sm:text-4xl">{summary.failed === 0 ? '🟢' : summary.failed <= 3 ? '🟡' : '🔴'}</span>
                    <div>
                        <p className={`text-sm sm:text-lg font-black ${summary.failed === 0 ? 'text-emerald-400' : summary.failed <= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {summary.failed === 0 ? 'ALL TESTS PASSED' : `${summary.failed} TEST${summary.failed > 1 ? 'S' : ''} FAILED`}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold">
                            {passRate}% pass rate • {summary.elapsed}s • v2.0
                        </p>
                    </div>
                </div>
            )}

            {/* ── AI Analysis Panel ── */}
            {summary?.aiAnalysis && (
                <div className="bg-gradient-to-br from-cyan-950/40 to-indigo-950/40 rounded-xl border border-cyan-700/30 overflow-hidden">
                    <button
                        onClick={() => setExpandedAI(!expandedAI)}
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/5 transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <Brain size={16} className="text-cyan-400" />
                            <span className="text-xs sm:text-sm font-bold text-cyan-300">Análisis AI (Groq)</span>
                            <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-1.5 py-0.5 rounded-full font-mono">llama-3.3-70b</span>
                        </div>
                        {expandedAI ? <ChevronUp size={14} className="text-cyan-400" /> : <ChevronDown size={14} className="text-cyan-400" />}
                    </button>
                    {expandedAI && (
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 text-[11px] sm:text-sm text-cyan-100/80 whitespace-pre-wrap leading-relaxed">
                            {summary.aiAnalysis}
                        </div>
                    )}
                </div>
            )}

            {/* ── 7-Day Stats ── */}
            {summary?.dayStats && (
                <div className="bg-gradient-to-br from-violet-950/30 to-indigo-950/30 rounded-xl border border-violet-700/30 overflow-hidden">
                    <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 border-b border-violet-700/20">
                        <span className="text-base">🗓️</span>
                        <span className="text-xs sm:text-sm font-bold text-violet-300">Simulación 7 Días</span>
                    </div>
                    <div className="p-2 sm:p-3 space-y-1">
                        {summary.dayStats.dailyStats.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 bg-slate-900/40 rounded-lg text-[10px] sm:text-xs">
                                <span className="font-bold text-violet-400 w-12 sm:w-16 shrink-0">{d.day.slice(0, 3)}</span>
                                <span className="text-slate-500 w-10 sm:w-14 shrink-0">{d.rate} Bs</span>
                                <span className="text-slate-300 w-12 sm:w-16 shrink-0">{d.sales} ventas</span>
                                <span className="text-emerald-400 font-bold">${d.revenue.toFixed(2)}</span>
                                {d.fiado > 0 && <span className="text-amber-400/70 text-[9px] ml-auto">fiado ${d.fiado.toFixed(2)}</span>}
                            </div>
                        ))}
                        <div className="flex items-center gap-3 px-3 py-2 bg-violet-900/20 rounded-lg text-xs border border-violet-700/20 mt-1">
                            <span className="font-black text-violet-300">TOTAL</span>
                            <span className="text-white font-bold">{summary.dayStats.totalSales} ventas</span>
                            <span className="text-emerald-400 font-black">${summary.dayStats.totalRevenue.toFixed(2)}</span>
                            {summary.dayStats.totalFiado > 0 && <span className="text-amber-400 ml-auto">Fiado: ${summary.dayStats.totalFiado.toFixed(2)}</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Log Console ── */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <TerminalSquare size={14} className="text-slate-500" />
                        <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Log Console</span>
                        {logs.length > 0 && (
                            <span className="text-[8px] sm:text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">{logs.length}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handleClear} disabled={isRunning || logs.length === 0}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all disabled:opacity-30" title="Limpiar">
                            <Trash2 size={13} />
                        </button>
                        <button onClick={handleCopy} disabled={logs.length === 0}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30'}`}>
                            {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                            <span className="hidden sm:inline">{copied ? '¡Copiado!' : 'Log'}</span>
                        </button>
                    </div>
                </div>

                <div className="max-h-[35vh] sm:max-h-[45vh] overflow-y-auto p-2 sm:p-3 font-mono text-[9px] sm:text-xs space-y-0.5 select-text">
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 sm:py-16 gap-3 select-none">
                            <FlaskConical size={28} className="text-slate-700" />
                            <p className="text-slate-600 text-xs sm:text-sm font-bold">Presiona "Run All" para iniciar</p>
                            <p className="text-slate-700 text-[8px] sm:text-[10px]">{suites.length} suites • 7-Day Sim • Groq AI</p>
                        </div>
                    ) : (
                        logs.map((entry, i) => (
                            <div key={i} className={`flex gap-1.5 sm:gap-2 ${logColors[entry.type] || 'text-slate-400'}`}>
                                <span className="text-slate-600 shrink-0">[{entry.time}]</span>
                                <span className="break-all">{entry.msg}</span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* ── Results Detail ── */}
            {summary?.results && summary.results.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="px-3 sm:px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                        <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Detalle de Tests</span>
                    </div>
                    <div className="max-h-40 sm:max-h-60 overflow-y-auto p-1.5 sm:p-2 space-y-0.5 sm:space-y-1">
                        {summary.results.map((r, i) => (
                            <div key={i} className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-xs ${r.passed ? 'bg-emerald-950/30' : 'bg-rose-950/30'}`}>
                                {r.passed
                                    ? <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                                    : <XCircle size={10} className="text-rose-500 shrink-0" />
                                }
                                <span className={`font-bold shrink-0 ${r.passed ? 'text-emerald-400' : 'text-rose-400'}`}>[{r.suite}]</span>
                                <span className="text-slate-300 truncate">{r.test}</span>
                                {!r.passed && r.detail && (
                                    <span className="text-rose-500/70 text-[8px] ml-auto shrink-0 max-w-[25%] truncate">{r.detail}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Footer ── */}
            <p className="text-center text-[7px] sm:text-[9px] text-slate-700 font-mono uppercase pb-20">
                Precios al Día • System Tester v2.0 • {new Date().getFullYear()} • TEMPORAL
            </p>
        </div>
    );
};
