// src/App.tsx (top of file)

// React
import React, { useEffect, useMemo, useRef, useState } from "react";

// Only the icons actually used in App.tsx
import { FileText, Bot, FolderOpen, Gauge, Wand2, Archive } from "lucide-react";

// Quill CSS for rich text editor
import 'react-quill/dist/quill.snow.css';

// Local components
import { Card, CardHeader } from "./components/Atoms";
import { DocumentsPage } from "./pages/DocumentPage.tsx";
import { RfqOrchestrator } from "./modules/Chat";      // NOTE: capital C
import { ProposalPage } from "./modules/Proposal";
import EvaluatorPage from "./pages/EvaluatorPage";
import ProposalWizardPage from "./pages/ProposalWizardPage";
import CompletedProposalsPage from "./pages/CompletedProposalsPage";

// Types (type-only import to satisfy verbatimModuleSyntax)
import type {
  Citation,
  QAResponse,
  Message,
  RFQItem,
  DBFile,
  DBFolder,
  Proposal,
  ProposalSection,
  ProposalVersionMeta,
  EvalTarget,
  EvalResult,
  RfqEvalResult,
  Page,
  DocMode,
  ProposalVariable,
} from "./lib";

// Values from lib
import {
  uid,
  upsertVariables,
  humanize,
  guessClientFromRFQName,
  localEvaluate,
  localRfqEvaluate,
  bandFromValue,
  clamp,
  round,
} from "./lib";

const BASE_URL = "http://localhost:8000";

