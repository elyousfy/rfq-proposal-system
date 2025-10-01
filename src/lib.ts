// src/lib.ts

// --------------------
// Types
// --------------------
export interface Citation { id: string; source: string; page?: number; snippet?: string }
export interface QAResponse { answer: string; citations: Citation[] }
export interface Message { role: "user" | "assistant" | "system"; content: string; citations?: Citation[] }

export interface RFQItem {
  name: string;
  client: string;
  dueDate: string;
  mainDocument?: string;
  supportingDocuments?: string[];
  documents: string[]; // keep this for backward compatibility
}

export interface DBFile { name: string; uploadedAt: string }
export interface DBFolder { name: string; files: DBFile[] }

// Proposal-related types
export type Tone = "concise" | "formal" | "marketing";
export interface ProposalVariable { key: string; label: string; value: string }
export interface ProposalSection {
  id: string;
  title: string;
  contentMd: string;
  contentHtml?: string;
  locked?: boolean;
  level?: number;
  order?: number;
  parent?: number | null;
  subsections?: ProposalSection[];
}
export interface ComplianceRow { req: string; response: string; evidence?: string; status: "Compliant" | "Partial" | "Exception" }
export interface ProposalVersionMeta { id: string; label: string; at: string }
export interface Proposal {
  id: string;
  title: string;
  rfqName?: string;
  sections: ProposalSection[];
  variables: ProposalVariable[];
  compliance?: ComplianceRow[];
  updatedAt: string;
  createdAt: string;
  versions: ProposalVersionMeta[];
}

export type Page = "proposal" | "rfqbot" | "documents" | "evaluator" | "completed-proposals";
export type DocMode = null | "rfqs" | "database";

// --- Proposal Evaluator types
export type EvalTarget = "section" | "proposal";
export interface EvalCriterion { name: string; score: number; notes: string[] }
export interface EvalResult {
  overall: number;
  criteria: EvalCriterion[];
  suggestions: string[];
  rewritten?: string;
  metrics: {
    words: number;
    sentences: number;
    avgSentenceLength: number;
    headings: number;
    bullets: number;
    estReadMin: number;
    readingGrade?: number;
  };
}

// --- RFQ Evaluator types
export interface RfqEvalResult {
  valueUSD: number;
  band: "green" | "yellow" | "red";
  summary: string[];
  standards: string[];
  scope: string[];
  objectives?: string[];
  deliverables?: string[];
  constraints?: string[];
  risks?: string[];
  successCriteria?: string[];
  stakeholders?: string[];
}

// --------------------
// Generic utils
// --------------------
export function uid() { return Math.random().toString(36).slice(2); }
export function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
export function round(n: number, d = 1) { const p = Math.pow(10, d); return Math.round(n * p) / p; }

