// src/modals/Modals.tsx
import React from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
    Gauge,
    X,
    Loader2,
    CheckCircle2,
} from "lucide-react";

import type {
    EvalTarget,
    EvalResult,
    RfqEvalResult,
    RFQItem,
} from "../lib";

// ---------------------------
// EvaluatorModal
// ---------------------------
export function EvaluatorModal({
    target,
    setTarget,
    onClose,
    onRun,
    loading,
    result,
    error,
    onApplyRewrite,
    onCopyReport,
    onSaveVersion,
    canApplyRewrite,
}: {
    target: EvalTarget;
    setTarget: (t: EvalTarget) => void;
    onClose: () => void;
    onRun: () => void;
    loading: boolean;
    result: EvalResult | null;
    error: string | null;
    onApplyRewrite: () => void;
    onCopyReport: () => void;
    onSaveVersion: () => void;
    canApplyRewrite: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative w-full md:max-w-3xl max-h-[85vh] overflow-hidden rounded-t-3xl md:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                            <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-semibold">Evaluator</div>
                            <div className="text-xs text-slate-500">
                                Score, findings, and suggested rewrite
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="text-sm text-slate-500">Target:</div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTarget("section")}
                                className={`px-3 py-1 text-sm rounded-lg border ${target === "section"
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                            >
                                Active Section
                            </button>
                            <button
                                onClick={() => setTarget("proposal")}
                                className={`px-3 py-1 text-sm rounded-lg border ${target === "proposal"
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                            >
                                Whole Proposal
                            </button>
                        </div>
                        <button
                            onClick={onRun}
                            disabled={loading}
                            className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            Run Evaluation
                        </button>
                    </div>

                    {error && <div className="text-sm text-red-600">{error}</div>}

                    {result && (
                        <>
                            <div className="rounded-xl border p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-semibold">Overall Score</div>
                                    <div className="text-2xl font-bold">
                                        {Math.round(result.overall)}
                                        <span className="text-sm font-medium">/100</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {result.criteria.map((c, i) => (
                                        <div key={i} className="rounded-lg border p-3">
                                            <div className="text-sm font-medium">{c.name}</div>
                                            <div className="text-lg font-semibold">{Math.round(c.score)}/100</div>
                                            {!!c.notes?.length && (
                                                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                                                    {c.notes.slice(0, 4).map((n, j) => (
                                                        <li key={j}>{n}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-xl border p-4 md:col-span-1">
                                    <div className="text-sm font-semibold mb-2">Metrics</div>
                                    <ul className="text-sm space-y-1">
                                        <li>
                                            <b>Words:</b> {result.metrics.words}
                                        </li>
                                        <li>
                                            <b>Sentences:</b> {result.metrics.sentences}
                                        </li>
                                        <li>
                                            <b>Avg sentence length:</b>{" "}
                                            {Math.round(result.metrics.avgSentenceLength * 10) / 10}
                                        </li>
                                        <li>
                                            <b>Headings:</b> {result.metrics.headings}
                                        </li>
                                        <li>
                                            <b>Bullets:</b> {result.metrics.bullets}
                                        </li>
                                        <li>
                                            <b>Est. read time:</b> {result.metrics.estReadMin} min
                                        </li>
                                        {result.metrics.readingGrade != null && (
                                            <li>
                                                <b>Reading grade:</b> {result.metrics.readingGrade}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                                <div className="rounded-xl border p-4 md:col-span-2">
                                    <div className="text-sm font-semibold mb-2">Suggestions</div>
                                    {result.suggestions.length ? (
                                        <ul className="text-sm list-disc pl-5 space-y-1">
                                            {result.suggestions.map((s, i) => (
                                                <li key={i}>{s}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-sm text-slate-500">No suggestions.</div>
                                    )}
                                </div>
                            </div>

                            {result.rewritten && (
                                <div className="rounded-xl border p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold">
                                            Suggested Rewrite (applies to Active Section)
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={onApplyRewrite}
                                                disabled={!canApplyRewrite}
                                                className="px-3 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                                            >
                                                Apply Rewrite
                                            </button>
                                            <button
                                                onClick={onSaveVersion}
                                                className="px-3 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                Save as Version
                                            </button>
                                            <button
                                                onClick={onCopyReport}
                                                className="px-3 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                Copy Report
                                            </button>
                                        </div>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>{result.rewritten}</ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// ---------------------------
// RfqEvaluatorModal
// ---------------------------
export function RfqEvaluatorModal({
    rfq,
    valueUSD,
    setValueUSD,
    result,
    loading,
    onRun,
    onClose,
}: {
    rfq: RFQItem | null;
    valueUSD: number;
    setValueUSD: (n: number) => void;
    result: RfqEvalResult | null;
    loading: boolean;
    onRun: () => void;
    onClose: () => void;
}) {
    const displayValue = Math.max(0, valueUSD);
    const ratio = Math.min(displayValue, 1_000_000_000) / 1_000_000_000; // 0..1

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative w-full md:max-w-3xl max-h-[85vh] overflow-hidden rounded-t-3xl md:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <div className="font-semibold">RFQ Evaluator</div>
                        <div className="text-xs text-slate-500">{rfq?.name}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    {/* Value controls */}
                    <div className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">Estimated Contract Value</div>
                            <button
                                onClick={onRun}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                                title="Attempt backend evaluation or refresh local"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Gauge className="w-4 h-4" />
                                )}
                                Evaluate
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                step={10000}
                                value={displayValue}
                                onChange={(e) => setValueUSD(Number(e.target.value || 0))}
                                className="w-56 bg-transparent border rounded-lg px-3 py-2 text-sm"
                                placeholder="USD"
                            />
                            <span className="text-xs text-slate-500">USD</span>
                        </div>

                        {/* Bar 0 → 1B+ with 1/3 green/yellow/red */}
                        <div className="space-y-1">
                            <div className="h-4 w-full rounded-full overflow-hidden relative border border-slate-200 dark:border-slate-800">
                                <div className="absolute inset-0 grid grid-cols-3">
                                    <div className="bg-emerald-500/70" />
                                    <div className="bg-amber-500/70" />
                                    <div className="bg-red-500/70" />
                                </div>
                                {/* Marker */}
                                <div
                                    className="absolute -top-1 h-6 w-[2px] bg-slate-900 dark:bg-white"
                                    style={{ left: `calc(${(ratio * 100).toFixed(2)}% - 1px)` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>$0</span>
                                <span>$1B+</span>
                            </div>
                        </div>
                    </div>

                    {/* Key Terms of Reference */}
                    <div className="rounded-xl border p-4">
                        <div className="text-sm font-semibold mb-2">Key Terms of Reference</div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Summary</div>
                                {result?.summary?.length ? (
                                    <ul className="list-disc pl-5 text-sm space-y-1">
                                        {result.summary.map((s, i) => (
                                            <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-xs text-slate-500">No summary yet.</div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Standards Required</div>
                                {result?.standards?.length ? (
                                    <ul className="list-disc pl-5 text-sm space-y-1">
                                        {result.standards.map((s, i) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-xs text-slate-500">No standards detected.</div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Scope</div>
                                {result?.scope?.length ? (
                                    <ul className="list-disc pl-5 text-sm space-y-1">
                                        {result.scope.map((s, i) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-xs text-slate-500">No scope hints yet.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Band badge */}
                    {result && (
                        <div className="rounded-xl border p-4">
                            <div className="text-sm font-semibold mb-2">Band (by value)</div>
                            <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs
                ${result.band === "green"
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                        : result.band === "yellow"
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                                    }`}
                            >
                                {result.band.toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