export default function App() {
  const [page, setPage] = useState<Page>("proposal");
  const [docMode, setDocMode] = useState<DocMode>(null);

  // Wizard mode state
  const [wizardMode, setWizardMode] = useState(false);

  // Chatbot state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me questions about your RFQ/RFP documents. I’ll answer using only your documents and show citations.",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  // RFQs & Database
  // RFQs & Database
const [rfqs, setRfqs] = useState<RFQItem[]>([]);
const [rfqSelected, setRfqSelected] = useState<string>("");
const [activeRfq, setActiveRfq] = useState<RFQItem | null>(null);
const [showNewRFQ, setShowNewRFQ] = useState(false);

const [dbFolders, setDbFolders] = useState<DBFolder[]>([]);

// NEW: track loading
const [loadingData, setLoadingData] = useState(true);

// TOC Template state
const [selectedTocTemplateId, setSelectedTocTemplateId] = useState<string | null>(null);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // Upload refs
  const rfqUploadRef = useRef<HTMLInputElement | null>(null);
  const dbUploadRef = useRef<HTMLInputElement | null>(null);

  // Proposal state (single active proposal for MVP)
  const [proposal, setProposal] = useState<Proposal>(() =>
    newBlankProposal(rfqSelected)
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    proposal.sections[0]?.id ?? null
  );

  // --- Proposal Evaluator state
  const [showEvaluator, setShowEvaluator] = useState(false);
  const [evalTarget, setEvalTarget] = useState<EvalTarget>("section");
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // --- RFQ Evaluator state with persistence
  const [showRfqEvaluator, setShowRfqEvaluator] = useState(false);
  const [rfqEvalLoading, setRfqEvalLoading] = useState(false);
  const [rfqEvalResult, setRfqEvalResult] = useState<RfqEvalResult | null>(null);
  const [rfqEvalValue, setRfqEvalValue] = useState<number>(0);
  const [savedEvaluations, setSavedEvaluations] = useState<{[rfqName: string]: any}>({});
  const [showSavedEvaluation, setShowSavedEvaluation] = useState(false);

  // Load RFQs and database folders on app start
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Load RFQs
        const rfqRes = await fetch(`${BASE_URL}/rfqs`);
        if (rfqRes.ok) {
          const rfqData = await rfqRes.json();
          console.log("📋 Loaded RFQs from backend:", rfqData);
          setRfqs(rfqData);
        }

        // Load database folders
        const dbRes = await fetch(`${BASE_URL}/database`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          console.log("📁 Loaded database folders from backend:", dbData);
          setDbFolders(dbData);
        }

        // Load all saved evaluations from backend
        const evalRes = await fetch(`${BASE_URL}/get_all_evaluations`);
        if (evalRes.ok) {
          const evalData = await evalRes.json();
          console.log("💾 Loaded saved evaluations from backend:", evalData.evaluations);
          setSavedEvaluations(evalData.evaluations || {});
        }

        // Load persistent evaluator state from localStorage
        const savedState = localStorage.getItem('evaluator-state');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            console.log("💾 Loaded saved evaluator state:", state);
            if (state.rfqEvalResult) setRfqEvalResult(state.rfqEvalResult);
            if (state.rfqEvalValue) setRfqEvalValue(state.rfqEvalValue);
            if (state.rfqSelected && rfqs.find((r: any) => r.name === state.rfqSelected)) {
              console.log("💾 Restoring selected RFQ:", state.rfqSelected);
              setRfqSelected(state.rfqSelected);
            }
          } catch (e) {
            console.error("❌ Failed to parse saved evaluator state:", e);
          }
        }
      } catch (error) {
        console.error("❌ Failed to load initial data:", error);
      }
    }
    loadInitialData();
  }, []);

  // Save evaluator state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      rfqEvalResult,
      rfqEvalValue,
      rfqSelected,
      timestamp: Date.now()
    };
    localStorage.setItem('evaluator-state', JSON.stringify(state));
  }, [rfqEvalResult, rfqEvalValue, rfqSelected]);

  // Auto-select first RFQ when RFQs are loaded and load its evaluation if available
  useEffect(() => {
    if (rfqs.length > 0 && !rfqSelected) {
      console.log("🔄 Auto-selecting first RFQ:", rfqs[0].name);
      setRfqSelected(rfqs[0].name);
      
      // Load evaluation for the selected RFQ if it exists in saved evaluations
      setTimeout(() => {
        if (savedEvaluations[rfqs[0].name]) {
          console.log("💾 Loading saved evaluation for auto-selected RFQ:", rfqs[0].name);
          const saved = savedEvaluations[rfqs[0].name];
          setRfqEvalResult(saved.evaluation);
          setRfqEvalValue(saved.valueUSD);
        }
      }, 100);
    }
  }, [rfqs, rfqSelected, savedEvaluations]);

  // Keep RFQ-selected reflected in proposal variables/title (light auto-fill)
  useEffect(() => {
    if (rfqSelected) {
      setProposal((prev) => ({
        ...prev,
        rfqName: rfqSelected,
        title: prev.title || `${rfqSelected} – Proposal`,
        variables: upsertVariables(prev.variables, [
          { key: "client_name", label: "Client Name", value: guessClientFromRFQName(rfqSelected) },
          { key: "rfq_title", label: "RFQ Title", value: rfqSelected },
        ]),
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [rfqSelected]);


  // Listen for title change from ProposalPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setProposal((p) => ({ ...p, title: detail, updatedAt: new Date().toISOString() }));
    };
    document.addEventListener("proposal:title:change", handler as EventListener);
    return () => document.removeEventListener("proposal:title:change", handler as EventListener);
  }, []);
  // Chat ask
  const ask = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 6 }),
      });
      if (!res.ok) throw new Error("Ask failed");
      const data: QAResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${e?.message || "Ask failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Upload handlers (demo: local state only)
  const handleUploadToRFQ = (rfqName: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const names = Array.from(fileList).map((f) => f.name);
    setRfqs((prev) =>
      prev.map((r) => (r.name === rfqName ? { ...r, documents: [...r.documents, ...names] } : r))
    );
    setActiveRfq((prev) =>
      prev && prev.name === rfqName ? { ...prev, documents: [...prev.documents, ...names] } : prev
    );
  };
  const handleUploadToFolder = (folderName: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const toAdd: DBFile[] = Array.from(fileList).map((f) => ({
      name: f.name,
      uploadedAt: new Date().toLocaleString(),
    }));
    setDbFolders((prev) =>
      prev.map((f) => (f.name === folderName ? { ...f, files: [...f.files, ...toAdd] } : f))
    );
  };

  // Section helpers
  function selectSection(id: string) {
    setSelectedSectionId(id);
  }
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

  function addSection() {
    const newSec: ProposalSection = {
      id: uid(),
      title: `New Section ${proposal.sections.length + 1}`,
      contentMd: "",
      level: 1
    };
    setProposal((p) => ({
      ...p,
      sections: [...p.sections, newSec],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedSectionId(newSec.id);
  }

  function addSubsection(parentId: string) {
    setProposal((p) => {
      const sections = [...p.sections];
      const parentIndex = sections.findIndex(s => s.id === parentId);

      if (parentIndex === -1) return p;

      const parentSection = sections[parentIndex];
      const subsectionCount = parentSection.subsections?.length || 0;

      const newSubsection: ProposalSection = {
        id: uid(),
        title: `New Subsection ${subsectionCount + 1}`,
        contentMd: "",
        level: 2,
        parent: parentIndex
      };

      sections[parentIndex] = {
        ...parentSection,
        subsections: [...(parentSection.subsections || []), newSubsection]
      };

      return {
        ...p,
        sections,
        updatedAt: new Date().toISOString(),
      };
    });
  }
  function deleteSection(id: string) {
    setProposal((p) => {
      const sections = [...p.sections];
      let found = false;

      // Check if it's a main section
      const mainIndex = sections.findIndex(s => s.id === id);
      if (mainIndex !== -1) {
        sections.splice(mainIndex, 1);
        found = true;
      } else {
        // Check if it's a subsection
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].subsections) {
            const subIndex = sections[i].subsections!.findIndex(sub => sub.id === id);
            if (subIndex !== -1) {
              sections[i] = {
                ...sections[i],
                subsections: sections[i].subsections!.filter(sub => sub.id !== id)
              };
              found = true;
              break;
            }
          }
        }
      }

      return {
        ...p,
        sections,
        updatedAt: new Date().toISOString(),
      };
    });
    if (selectedSectionId === id) setSelectedSectionId(pickSafeSectionId());
  }
  function pickSafeSectionId() {
    // Try to find the first section
    if (proposal.sections.length > 0) {
      return proposal.sections[0].id;
    }
    // If no main sections, try to find a subsection
    for (const section of proposal.sections) {
      if (section.subsections && section.subsections.length > 0) {
        return section.subsections[0].id;
      }
    }
    return null;
  }
  function updateSectionContent(id: string, md: string) {
    setProposal((p) => {
      const sections = p.sections.map((s) => {
        if (s.id === id) {
          return { ...s, contentMd: md };
        }
        if (s.subsections) {
          const updatedSubsections = s.subsections.map((sub) =>
            sub.id === id ? { ...sub, contentMd: md } : sub
          );
          return { ...s, subsections: updatedSubsections };
        }
        return s;
      });
      return {
        ...p,
        sections,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function updateSectionContentHtml(id: string, html: string) {
    setProposal((p) => {
      const sections = p.sections.map((s) => {
        if (s.id === id) {
          return { ...s, contentHtml: html };
        }
        if (s.subsections) {
          const updatedSubsections = s.subsections.map((sub) =>
            sub.id === id ? { ...sub, contentHtml: html } : sub
          );
          return { ...s, subsections: updatedSubsections };
        }
        return s;
      });
      return {
        ...p,
        sections,
        updatedAt: new Date().toISOString(),
      };
    });
  }
  function updateSectionTitle(id: string, title: string) {
    setProposal((p) => {
      const sections = p.sections.map((s) => {
        if (s.id === id) {
          return { ...s, title };
        }
        if (s.subsections) {
          const updatedSubsections = s.subsections.map((sub) =>
            sub.id === id ? { ...sub, title } : sub
          );
          return { ...s, subsections: updatedSubsections };
        }
        return s;
      });
      return {
        ...p,
        sections,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  // Versions (in-memory)
  function saveVersion(label?: string) {
    const meta: ProposalVersionMeta = {
      id: uid(),
      label: label || `v${proposal.versions.length + 1}`,
      at: new Date().toLocaleString(),
    };
    setProposal((p) => ({ ...p, versions: [...p.versions, meta] }));
  }

  async function exportDocx() {
    try {
      console.log("📄 Exporting proposal to DOCX");
      const res = await fetch(`${BASE_URL}/export_proposal/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          fakeDownload(data.filename, data.content);
          // Show user instructions for DOCX
          setTimeout(() => {
            alert("Text file downloaded! This is a formatted text version of your proposal.\n\nTo create a proper DOCX file:\n1. Open Microsoft Word\n2. Copy and paste the text content\n3. Apply proper formatting (headings, bullet points, etc.)\n4. Save as .docx file");
          }, 500);
        }
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      console.error("❌ DOCX export error:", error);
      // Create a basic text fallback
      const fallbackText = createFallbackText(proposal);
      fakeDownload(`${proposal.title || "proposal"}.txt`, fallbackText);
    }
  }

  async function exportPdf() {
    try {
      console.log("📄 Exporting proposal to PDF");
      const res = await fetch(`${BASE_URL}/export_proposal/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          if (data.format === "html") {
            // Create HTML file that can be printed as PDF
            downloadHtmlAsPdf(data.filename, data.content);
          } else {
            fakeDownload(data.filename, data.content);
          }
        }
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      console.error("❌ PDF export error:", error);
      // Create a basic HTML fallback
      const fallbackHtml = createFallbackHtml(proposal);
      downloadHtmlAsPdf(`${proposal.title || "proposal"}.html`, fallbackHtml);
    }
  }

  // AI-powered proposal generation
  // AI-powered proposal generation with progress tracking
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratingSection, setCurrentGeneratingSection] = useState<string>("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Function to simulate real-time section generation
  async function simulateRealTimeSectionGeneration(
    sections: ProposalSection[],
    complianceMatrix: any[]
  ) {
    // Clear existing sections first
    setProposal((p) => ({ ...p, sections: [], updatedAt: new Date().toISOString() }));

    // Add sections one by one with delays
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      setCurrentGeneratingSection(`Generating: ${section.title}`);

      // Add the main section
      setProposal((p) => ({
        ...p,
        sections: [...p.sections, section],
        updatedAt: new Date().toISOString(),
      }));

      // Set as selected if it's the first section
      if (i === 0) {
        setSelectedSectionId(section.id);
      }

      // Wait a bit before adding subsections (if any)
      if (section.subsections && section.subsections.length > 0) {
        for (let j = 0; j < section.subsections.length; j++) {
          const subsection = section.subsections[j];
          setCurrentGeneratingSection(`Generating: ${subsection.title}`);

          // Short delay for subsections
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Short delay between main sections
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Add compliance matrix at the end if available
    if (complianceMatrix && complianceMatrix.length > 0) {
      setCurrentGeneratingSection("Adding compliance matrix...");
      setProposal((p) => ({
        ...p,
        compliance: complianceMatrix.map((item: any) => ({
          req: item.requirement,
          response: item.response,
          evidence: item.evidence,
          status: item.status as "Compliant" | "Partial" | "Exception"
        })),
        updatedAt: new Date().toISOString(),
      }));

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async function aiDraftFromRFQ() {
    if (!rfqSelected) {
      alert("Please select an RFQ first");
      return;
    }

    setIsGenerating(true);
    setCurrentGeneratingSection("Preparing proposal generation...");

    try {
      console.log("🤖 Generating AI proposal draft for RFQ:", rfqSelected);
      if (selectedTocTemplateId) {
        console.log("🎯 Using TOC template:", selectedTocTemplateId);
      }

      // Generate unique session ID for pause/stop/resume control
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log("🔑 Generated session ID:", sessionId);
      setCurrentSessionId(sessionId);

      // Start polling for generation status
      const statusPollingInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${BASE_URL}/generation_status/${sessionId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const currentSection = statusData.current_section || "";
            const progress = `${statusData.completed_sections || 0}/${statusData.total_sections || 0}`;
            setCurrentGeneratingSection(`${currentSection} (${progress})`);

            // Stop polling if completed or stopped
            if (statusData.status === "completed" || statusData.status === "stopped") {
              clearInterval(statusPollingInterval);
            }
          }
        } catch (err) {
          console.warn("Status polling error:", err);
        }
      }, 1000); // Poll every 1 second

      const requestBody = {
        rfqName: rfqSelected,
        structure: "standard",
        tone: "professional",
        includeCompliance: true,
        sessionId: sessionId,  // Add session ID for backend control
        ...(selectedTocTemplateId && { tocTemplateId: selectedTocTemplateId })
      };

      const res = await fetch(`${BASE_URL}/generate_proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Stop polling when generation completes
      clearInterval(statusPollingInterval);

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          console.log("✅ Generated proposal:", data.proposal);

          // Switch to proposal page immediately to show real-time updates
          setPage("proposal");

          // Convert generated sections to proposal format
          const generatedSections = data.proposal.sections.map((section: any) => ({
            id: uid(),
            title: section.title,
            contentMd: section.content || section.contentMd || "",
            level: section.level || 1,
            subsections: section.subsections?.map((sub: any) => ({
              id: uid(),
              title: sub.title,
              contentMd: sub.content || sub.contentMd || "",
              level: sub.level || 2,
            })) || undefined
          }));

          // Simulate real-time section addition
          await simulateRealTimeSectionGeneration(generatedSections, data.proposal.compliance_matrix);

          setCurrentGeneratingSection("✅ Proposal generated successfully!");
          console.log("✅ Applied generated proposal to interface");

          // Clear status after a delay
          setTimeout(() => {
            setCurrentGeneratingSection("");
          }, 2000);
        } else {
          throw new Error(data.message || "Failed to generate proposal");
        }
      } else {
        throw new Error("API request failed");
      }
    } catch (error) {
      console.error("❌ Error generating proposal:", error);
      setCurrentGeneratingSection("❌ Error generating proposal, using fallback template");
      // Fallback to simple demo content
      const client = proposal.variables.find((v) => v.key === "client_name")?.value || "the client";
      const drafted: ProposalSection[] = [
        {
          id: uid(),
          title: "Executive Summary",
          contentMd: `We propose a fit-for-purpose solution for **${client}** based on the RFQ.\n\n- Outcome-focused\n- Risk-mitigated\n- Rapid delivery`,
        },
        { id: uid(), title: "Scope", contentMd: "- Discovery\n- Implementation\n- Testing\n- Handover" },
        {
          id: uid(),
          title: "Timeline",
          contentMd: "| Phase | Duration |\n|---|---|\n| Discovery | 2 weeks |\n| Build | 4 weeks |\n| Test | 2 weeks |",
        },
        { id: uid(), title: "Team", contentMd: "- PM\n- Lead Engineer\n- Security SME" },
        { id: uid(), title: "Compliance Matrix", contentMd: "> Run **Fill Compliance** to generate a matrix from RFQ docs." },
      ];
      setProposal((p) => ({ ...p, sections: drafted, updatedAt: new Date().toISOString() }));
      setSelectedSectionId(drafted[0].id);

      // Clear error status after delay
      setTimeout(() => {
        setCurrentGeneratingSection("");
      }, 5000);
    } finally {
      setIsGenerating(false);
    }
  }

  // Pause/Resume/Stop generation handlers
  async function pauseGeneration() {
    if (!currentSessionId) return;
    try {
      const res = await fetch(`${BASE_URL}/generation_pause/${currentSessionId}`, {
        method: "POST",
      });
      if (res.ok) {
        console.log("⏸️ Generation paused");
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("❌ Error pausing generation:", error);
    }
  }

  async function resumeGeneration() {
    if (!currentSessionId) return;
    try {
      const res = await fetch(`${BASE_URL}/generation_resume/${currentSessionId}`, {
        method: "POST",
      });
      if (res.ok) {
        console.log("▶️ Generation resumed");
        setIsGenerating(true);
      }
    } catch (error) {
      console.error("❌ Error resuming generation:", error);
    }
  }

  async function stopGeneration() {
    if (!currentSessionId) return;
    try {
      const res = await fetch(`${BASE_URL}/generation_stop/${currentSessionId}`, {
        method: "POST",
      });
      if (res.ok) {
        console.log("⏹️ Generation stopped");
        setIsGenerating(false);
        setCurrentSessionId(null);
        setCurrentGeneratingSection("");
      }
    } catch (error) {
      console.error("❌ Error stopping generation:", error);
    }
  }

  async function aiRewrite(tone: "concise" | "formal" | "marketing") {
    if (!selectedSection || !rfqSelected) {
      alert("Please select a section and RFQ first");
      return;
    }

    setLoading(true);
    try {
      console.log(`🤖 Rewriting section "${selectedSection.title}" with ${tone} tone`);
      
      // Map tone to professional tone parameter
      const toneMap = {
        "concise": "concise",
        "formal": "formal", 
        "marketing": "innovative"
      };

      const res = await fetch(`${BASE_URL}/generate_section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqName: rfqSelected,
          sectionType: selectedSection.title.toLowerCase().replace(/\s+/g, '_'),
          context: selectedSection.contentMd,
          tone: toneMap[tone]
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          console.log("✅ Section rewritten successfully");
          updateSectionContent(selectedSection.id, data.section.content);
        } else {
          throw new Error(data.message || "Failed to rewrite section");
        }
      } else {
        throw new Error("API request failed");
      }
    } catch (error) {
      console.error("❌ Error rewriting section:", error);
      // Fallback to simple prefix approach
      const prefix =
        tone === "concise" ? "(Concise) " : tone === "formal" ? "(Formal) " : "(Marketing) ";
      updateSectionContent(selectedSection.id, `${prefix}${selectedSection.contentMd}`);
    } finally {
      setLoading(false);
    }
  }
  async function aiFillCompliance() {
    if (!rfqSelected) {
      alert("Please select an RFQ first");
      return;
    }

    setLoading(true);
    try {
      console.log("🤖 Generating compliance matrix for RFQ:", rfqSelected);
      
      const res = await fetch(`${BASE_URL}/generate_compliance_matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqName: rfqSelected
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          console.log("✅ Generated compliance matrix:", data.compliance_matrix);
          
          // Create markdown table from compliance matrix
          const table = [
            "| Requirement | Response | Evidence | Status |",
            "|---|---|---|---|",
            ...data.compliance_matrix.map((item: any) => 
              `| ${item.requirement} | ${item.response} | ${item.evidence} | ${item.status} |`
            )
          ].join("\n");

          // Update compliance in proposal state
          setProposal((p) => ({
            ...p,
            compliance: data.compliance_matrix.map((item: any) => ({
              req: item.requirement,
              response: item.response,
              evidence: item.evidence,
              status: item.status as "Compliant" | "Partial" | "Exception"
            })),
            updatedAt: new Date().toISOString(),
          }));

          // Add/update compliance section
          const existing = proposal.sections.find((s) =>
            s.title.toLowerCase().includes("compliance")
          );
          if (existing) {
            updateSectionContent(existing.id, table);
          } else {
            const sec: ProposalSection = { id: uid(), title: "Compliance Matrix", contentMd: table };
            setProposal((p) => ({
              ...p,
              sections: [...p.sections, sec],
              updatedAt: new Date().toISOString(),
            }));
            setSelectedSectionId(sec.id);
          }
          
          console.log("✅ Applied compliance matrix to proposal");
        } else {
          throw new Error(data.message || "Failed to generate compliance matrix");
        }
      } else {
        throw new Error("API request failed");
      }
    } catch (error) {
      console.error("❌ Error generating compliance matrix:", error);
      // Fallback to simple demo table
      const table =
        `| Requirement | Response | Evidence | Status |\n|---|---|---|---|\n| Provide ISO27001 | We are certified. | Cert #123 | Compliant |`;
      const existing = proposal.sections.find((s) =>
        s.title.toLowerCase().includes("compliance")
      );
      if (existing) {
        updateSectionContent(existing.id, table);
      } else {
        const sec: ProposalSection = { id: uid(), title: "Compliance Matrix", contentMd: table };
        setProposal((p) => ({
          ...p,
          sections: [...p.sections, sec],
          updatedAt: new Date().toISOString(),
        }));
        setSelectedSectionId(sec.id);
      }
    } finally {
      setLoading(false);
    }
  }

  // Apply TOC Template to create proposal sections
  async function applyTOCTemplate(templateId: string) {
    try {
      console.log("📋 Applying TOC template:", templateId);
      setLoading(true);

      // Set the selected TOC template for future AI generation
      setSelectedTocTemplateId(templateId);

      const res = await fetch(`${BASE_URL}/apply_toc_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          proposal_title: proposal.title || "New Proposal"
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          console.log("✅ Applied TOC template:", data.sections);

          // Convert template sections to proposal format
          const sections: ProposalSection[] = data.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            contentMd: section.contentMd || "",
            contentHtml: section.contentHtml || "",
            locked: section.locked || false,
          }));

          // Update proposal with template sections
          setProposal((p) => ({
            ...p,
            sections,
            updatedAt: new Date().toISOString(),
          }));

          // Select first section
          setSelectedSectionId(sections[0]?.id || null);
          console.log("✅ Applied TOC template to proposal");
        } else {
          throw new Error(data.message || "Failed to apply TOC template");
        }
      } else {
        throw new Error("Failed to apply TOC template");
      }
    } catch (error) {
      console.error("❌ Error applying TOC template:", error);
      alert("Failed to apply TOC template. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Proposal Evaluator logic
  async function runEvaluation() {
    setEvalError(null);
    setEvalResult(null);
    setEvalLoading(true);

    const text =
      evalTarget === "section"
        ? (selectedSection?.contentMd || "")
        : proposal.sections.map((s) => `# ${s.title}\n\n${s.contentMd}`).join("\n\n");

    try {
      const res = await fetch(`${BASE_URL}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: evalTarget,
          rfqName: proposal.rfqName,
          variables: proposal.variables,
          sections: proposal.sections,
          text,
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        const normalized: EvalResult = {
          overall: clamp(payload.overall ?? payload.score ?? 0, 0, 100),
          criteria: (payload.criteria ?? payload.dimensions ?? []).map((c: any) => ({
            name: c.name || c.dimension || "Criterion",
            score: clamp(c.score ?? 0, 0, 100),
            notes: c.notes ?? c.findings ?? [],
          })),
          suggestions: payload.suggestions ?? payload.actions ?? [],
          rewritten: payload.rewritten ?? payload.rewrite ?? undefined,
          metrics: payload.metrics ?? inferMetrics(text),
        };
        setEvalResult(normalized);
      } else {
        const local = localEvaluate(text, proposal.rfqName || "", proposal.variables);
        setEvalResult(local);
      }
    } catch {
      const local = localEvaluate(text, proposal.rfqName || "", proposal.variables);
      setEvalResult(local);
    } finally {
      setEvalLoading(false);
    }
  }

  function applyRewriteFromEval() {
    if (!evalResult?.rewritten) return;
    if (evalTarget === "section" && selectedSection) {
      updateSectionContent(selectedSection.id, evalResult.rewritten);
    }
  }
  function saveEvaluatorVersion() {
    const ts = new Date().toLocaleString();
    saveVersion(`Evaluator – ${ts}`);
  }
  function copyReportToClipboard() {
    if (!evalResult) return;
    const lines: string[] = [];
    lines.push(`# Evaluator Report – ${proposal.title}`);
    lines.push(`Target: ${evalTarget === "section" ? "Active Section" : "Whole Proposal"}`);
    lines.push(`Overall: ${Math.round(evalResult.overall)}/100`);
    lines.push("");
    lines.push("## Criteria");
    evalResult.criteria.forEach((c) => {
      lines.push(`- **${c.name}**: ${Math.round(c.score)}/100`);
      c.notes.forEach((n) => lines.push(`  - ${n}`));
    });
    lines.push("");
    lines.push("## Metrics");
    const m = evalResult.metrics;
    lines.push(`- Words: ${m.words}`);
    lines.push(`- Sentences: ${m.sentences}`);
    lines.push(`- Avg sentence length: ${Math.round(m.avgSentenceLength * 10) / 10}`);
    lines.push(`- Headings: ${m.headings}`);
    lines.push(`- Bullets: ${m.bullets}`);
    lines.push(`- Est. reading time: ${m.estReadMin} min`);
    if (m.readingGrade != null) lines.push(`- Reading grade (approx): ${m.readingGrade}`);
    lines.push("");
    if (evalResult.suggestions?.length) {
      lines.push("## Suggestions");
      evalResult.suggestions.forEach((s) => lines.push(`- ${s}`));
    }
    if (evalResult.rewritten) {
      lines.push("");
      lines.push("## Suggested Rewrite");
      lines.push(evalResult.rewritten);
    }
    navigator.clipboard?.writeText(lines.join("\n"));
  }

  // --- Evaluation Management Functions
  async function saveCurrentEvaluation(rfqName: string) {
    if (!rfqEvalResult) {
      console.error("❌ No evaluation result to save");
      return;
    }

    try {
      console.log("💾 Saving evaluation for RFQ:", rfqName);
      const res = await fetch(`${BASE_URL}/save_evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqName,
          evaluation: rfqEvalResult,
          valueUSD: rfqEvalValue,
        }),
      });

      if (res.ok) {
        console.log("✅ Evaluation saved successfully");
        // Update local saved evaluations
        setSavedEvaluations(prev => ({
          ...prev,
          [rfqName]: {
            evaluation: rfqEvalResult,
            valueUSD: rfqEvalValue,
            timestamp: new Date().toISOString()
          }
        }));
      } else {
        console.error("❌ Failed to save evaluation");
      }
    } catch (error) {
      console.error("❌ Error saving evaluation:", error);
    }
  }

  async function loadSavedEvaluation(rfqName: string) {
    // First check if we already have it in memory
    if (savedEvaluations[rfqName]) {
      console.log("💾 Loading evaluation from memory for:", rfqName);
      const saved = savedEvaluations[rfqName];
      setRfqEvalResult(saved.evaluation);
      setRfqEvalValue(saved.valueUSD);
      return;
    }

    // If not in memory, fetch from backend
    try {
      console.log("📥 Loading saved evaluation from backend for RFQ:", rfqName);
      const res = await fetch(`${BASE_URL}/get_evaluation/${encodeURIComponent(rfqName)}`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          console.log("✅ Loaded saved evaluation:", data.evaluation);
          const saved = data.evaluation;
          setRfqEvalResult(saved.evaluation);
          setRfqEvalValue(saved.valueUSD);
          
          // Update local cache
          setSavedEvaluations(prev => ({
            ...prev,
            [rfqName]: saved
          }));
        } else {
          console.log("ℹ️ No saved evaluation found for:", rfqName);
          // Clear current evaluation if no saved one exists
          setRfqEvalResult(null);
          setRfqEvalValue(0);
        }
      }
    } catch (error) {
      console.error("❌ Error loading saved evaluation:", error);
    }
  }

  // --- RFQ Evaluator logic
  async function runRfqEvaluation(rfq: RFQItem | null) {
    console.log("🔄 Starting RFQ evaluation for:", rfq?.name);
    if (!rfq) {
      console.error("❌ No RFQ provided for evaluation");
      return;
    }
    setRfqEvalLoading(true);
    setRfqEvalResult(null);

    try {
      console.log("📡 Sending evaluation request to backend...");
      const res = await fetch(`${BASE_URL}/evaluate_rfq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqName: rfq.name,
          client: rfq.client,
          dueDate: rfq.dueDate,
          documents: rfq.documents,
        }),
      });

      console.log("📨 Response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("✅ Evaluation data received:", data);
        const valueUSD = Number(data.valueUSD ?? 0);
        const capped = Math.max(0, valueUSD);
        const newResult = {
          valueUSD: capped,
          summary: data.summary ?? [],
          objectives: data.objectives ?? [],
          deliverables: data.deliverables ?? [],
          constraints: data.constraints ?? [],
          risks: data.risks ?? [],
          successCriteria: data.successCriteria ?? [],
          stakeholders: data.stakeholders ?? [],
          standards: data.standards ?? [],
          scope: data.scope ?? [],
          band: bandFromValue(capped),
        };
        
        setRfqEvalValue(capped);
        setRfqEvalResult(newResult);
        
        // Auto-save the new evaluation
        setTimeout(() => saveCurrentEvaluation(rfq.name), 1000);
      } else {
        console.log("⚠️ API request failed, using local evaluation");
        const local = localRfqEvaluate(rfq);
        setRfqEvalValue(local.valueUSD);
        setRfqEvalResult(local);
      }
    } catch (error) {
      console.error("❌ Evaluation request failed:", error);
      const local = localRfqEvaluate(rfq);
      setRfqEvalValue(local.valueUSD);
      setRfqEvalResult(local);
    } finally {
      console.log("🏁 Evaluation completed");
      setRfqEvalLoading(false);
    }
  }

  // --- UI
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4">
        <div>
          <div className="flex items-center justify-center mb-8">
            <div className="text-xl font-bold tracking-wide">NGTRA</div>
          </div>
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => {
                setPage("proposal");
                setWizardMode(true);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${wizardMode && page === "proposal"
                  ? "bg-blue-600 text-white"
                  : "hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300"
                }`}
            >
              <Wand2 className="w-5 h-5" /> Proposal Wizard
            </button>
            <button
              onClick={() => {
                setPage("proposal");
                setWizardMode(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${!wizardMode && page === "proposal"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              <FileText className="w-5 h-5" /> Proposal
            </button>
            <button
              onClick={() => setPage("rfqbot")}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${page === "rfqbot"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              <Bot className="w-5 h-5" /> Orchestrator
            </button>

            {/* RFQ Evaluator trigger (under Orchestrator) */}
            <button
              onClick={() => setPage("evaluator")}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${page === "evaluator"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              <Gauge className="w-5 h-5" /> Evaluator
            </button>

            <button
              onClick={() => setPage("completed-proposals")}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${page === "completed-proposals"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              <Archive className="w-5 h-5" /> Completed Proposals
            </button>
          </nav>
        </div>
        <div>
          <button
            onClick={() => {
              setPage("documents");
              setDocMode(null);
              setActiveRfq(null);
              setActiveFolder(null);
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${page === "documents"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
          >
            <FolderOpen className="w-5 h-5" /> Documents
          </button>
        </div>
        </aside>

      {/* Main */}
      <main className="flex-1 p-6 flex flex-col">
        {page === "proposal" && !wizardMode && (
          <ProposalPage
            rfqs={rfqs}
            rfqSelected={rfqSelected}
            setRfqSelected={setRfqSelected}
            proposal={proposal}
            selectedSectionId={selectedSectionId}
            setSelectedSectionId={setSelectedSectionId}
            addSection={addSection}
            addSubsection={addSubsection}
            deleteSection={deleteSection}
            updateSectionContent={updateSectionContent}
            updateSectionContentHtml={updateSectionContentHtml}
            updateSectionTitle={updateSectionTitle}
            saveVersion={saveVersion}
            exportPdf={exportPdf}
            exportDocx={exportDocx}
            aiDraftFromRFQ={aiDraftFromRFQ}
            aiRewrite={aiRewrite}
            aiFillCompliance={aiFillCompliance}
            setShowEvaluator={setShowEvaluator}
            applyTOCTemplate={applyTOCTemplate}
            selectedTocTemplateId={selectedTocTemplateId}
            currentGeneratingSection={currentGeneratingSection}
            isGenerating={isGenerating}
            onPauseGeneration={pauseGeneration}
            onResumeGeneration={resumeGeneration}
            onStopGeneration={stopGeneration}
            onVarChange={(key, value) =>
              setProposal((p) => ({
                ...p,
                variables: upsertVariables(p.variables, [{ key, label: humanize(key), value }]),
                updatedAt: new Date().toISOString(),
              }))
            }
          />
        )}

        {page === "proposal" && wizardMode && (
          <ProposalWizardPage
            rfqs={rfqs}
            onRfqUpload={(files: FileList) => {
              // Handle RFQ upload in wizard mode
              console.log('RFQ upload in wizard:', files);
            }}
            onTemplateUpload={(files: FileList) => {
              // Handle template upload in wizard mode
              console.log('Template upload in wizard:', files);
            }}
            onProposalComplete={(generatedProposal: Proposal) => {
              setProposal(generatedProposal);
              setWizardMode(false);
              setSelectedSectionId(generatedProposal.sections[0]?.id || null);
            }}
            BASE_URL={BASE_URL}
          />
        )}

        {page === "rfqbot" && (
          <RfqOrchestrator
            rfqs={rfqs}
            rfqSelected={rfqSelected}
            setRfqSelected={setRfqSelected}
            messages={messages}
            loading={loading}
            question={question}
            setQuestion={setQuestion}
            ask={ask}
          />
        )}

        {page === "documents" && (
          <DocumentsPage
            docMode={docMode}
            setDocMode={setDocMode}
            rfqs={rfqs}
            setRfqs={setRfqs}
            setRfqSelected={setRfqSelected}
            activeRfq={activeRfq}
            setActiveRfq={setActiveRfq}
            rfqUploadRef={rfqUploadRef}
            handleUploadToRFQ={handleUploadToRFQ}
            dbFolders={dbFolders}
            setDbFolders={setDbFolders}
            activeFolder={activeFolder}
            setActiveFolder={setActiveFolder}
            dbUploadRef={dbUploadRef}
            handleUploadToFolder={handleUploadToFolder}
            showNewRFQ={showNewRFQ}
            setShowNewRFQ={setShowNewRFQ}
          />
        )}
      </main>

      {page === "evaluator" && (
        <EvaluatorPage
          rfqs={rfqs}
          rfqSelected={rfqSelected}
          setRfqSelected={(name) => {
            setRfqSelected(name);
            // Load saved evaluation when switching RFQs
            loadSavedEvaluation(name);
          }}
          valueUSD={rfqEvalValue}
          setValueUSD={(n) => {
            setRfqEvalValue(n);
            setRfqEvalResult((prev) =>
              prev ? { ...prev, valueUSD: n, band: bandFromValue(n) } : prev
            );
          }}
          result={rfqEvalResult}
          loading={rfqEvalLoading}
          savedEvaluations={savedEvaluations}
          onEvaluate={() => {
            console.log("🔍 All available RFQs:", rfqs);
            console.log("📌 Currently selected RFQ name:", rfqSelected);
            console.log("🔍 RFQ names in array:", rfqs.map(r => r.name));

            const rfq = rfqs.find((r) => r.name === rfqSelected) || null;
            console.log("🎯 Selected RFQ for evaluation:", rfq);

            if (!rfq) {
              console.error("❌ RFQ not found! Selected:", rfqSelected);
              console.error("❌ Available RFQ names:", rfqs.map(r => `"${r.name}"`));
              return;
            }

            runRfqEvaluation(rfq);
          }}
          onLoadSaved={(rfqName) => {
            setRfqSelected(rfqName);
            loadSavedEvaluation(rfqName);
          }}
          onSaveEvaluation={() => saveCurrentEvaluation(rfqSelected)}
        />
      )}

      {page === "completed-proposals" && (
        <CompletedProposalsPage
          BASE_URL={BASE_URL}
          onOpenProposal={(openedProposal: Proposal) => {
            setProposal(openedProposal);
            setPage("proposal");
            setWizardMode(false);
            setSelectedSectionId(openedProposal.sections[0]?.id || null);
          }}
        />
      )}


    </div>
  );
}

// --- proposal initializer ---
function newBlankProposal(rfqName: string): Proposal {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: `${rfqName} – Proposal`,
    rfqName,
    sections: [
      { id: uid(), title: "Executive Summary", contentMd: "" },
      { id: uid(), title: "Scope", contentMd: "" },
    ],
    variables: [
      { key: "client_name", label: "Client Name", value: guessClientFromRFQName(rfqName) },
      { key: "rfq_title", label: "RFQ Title", value: rfqName },
    ],
    compliance: [],
    updatedAt: now,
    createdAt: now,
    versions: [],
  };
}

// local helper for fake downloads (kept here to avoid pulling DOM APIs into lib)
function fakeDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper function to download HTML that can be printed as PDF
function downloadHtmlAsPdf(filename: string, htmlContent: string) {
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  // Show user instructions
  setTimeout(() => {
    alert("HTML file downloaded! To convert to PDF:\n1. Open the downloaded HTML file in your browser\n2. Press Ctrl+P (or Cmd+P on Mac)\n3. Select 'Save as PDF' as the destination\n4. Click 'Save'");
  }, 500);
}

// Create fallback HTML for proposals
function createFallbackHtml(proposal: any): string {
  const title = proposal.title || "Untitled Proposal";
  const sections = proposal.sections || [];
  
  let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #34495e;
            border-bottom: 1px solid #bdc3c7;
            padding-bottom: 5px;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        .section {
            margin-bottom: 25px;
        }
        @media print {
            body { font-size: 12pt; }
            h1 { font-size: 18pt; }
            h2 { font-size: 14pt; }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
`;

  sections.forEach((section: any) => {
    const content = section.contentHtml || 
                   (section.contentMd || '').replace(/\n/g, '<br/>');
    
    html += `
    <div class="section">
        <h2>${section.title || 'Untitled Section'}</h2>
        <div>${content}</div>
    </div>`;
  });

  html += `
</body>
</html>`;

  return html;
}

// Helper function to convert HTML to plain text
function htmlToText(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}

// Create fallback text for DOCX proposals
function createFallbackText(proposal: any): string {
  const title = proposal.title || "Untitled Proposal";
  const sections = proposal.sections || [];
  
  let text = `${title.toUpperCase()}\n`;
  text += "=".repeat(title.length) + "\n\n";
  text += `Document Type: Business Proposal\n`;
  text += `Generated: ${new Date().toISOString()}\n\n`;
  text += "=".repeat(50) + "\n\n";
  
  sections.forEach((section: any) => {
    const sectionTitle = section.title || 'Untitled Section';
    text += `${sectionTitle.toUpperCase()}\n`;
    text += "=".repeat(sectionTitle.length) + "\n\n";
    
    // Use HTML content if available, otherwise use markdown
    const content = section.contentHtml ? 
                   htmlToText(section.contentHtml) : 
                   (section.contentMd || '');
    
    if (section.contentHtml) {
      // If we have HTML content, convert it to plain text
      text += content + "\n\n";
    } else {
      // Basic markdown to text conversion for legacy content
      const lines = content.split('\n');
      lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('### ')) {
          text += `\n${line.slice(4).toUpperCase()}\n`;
          text += "-".repeat(line.slice(4).length) + "\n";
        } else if (line.startsWith('## ')) {
          text += `\n${line.slice(3).toUpperCase()}\n`;
          text += "-".repeat(line.slice(3).length) + "\n";
        } else if (line.startsWith('# ')) {
          text += `\n${line.slice(2).toUpperCase()}\n`;
          text += "-".repeat(line.slice(2).length) + "\n";
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          text += `  • ${line.slice(2)}\n`;
        } else if (line.startsWith('> ')) {
          text += `    "${line.slice(2)}"\n`;
        } else if (line) {
          // Remove markdown formatting
          const cleanLine = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
          text += `${cleanLine}\n`;
        } else {
          text += "\n";
        }
      });
      text += "\n\n";
    }
  });
  
  text += "=".repeat(50) + "\n";
  text += `Document generated on ${new Date().toISOString()}\n`;
  text += "=".repeat(50);
  
  return text;
}

// inferMetrics needed in runEvaluation normalization fallback
function inferMetrics(text: string) {
  const words = (text.match(/\b[\w’'-]+\b/g) || []).length;
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length);
  const avgSentenceLength = words / sentences;
  const headings = (text.match(/^\s{0,3}#{1,6}\s+/gm) || []).length;
  const bullets = (text.match(/^\s*[-*+]\s+/gm) || []).length;
  const estReadMin = Math.max(1, Math.round(words / 200));
  const syllables = Math.max(1, Math.round(words * 1.3));
  const readingGrade = Math.round(0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59);
  return { words, sentences, avgSentenceLength, headings, bullets, estReadMin, readingGrade };
}
