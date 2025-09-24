import React from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
    Search,
    Send,
    Loader2,
    Bot,
    User,
    ChevronDown,
    Paperclip,
} from "lucide-react";
import { Card, CardHeader } from "../components/Atoms";
import type { RFQItem, Message } from "../lib";

export function RfqOrchestrator(props: {
    rfqs: RFQItem[];
    rfqSelected: string;
    setRfqSelected: (name: string) => void;

    messages: Message[];
    loading: boolean;

    question: string;
    setQuestion: (q: string) => void;
    ask: () => void;
}) {
    const {
        rfqs,
        rfqSelected,
        setRfqSelected,
        messages,
        loading,
        question,
        setQuestion,
        ask,
    } = props;

    return (
        <section className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-slate-500 flex-shrink-0">Active Context:</span>
                <div className="relative w-64 flex-shrink-0">
                    <select
                        value={rfqSelected}
                        onChange={(e) => setRfqSelected(e.target.value)}
                        className="appearance-none bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1 text-sm pr-8 w-full truncate"
                        title={rfqSelected} // Show full name on hover
                    >
                        {rfqs.map((r, i) => (
                            <option key={i} value={r.name} title={r.name}>{r.name}</option>
                        ))}
                        <option value="📂 Database">📂 Database</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-2 text-slate-500 pointer-events-none" />
                </div>
            </div>

            <Card className="flex flex-col flex-1">
                <CardHeader
                    title="RFQ Orchestrator"
                    subtitle={`Ask about: ${rfqSelected}`}
                    icon={<Search className="w-4 h-4" />}
                />

                <div className="flex-1 overflow-y-auto space-y-4 p-4">
                    {messages.map((m, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <MessageBubble m={m} />
                        </motion.div>
                    ))}

                    {loading && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="rounded-2xl px-4 py-3 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"></span>
                                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce delay-150"></span>
                                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce delay-300"></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t p-4 flex gap-2">
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g., List mandatory compliance items and due dates"
                        className="flex-1 bg-transparent outline-none resize-none h-20 text-sm"
                    />
                    <button
                        onClick={ask}
                        disabled={loading || !question.trim()}
                        className="shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Ask
                    </button>
                </div>
            </Card>
        </section>
    );
}

export function MessageBubble({ m }: { m: Message }) {
    const isUser = m.role === "user";
    return (
        <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
            {!isUser && (
                <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    <Bot className="w-4 h-4" />
                </div>
            )}
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 border ${isUser
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
                    }`}
            >
                {isUser ? (
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                )}

                {!!m.citations?.length && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {m.citations.map((c) => (
                            <button
                                key={c.id}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                            >
                                <Paperclip className="w-3 h-3" /> {c.source}
                                {c.page ? ` p.${c.page}` : ""}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {isUser && (
                <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800">
                    <User className="w-4 h-4" />
                </div>
            )}
        </div>
    );
}
