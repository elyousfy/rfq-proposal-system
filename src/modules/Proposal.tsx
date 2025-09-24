// src/modules/Proposal.tsx
import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
    FileText,
    Save,
    Download,
    Sparkles,
    Settings2,
    Gauge,
    Plus,
    Trash2,
    ChevronDown,
    Type,
    Code,
} from "lucide-react";

import { SimpleRichTextEditor } from "../components/SimpleRichTextEditor";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TOCTemplateSelector } from "../components/TOCTemplateSelector";
import type {
    RFQItem,
    Proposal,
    ProposalSection,
    ProposalVariable,
    ProposalVersionMeta,
} from "../lib";

export function ProposalPage(props: {
    rfqs: RFQItem[];
    rfqSelected: string;
    setRfqSelected: (name: string) => void;

    proposal: Proposal;

    selectedSectionId: string | null;
    setSelectedSectionId: (id: string | null) => void;

    addSection: () => void;
    deleteSection: (id: string) => void;
    updateSectionContent: (id: string, md: string) => void;
    updateSectionContentHtml: (id: string, html: string) => void;
    updateSectionTitle: (id: string, title: string) => void;

    saveVersion: (label?: string) => void;
    exportPdf: () => void;
    exportDocx: () => void;

    aiDraftFromRFQ: () => void;
    aiRewrite: (tone: "concise" | "formal" | "marketing") => void;
    aiFillCompliance: () => void;

    setShowEvaluator: (v: boolean) => void;

    onVarChange: (key: string, value: string) => void;
    applyTOCTemplate?: (templateId: string) => void;
    selectedTocTemplateId?: string | null;
    currentGeneratingSection?: string;
    isGenerating?: boolean;
}) {
    const {
        rfqs,
        rfqSelected,
        setRfqSelected,
        proposal,
        selectedSectionId,
        setSelectedSectionId,
        addSection,
        addSubsection,
        deleteSection,
        updateSectionContent,
        updateSectionContentHtml,
        updateSectionTitle,
        saveVersion,
        exportPdf,
        exportDocx,
        aiDraftFromRFQ,
        aiRewrite,
        aiFillCompliance,
        setShowEvaluator,
        onVarChange,
        applyTOCTemplate,
        selectedTocTemplateId,
        currentGeneratingSection,
        isGenerating,
    } = props;

    const selectedSection = useMemo(() => {
        // Find section in main sections
        let found = proposal.sections.find((s) => s.id === selectedSectionId);
        if (found) return found;

        // Find in subsections
        for (const section of proposal.sections) {
            if (section.subsections) {
                found = section.subsections.find((sub) => sub.id === selectedSectionId);
                if (found) return found;
            }
        }
        return null;
    }, [proposal, selectedSectionId]);

    const [editorMode, setEditorMode] = useState<"rich" | "markdown">("rich");

    return (
        <section className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="relative w-64 flex-shrink-0">
                    <select
                        value={rfqSelected}
                        onChange={(e) => setRfqSelected(e.target.value)}
                        className="appearance-none bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm pr-8 w-full truncate"
                        title={rfqSelected} // Show full name on hover
                    >
                        {rfqs.map((r, i) => (
                            <option key={i} value={r.name} title={r.name}>{r.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-slate-500 pointer-events-none" />
                </div>

                <input
                    value={proposal.title}
                    onChange={(e) =>
                    // parent should update proposal.title; we keep a minimal surface here
                    // You can pass a setter if you prefer; keeping the same API as your original:
                    // setProposal(p => ({ ...p, title: e.target.value, updatedAt: new Date().toISOString() }))
                    // For this lean split, we simply emit a custom event the parent handles if needed.
                    (document.dispatchEvent(
                        new CustomEvent("proposal:title:change", { detail: e.target.value })
                    ))
                    }
                    placeholder="Proposal title"
                    className="flex-1 bg-transparent border rounded-xl px-3 py-2 text-sm"
                />

                <button
                    onClick={() => saveVersion()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <Save className="w-4 h-4" /> Save Version
                </button>
                <button
                    onClick={exportPdf}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <Download className="w-4 h-4" /> PDF
                </button>
                <button
                    onClick={exportDocx}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <Download className="w-4 h-4" /> DOCX
                </button>
            </div>

            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
                {/* Sections list */}
                <div className="col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-slate-500">SECTIONS</div>
                        <button
                            onClick={addSection}
                            className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                    <div className="space-y-1 overflow-y-auto">
                        {proposal.sections.map((s) => (
                            <SectionItem
                                key={s.id}
                                section={s}
                                selectedSectionId={selectedSectionId}
                                setSelectedSectionId={setSelectedSectionId}
                                updateSectionTitle={updateSectionTitle}
                                deleteSection={deleteSection}
                                addSubsection={addSubsection}
                                level={0}
                            />
                        ))}
                        {proposal.sections.length === 0 && (
                            <div className="text-xs text-slate-500">
                                No sections yet. Click <b>Add</b> or use AI Draft.
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="text-xs font-medium text-slate-500">
                                {editorMode === "rich" ? "Rich Text" : "Markdown"}
                            </div>
                            <div className="flex rounded-lg border overflow-hidden">
                                <button
                                    onClick={() => setEditorMode("rich")}
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${
                                        editorMode === "rich" 
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <Type className="w-3 h-3" /> Rich
                                </button>
                                <button
                                    onClick={() => setEditorMode("markdown")}
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${
                                        editorMode === "markdown" 
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <Code className="w-3 h-3" /> MD
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={aiDraftFromRFQ}
                                disabled={isGenerating}
                                className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-lg border ${
                                    isGenerating
                                        ? "opacity-50 cursor-not-allowed"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                <Sparkles className="w-4 h-4" />
                                {isGenerating ? "Generating..." : "Draft from RFQ"}
                            </button>
                            <ToneMenu onPick={(t) => aiRewrite(t)} />
                            <button
                                onClick={() => setShowEvaluator(true)}
                                className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Evaluate clarity, structure, compliance hints, and get a suggested rewrite"
                            >
                                <Gauge className="w-4 h-4" /> Evaluate
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {editorMode === "rich" ? (
                            <div className="h-full p-3">
                                <ErrorBoundary
                                    fallback={
                                        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                                            <h3 className="text-red-800 font-medium mb-2">Rich Editor Error</h3>
                                            <p className="text-red-600 text-sm mb-3">
                                                The rich text editor failed to load. Please switch to markdown mode.
                                            </p>
                                            <button
                                                onClick={() => setEditorMode("markdown")}
                                                className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                                            >
                                                Switch to Markdown
                                            </button>
                                        </div>
                                    }
                                >
                                    <SimpleRichTextEditor
                                        value={selectedSection?.contentHtml || ""}
                                        onChange={(html) =>
                                            selectedSection &&
                                            updateSectionContentHtml(selectedSection.id, html)
                                        }
                                        placeholder="Start writing your proposal section..."
                                        className="h-full"
                                    />
                                </ErrorBoundary>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-0 flex-1 min-h-0 h-full">
                                <textarea
                                    value={selectedSection?.contentMd || ""}
                                    onChange={(e) =>
                                        selectedSection &&
                                        updateSectionContent(selectedSection.id, e.target.value)
                                    }
                                    placeholder="Write markdown..."
                                    className="border-r border-slate-200 dark:border-slate-800 p-3 text-sm bg-transparent outline-none resize-none min-h-[220px]"
                                />
                                <div className="p-3 prose prose-sm dark:prose-invert overflow-auto">
                                    <ReactMarkdown>
                                        {selectedSection?.contentMd || "*(Preview)*"}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right rail */}
                <div className="col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-3 flex flex-col min-h-0">
                    <RightRail
                        variables={proposal.variables}
                        versions={proposal.versions}
                        onVarChange={onVarChange}
                        onSaveVersion={(label) => saveVersion(label)}
                        aiFillCompliance={aiFillCompliance}
                        applyTOCTemplate={applyTOCTemplate}
                    />
                </div>
            </div>

            {/* Generation Progress Indicator */}
            {isGenerating && currentGeneratingSection && (
                <div className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 z-50">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span className="text-sm">{currentGeneratingSection}</span>
                </div>
            )}
        </section>
    );
}

function RightRail({
    variables,
    versions,
    onVarChange,
    onSaveVersion,
    aiFillCompliance,
    applyTOCTemplate,
}: {
    variables: ProposalVariable[];
    versions: ProposalVersionMeta[];
    onVarChange: (key: string, value: string) => void;
    onSaveVersion: (label?: string) => void;
    aiFillCompliance: () => void;
    applyTOCTemplate?: (templateId: string) => void;
}) {
    const [tab, setTab] = useState<"ai" | "variables" | "versions">("ai");
    const [label, setLabel] = useState("");

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-2 mb-3">
                <button
                    onClick={() => setTab("ai")}
                    className={`text-sm px-3 py-1 rounded-lg border ${tab === "ai"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                >
                    AI
                </button>
                <button
                    onClick={() => setTab("variables")}
                    className={`text-sm px-3 py-1 rounded-lg border ${tab === "variables"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                >
                    Variables
                </button>
                <button
                    onClick={() => setTab("versions")}
                    className={`text-sm px-3 py-1 rounded-lg border ${tab === "versions"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                >
                    Versions
                </button>
            </div>

            {tab === "ai" && (
                <div className="text-sm space-y-3">
                    <p className="text-slate-500">
                        AI-powered proposal generation and enhancement tools.
                    </p>
                    
                    <div className="space-y-2">
                        <button
                            onClick={aiFillCompliance}
                            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
                        >
                            <Sparkles className="w-4 h-4" /> Fill Compliance Matrix
                        </button>

                        <TOCTemplateSelector onApplyTemplate={applyTOCTemplate} />

                        <div className="text-xs text-slate-500">
                            Generate a comprehensive compliance matrix based on RFQ requirements
                        </div>
                    </div>

                    <div className="rounded-lg border p-3">
                        <div className="text-xs font-medium text-slate-500 mb-2">AI FEATURES</div>
                        <ul className="list-disc pl-5 space-y-1 text-xs">
                            <li><strong>Draft from RFQ:</strong> Generates complete proposal structure with intelligent content based on RFQ analysis</li>
                            <li><strong>Smart Rewrite:</strong> Adapts tone and style while preserving technical accuracy</li>
                            <li><strong>Compliance Matrix:</strong> Automatically maps RFQ requirements to responses with evidence</li>
                            <li><strong>Section Templates:</strong> Industry-specific content for technical, services, and standard proposals</li>
                        </ul>
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3">
                        <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">💡 PRO TIP</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                            Select different RFQs to generate tailored proposals. The AI analyzes each RFQ's specific requirements and generates contextually relevant content.
                        </div>
                    </div>
                </div>
            )}

            {tab === "variables" && (
                <div className="text-sm space-y-2 overflow-y-auto">
                    {variables.length === 0 && (
                        <div className="text-slate-500">No variables yet.</div>
                    )}
                    {variables.map((v) => (
                        <div key={v.key} className="rounded-xl border p-2">
                            <div className="text-xs text-slate-500">
                                {v.label} ({v.key})
                            </div>
                            <input
                                value={v.value}
                                onChange={(e) => onVarChange(v.key, e.target.value)}
                                className="mt-1 w-full bg-transparent border rounded-lg px-2 py-1"
                            />
                        </div>
                    ))}
                </div>
            )}

            {tab === "versions" && (
                <div className="text-sm flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Version label (optional)"
                            className="flex-1 bg-transparent border rounded-lg px-2 py-1"
                        />
                        <button
                            onClick={() => {
                                onSaveVersion(label || undefined);
                                setLabel("");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <Save className="w-4 h-4" /> Save
                        </button>
                    </div>
                    <div className="rounded-xl border overflow-hidden">
                        <div className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800">
                            Saved Versions
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto">
                            {versions.length === 0 && (
                                <li className="px-3 py-3 text-slate-500">No versions yet.</li>
                            )}
                            {versions.map((v) => (
                                <li key={v.id} className="px-3 py-2 flex items-center gap-2">
                                    <FileText className="w-3 h-3" />
                                    <span className="font-medium">{v.label}</span>
                                    <span className="ml-auto text-xs text-slate-500">{v.at}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

function SectionItem({
    section,
    selectedSectionId,
    setSelectedSectionId,
    updateSectionTitle,
    deleteSection,
    addSubsection,
    level
}: {
    section: ProposalSection;
    selectedSectionId: string | null;
    setSelectedSectionId: (id: string | null) => void;
    updateSectionTitle: (id: string, title: string) => void;
    deleteSection: (id: string) => void;
    addSubsection: (parentId: string) => void;
    level: number;
}) {
    const isSelected = selectedSectionId === section.id;
    const hasSubsections = section.subsections && section.subsections.length > 0;
    const [isExpanded, setIsExpanded] = useState(true);
    const indent = level * 16; // 16px per level

    return (
        <div className="space-y-1">
            <div
                className={`group rounded-lg border px-3 py-2 text-sm cursor-pointer ${isSelected
                        ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
                    }`}
                style={{ marginLeft: `${indent}px` }}
                onClick={() => setSelectedSectionId(section.id)}
            >
                <div className="flex items-center gap-2">
                    {hasSubsections && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                    )}
                    <input
                        value={section.title}
                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                        className="flex-1 bg-transparent outline-none"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {level === 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addSubsection(section.id);
                                }}
                                className="text-slate-500 hover:text-blue-600"
                                title="Add subsection"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteSection(section.id);
                            }}
                            className="text-slate-500 hover:text-red-600"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Render subsections */}
            {hasSubsections && isExpanded && (
                <div className="space-y-1">
                    {section.subsections!.map((subsection) => (
                        <SectionItem
                            key={subsection.id}
                            section={subsection}
                            selectedSectionId={selectedSectionId}
                            setSelectedSectionId={setSelectedSectionId}
                            updateSectionTitle={updateSectionTitle}
                            deleteSection={deleteSection}
                            addSubsection={addSubsection}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ToneMenu({ onPick }: { onPick: (t: "concise" | "formal" | "marketing") => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
            >
                <Settings2 className="w-4 h-4" /> Tone
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-40 rounded-lg border bg-white dark:bg-slate-900 shadow">
                    {["concise", "formal", "marketing"].map((t) => (
                        <button
                            key={t}
                            onClick={() => {
                                onPick(t as any);
                                setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 capitalize"
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
