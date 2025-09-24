// src/pages/EvaluatorPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, ChevronDown, Save, History } from "lucide-react";
import type { RFQItem, RfqEvalResult } from "../lib";

function percentFromCostUSD(value: number) {
    const v = Math.max(1000, value || 0);
    return Math.max(0, Math.min(100, ((Math.log10(v) - 3) / 6) * 100)); // 10^3..10^9
}

export default function EvaluatorPage(props: {
    rfqs: RFQItem[];
    rfqSelected: string;
    setRfqSelected: (name: string) => void;
    valueUSD: number;
    setValueUSD: (n: number) => void;
    result: RfqEvalResult | null;
    loading: boolean;
    savedEvaluations: {[rfqName: string]: any};
    onEvaluate: () => void;
    onLoadSaved: (rfqName: string) => void;
    onSaveEvaluation: () => void;
}) {
    const { rfqs, rfqSelected, setRfqSelected, valueUSD, setValueUSD, result, loading, savedEvaluations, onEvaluate, onLoadSaved, onSaveEvaluation } =
        props;
    
    const [showSavedDropdown, setShowSavedDropdown] = useState(false);
    
    // Debug logging
    console.log("🎯 EvaluatorPage - rfqs:", rfqs);
    console.log("🎯 EvaluatorPage - rfqSelected:", rfqSelected);
    console.log("🎯 EvaluatorPage - rfq names:", rfqs.map(r => r.name));
    console.log("💾 EvaluatorPage - savedEvaluations:", savedEvaluations);
    
    const targetPercent = useMemo(() => percentFromCostUSD(valueUSD), [valueUSD]);
    
    // Get saved evaluations for display
    const savedEvaluationsList = useMemo(() => {
        return Object.entries(savedEvaluations).map(([rfqName, data]) => ({
            rfqName,
            timestamp: data.timestamp,
            valueUSD: data.valueUSD,
        })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [savedEvaluations]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Element;
            if (showSavedDropdown && !target.closest('[data-dropdown="saved-evaluations"]')) {
                setShowSavedDropdown(false);
            }
        }
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSavedDropdown]);

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="w-full px-6 py-4 border-b border-slate-700/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                        <Gauge className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="font-semibold">Evaluator</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Assess fit, value, and key points from the RFQ
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="relative w-64 flex-shrink-0">
                        <select
                            value={rfqSelected}
                            onChange={(e) => {
                                console.log("🔄 EvaluatorPage - RFQ selection changed:", e.target.value);
                                setRfqSelected(e.target.value);
                            }}
                            className="appearance-none bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm w-full truncate pr-8"
                            title={rfqSelected} // Show full name on hover
                        >
                            {rfqs.map((r, i) => (
                                <option key={i} value={r.name} title={r.name}>{r.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-slate-500 pointer-events-none" />
                    </div>
                    <input
                        type="number"
                        min={0}
                        step={10000}
                        value={Math.max(0, valueUSD || 0)}
                        onChange={(e) => setValueUSD(Number(e.target.value || 0))}
                        className="w-40 bg-transparent border rounded-lg px-3 py-2 text-sm"
                        placeholder="USD"
                    />
                    
                    {/* Saved Evaluations Dropdown */}
                    <div className="relative" data-dropdown="saved-evaluations">
                        <button
                            onClick={() => setShowSavedDropdown(!showSavedDropdown)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Saved Evaluations"
                        >
                            <History className="w-4 h-4" />
                            <span className="text-sm">Saved ({savedEvaluationsList.length})</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {showSavedDropdown && (
                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border rounded-xl shadow-lg z-50 min-w-80">
                                <div className="p-2 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Saved Evaluations
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {savedEvaluationsList.length === 0 ? (
                                        <div className="p-3 text-sm text-slate-500 text-center">
                                            No saved evaluations yet
                                        </div>
                                    ) : (
                                        savedEvaluationsList.map((saved) => (
                                            <button
                                                key={saved.rfqName}
                                                onClick={() => {
                                                    onLoadSaved(saved.rfqName);
                                                    setShowSavedDropdown(false);
                                                }}
                                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-b-0"
                                            >
                                                <div className="font-medium text-sm truncate">{saved.rfqName}</div>
                                                <div className="text-xs text-slate-500 flex justify-between">
                                                    <span>${saved.valueUSD?.toLocaleString() || 0}</span>
                                                    <span>{new Date(saved.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Save Current Evaluation */}
                    <button
                        onClick={onSaveEvaluation}
                        disabled={!result}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        title="Save Current Evaluation"
                    >
                        <Save className="w-4 h-4" />
                        <span className="text-sm">Save</span>
                    </button>
                    
                    <button
                        onClick={onEvaluate}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                        {loading ? "Evaluating…" : "Run evaluation"}
                    </button>
                </div>
            </div>

            {/* Body full width */}
            <div className="flex-1 w-full p-8 flex flex-col gap-12">
                {/* Centered Bar */}
                <div className="flex flex-col items-center w-full">
                    <div className="text-sm text-slate-400 mb-2">
                        {Math.round(targetPercent)}% (scaled by AI cost)
                    </div>
                    <div className="relative h-12 w-full rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900">
                        {/* background bands */}
                        <div className="absolute inset-0 grid grid-cols-3">
                            <div className="bg-emerald-700/30" />
                            <div className="bg-amber-700/30" />
                            <div className="bg-red-700/30" />
                        </div>
                        {/* highlight fill */}
                        <div
                            className={`h-full transition-all duration-1000 ease-out ${targetPercent <= 33
                                    ? "bg-emerald-400/80"
                                    : targetPercent <= 66
                                        ? "bg-amber-400/80"
                                        : "bg-red-400/80"
                                }`}
                            style={{ width: `${targetPercent}%` }}
                        />
                    </div>
                    <div className="mt-2 w-full flex justify-between text-xs text-slate-500">
                        <span>$0</span>
                        <span>$1B+</span>
                    </div>
                </div>

                {/* Key points + details */}
                <div className="w-full space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Key points of reference</h2>
                        
                        {/* Project Metadata */}
                        {rfqs.find(r => r.name === rfqSelected) && (
                            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border">
                                {(() => {
                                    const currentRfq = rfqs.find(r => r.name === rfqSelected);
                                    if (!currentRfq) return null;
                                    return (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Project Name</div>
                                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentRfq.name}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Client</div>
                                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentRfq.client || 'Not specified'}</div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Uploaded Documents</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {currentRfq.documents?.map((doc, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => window.open(`http://localhost:8000/view/${doc}`, '_blank')}
                                                            className="inline-flex items-center px-2 py-1 text-xs bg-white dark:bg-slate-700 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                                                        >
                                                            <svg className="w-3 h-3 mr-1 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                                            </svg>
                                                            {doc}
                                                        </button>
                                                    )) || <span className="text-sm text-slate-500">No documents</span>}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {result?.summary?.length ? (
                            <ul className="grid gap-2 text-lg leading-relaxed list-disc pl-6">
                                {result.summary.map((s, i) => (
                                    <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-slate-500">
                                Run the evaluation to populate key points.
                            </div>
                        )}
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Block label="Objectives" items={result?.objectives} />
                        <Block label="Deliverables" items={result?.deliverables} />
                        <Block label="Constraints" items={result?.constraints} />
                        <Block label="Risks" items={result?.risks} />
                        <Block label="Success Criteria" items={result?.successCriteria} />
                        <Block label="Stakeholders" items={result?.stakeholders} />
                        <Block label="Standards" items={result?.standards} />
                        <Block label="Scope" items={result?.scope} />
                    </section>
                </div>
            </div>
        </div>
    );
}

function parseItemWithSource(item: string) {
    // Extract source reference like [Source: filename.pdf, page X]
    const sourceMatch = item.match(/\[Source: ([^\]]+)\]$/);
    if (sourceMatch) {
        const text = item.replace(/\s*\[Source: [^\]]+\]$/, '');
        const source = sourceMatch[1];
        return { text, source };
    }
    return { text: item, source: null };
}

function ItemWithSource({ item }: { item: string }) {
    const { text, source } = parseItemWithSource(item);
    
    if (!source) {
        return <span>{text}</span>;
    }
    
    return (
        <span className="group relative">
            {text}
            <span className="ml-1.5 inline-flex items-center px-1 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded cursor-help hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-150">
                REF
            </span>
            {/* Enhanced Tooltip */}
            <div className="absolute bottom-full left-0 mb-3 hidden group-hover:block z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 whitespace-nowrap shadow-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                            <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/>
                        </svg>
                        <span className="font-medium">{source}</span>
                    </div>
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                </div>
            </div>
        </span>
    );
}

function Block({ label, items }: { label: string; items?: string[] | null }) {
    if (!items || items.length === 0) {
        return (
            <div className="rounded-xl border p-4 w-full">
                <div className="text-sm font-semibold mb-2">{label}</div>
                <div className="text-sm text-slate-500">No {label.toLowerCase()} yet.</div>
            </div>
        );
    }
    return (
        <div className="rounded-xl border p-4 w-full">
            <div className="text-sm font-semibold mb-2">{label}</div>
            <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
                {items.map((s, i) => (
                    <li key={i}>
                        <ItemWithSource item={s} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