export function upsertVariables(existing: ProposalVariable[], updates: ProposalVariable[]): ProposalVariable[] {
  const map = new Map(existing.map(v => [v.key, v] as const));
  for (const u of updates) map.set(u.key, { ...map.get(u.key), ...u } as ProposalVariable);
  return Array.from(map.values());
}
export function humanize(key: string) { return key.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase()); }
export function guessClientFromRFQName(name: string) {
  const match = name.match(/^([^–-]+)/);
  return match ? match[1].trim() : name;
}
export function fakeDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --------------------
// Proposal Evaluator helpers (local fallback)
// --------------------
export function inferMetrics(text: string) {
  const words = (text.match(/\b[\w’'-]+\b/g) || []).length;
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length);
  const avgSentenceLength = words / sentences;
  const headings = (text.match(/^\s{0,3}#{1,6}\s+/gm) || []).length;
  const bullets = (text.match(/^\s*[-*+]\s+/gm) || []).length;
  const estReadMin = Math.max(1, Math.round(words / 200));
  const syllables = Math.max(1, Math.round(words * 1.3)); // rough guess
  const readingGrade = Math.round(0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59);
  return { words, sentences, avgSentenceLength, headings, bullets, estReadMin, readingGrade };
}

export function scoreClarity(m: { avgSentenceLength: number; readingGrade?: number }) {
  let base = 100;
  if (m.avgSentenceLength > 20) base -= Math.min(40, (m.avgSentenceLength - 20) * 2);
  if (m.readingGrade != null && m.readingGrade > 12) base -= Math.min(30, (m.readingGrade - 12) * 3);
  return clamp(base, 0, 100);
}

export function scoreStructure(m: { headings: number; bullets: number; words: number }) {
  const neededHeadings = Math.max(1, Math.floor(m.words / 400));
  const neededBullets = Math.max(1, Math.floor(m.words / 250));
  let base = 60;
  base += Math.min(30, (m.headings / neededHeadings) * 20);
  base += Math.min(30, (m.bullets / neededBullets) * 20);
  return clamp(base, 0, 100);
}

export function scoreComplianceHints(text: string) {
  const keywords = ["iso 27001", "soc 2", "sla", "kpi", "risk", "scope", "timeline", "deliverable", "pricing", "acceptance", "assumption", "appendix", "evidence", "audit"];
  const found = keywords.filter(k => new RegExp(`\\b${k}\\b`, "i").test(text)).length;
  return clamp(50 + found * 4, 0, 100);
}

export function clarityNotes(m: any) {
  const notes: string[] = [];
  if (m.avgSentenceLength > 20) notes.push(`Average sentence length is ${Math.round(m.avgSentenceLength)} words; aim for 15–20.`);
  if (m.readingGrade != null && m.readingGrade > 12) notes.push(`Reading grade ≈ ${m.readingGrade}; simplify vocabulary for broader audiences.`);
  return notes;
}
export function structureNotes(m: any) {
  const notes: string[] = [];
  const neededHeadings = Math.max(1, Math.floor(m.words / 400));
  const neededBullets = Math.max(1, Math.floor(m.words / 250));
  if (m.headings < neededHeadings) notes.push(`Add at least ${neededHeadings - m.headings} more heading(s).`);
  if (m.bullets < neededBullets) notes.push(`Add ~${neededBullets - m.bullets} bullet block(s) for scannability.`);
  return notes;
}
export function complianceNotes(text: string) {
  const notes: string[] = [];
  if (!/\biso\s*27001\b/i.test(text)) notes.push("Reference ISO 27001 certification or controls if relevant.");
  if (!/\bsoc\s*2\b/i.test(text)) notes.push("Address SOC 2 reporting/controls if applicable.");
  if (!/\bsla(s)?\b/i.test(text)) notes.push("Define SLAs and KPIs for measurable outcomes.");
  if (!/\btimeline|schedule\b/i.test(text)) notes.push("Include a delivery timeline.");
  return notes;
}

export function suggestRewrite(text: string, m: any) {
  if (!text.trim()) return "";
  const sentences = text.split(/(?<=[.!?])\s+/);
  const tightened = sentences.map(s => {
    const words = s.split(/\s+/);
    if (words.length > 24) {
      const mid = Math.floor(words.length / 2);
      return words.slice(0, mid).join(" ") + ". " + words.slice(mid).join(" ");
    }
    return s;
  }).join(" ");

  let rewritten = tightened;

  if (m.words > 120 && (m.bullets === 0)) {
    const items = sentences
      .slice(0, 4)
      .map(s => s.replace(/^[\-\*\+]\s*/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (items.length >= 3) {
      const bulletBlock = "\n\n- " + items.slice(0, 5).join("\n- ");
      rewritten += bulletBlock;
    }
  }
  return rewritten;
}

export function localEvaluate(text: string, rfqName: string, variables: ProposalVariable[]): EvalResult {
  const metrics = inferMetrics(text);
  const clarity = scoreClarity(metrics);
  const structure = scoreStructure(metrics);
  const compliance = scoreComplianceHints(text);
  const suggestions = [
    ...(metrics.avgSentenceLength > 22 ? ["Shorten long sentences to ~15–20 words on average."] : []),
    ...(metrics.bullets < Math.max(1, Math.floor(metrics.words / 250)) ? ["Use more bullet lists to highlight key points."] : []),
    ...(metrics.headings < Math.max(1, Math.floor(metrics.words / 400)) ? ["Add descriptive headings to break up long sections."] : []),
    ...(!/\b(iso\s*27001|soc\s*2|sla|kpi|risk|scope|timeline|pricing|assumption|deliverable)s?\b/i.test(text) ? ["Mention compliance, scope, timelines, and SLAs explicitly if required by the RFQ."] : []),
  ];

  const rewritten = suggestRewrite(text, metrics);

  const criteria: EvalCriterion[] = [
    { name: "Clarity", score: clarity, notes: clarityNotes(metrics) },
    { name: "Structure", score: structure, notes: structureNotes(metrics) },
    { name: "Compliance Hints", score: compliance, notes: complianceNotes(text) },
  ];

  const overall = Math.round((clarity * 0.45 + structure * 0.35 + compliance * 0.20));

  return {
    overall,
    criteria,
    suggestions,
    rewritten,
    metrics
  };
}

// --------------------
// RFQ Evaluator helpers
// --------------------
export function bandFromValue(v: number): "green" | "yellow" | "red" {
  const cap = Math.min(v, 1_000_000_000);
  const ratio = cap / 1_000_000_000;
  if (ratio <= 1 / 3) return "green";
  if (ratio <= 2 / 3) return "yellow";
  return "red";
}

export function localRfqEvaluate(rfq: RFQItem): RfqEvalResult {
  const name = rfq.name.toLowerCase();
  const docs = rfq.documents.join(" | ").toLowerCase();

  let value = 0;
  if (/migration|datacenter|cloud/.test(name)) value = 5_000_000;
  if (/security|soc|iso/.test(name)) value = Math.max(value, 2_000_000);
  if (/network|upgrade/.test(name)) value = Math.max(value, 1_000_000);
  if (/enterprise|global|national/.test(name)) value = Math.max(value, 20_000_000);

  const stds: string[] = [];
  if (/\biso\s*27001\b|iso27001|iso 27001/.test(docs)) stds.push("ISO 27001");
  if (/\bsoc\s*2\b/.test(docs)) stds.push("SOC 2");
  if (/\bgdpr\b/.test(docs)) stds.push("GDPR");
  if (/\bhipaa\b/.test(docs)) stds.push("HIPAA");
  if (/\bpci(\s*dss)?\b/.test(docs)) stds.push("PCI DSS");

  const scope: string[] = [];
  if (/cloud|migration/.test(name + docs)) scope.push("Cloud migration & cutover");
  if (/security|iso|soc/.test(name + docs)) scope.push("Security controls & compliance alignment");
  if (/network|upgrade/.test(name + docs)) scope.push("Network modernization & rollout");
  if (scope.length === 0) scope.push("Solution design, implementation, testing, and handover");

  return {
    valueUSD: value,
    band: bandFromValue(value),
    summary: [
      `Client: ${rfq.client || "Unknown"}`,
      rfq.dueDate ? `Due Date: ${rfq.dueDate}` : "Due date: TBD",
      `Provided docs: ${rfq.documents.length ? rfq.documents.join(", ") : "None"}`,
    ],
    objectives: [
      "Modernize infrastructure and applications",
      "Improve security & compliance posture",
      "Reduce downtime by at least 20%",
    ],
    deliverables: [
      "Migration plan and runbooks",
      "Security compliance matrix",
      "Staff training and handover package",
    ],
    constraints: [
      "Completion within 6 months",
      "Must leverage client’s Azure subscription",
      "Budget cap: $5M USD",
    ],
    risks: [
      "Data quality inconsistencies",
      "Compressed delivery timeline",
      "Regulatory changes mid-project",
    ],
    successCriteria: [
      "ISO 27001 audit passed",
      "Cutover with <2 hours downtime",
      "Positive end-user adoption feedback",
    ],
    stakeholders: [
      "CIO",
      "Chief Security Officer",
      "Program Manager",
      "Migration Team Lead",
    ],
    standards: stds.length ? stds : ["(No explicit standards detected)"],
    scope: scope.length ? scope : ["(No scope detected)"],
  };
}
