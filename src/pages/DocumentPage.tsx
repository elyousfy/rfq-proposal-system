import React, { useRef, useState, useEffect } from "react";
import {
    FileText,
    FolderOpen,
    Upload,
    ArrowLeft,
    Paperclip,
    Trash2,
    Eye,
    Download,
    Loader2,
} from "lucide-react";
import { Card, CardHeader } from "../components/Atoms";
import type { RFQItem, DBFolder } from "../lib";

const BASE_URL = "http://localhost:8000";

/** Match backend db.safe_collection_name */
function safeCollectionName(name: string) {
    let safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^[-._]+|[-._]+$/g, "");
    if (safe.length < 3) safe = `col_${safe}`;
    return safe;
}

export function DocumentsPage(props: {
    docMode: null | "rfqs" | "database";
    setDocMode: (m: null | "rfqs" | "database") => void;

    rfqs: RFQItem[];
    setRfqs: React.Dispatch<React.SetStateAction<RFQItem[]>>;
    setRfqSelected: (name: string) => void;

    activeRfq: RFQItem | null;
    setActiveRfq: (rfq: RFQItem | null) => void;

    rfqUploadRef: React.RefObject<HTMLInputElement>;

    dbFolders: DBFolder[];
    setDbFolders: React.Dispatch<React.SetStateAction<DBFolder[]>>;

    activeFolder: string | null;
    setActiveFolder: (name: string | null) => void;

    dbUploadRef: React.RefObject<HTMLInputElement>;

    showNewRFQ: boolean;
    setShowNewRFQ: (v: boolean) => void;
}) {
    const {
        docMode,
        setDocMode,
        rfqs,
        setRfqs,
        setRfqSelected,
        activeRfq,
        setActiveRfq,
        rfqUploadRef,
        dbFolders,
        setDbFolders,
        activeFolder,
        setActiveFolder,
        dbUploadRef,
        showNewRFQ,
        setShowNewRFQ,
    } = props;

    const [showDeleteRFQ, setShowDeleteRFQ] = useState(false);
    const [viewFile, setViewFile] = useState<string | null>(null);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    // Indicators
    const [uploading, setUploading] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null); // filename or rfq name

    // --- Upload Supporting Docs ---
    const handleUploadSupportingDocs = async (rfqName: string, fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            Array.from(fileList).forEach((file) => formData.append("files", file));

            const collection = safeCollectionName(`rfq_${rfqName}`);
            const res = await fetch(`${BASE_URL}/ingest?collection=${collection}`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data.skipped > 0) {
                    alert(`⚠️ ${data.skipped} file(s) already exist in the system and were skipped.`);
                }

                // register each file in metadata & ensure ingested (backend may re-check)
                for (const file of Array.from(fileList)) {
                    const resp = await fetch(`${BASE_URL}/add_supporting_doc`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rfqName, filename: file.name }),
                    });
                    const docData = await resp.json();
                    if (docData.status === "error") {
                        alert(`⚠️ ${file.name} was not added: ${docData.message}`);
                    }
                }

                // refresh RFQs list
                const rfqRes = await fetch(`${BASE_URL}/rfqs`);
                if (rfqRes.ok) {
                    const rfqs = await rfqRes.json();
                    const normalized = rfqs.map((r: any) => ({
                        ...r,
                        documents: r.documents || [r.mainDocument, ...(r.supportingDocuments || [])].filter(Boolean),
                    }));
                    setRfqs(normalized);
                    
                    // Update activeRfq if it matches the current one
                    if (activeRfq) {
                        const updatedActiveRfq = normalized.find((r: any) => r.name === activeRfq.name);
                        if (updatedActiveRfq) {
                            setActiveRfq(updatedActiveRfq);
                        }
                    }
                }
            } else {
                console.error("Ingest failed:", await res.text());
            }
        } catch (err) {
            console.error("Upload supporting docs error:", err);
        } finally {
            setTimeout(() => setUploading(false), 300);
        }
    };

    // --- Upload to DB Folder ---
    const handleUploadToFolder = async (folderName: string, fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            Array.from(fileList).forEach((file) => formData.append("files", file));
            const collection = safeCollectionName(`db_${folderName}`);

            await fetch(`${BASE_URL}/ingest?collection=${collection}`, {
                method: "POST",
                body: formData,
            });

            const res = await fetch(`${BASE_URL}/database`);
            if (res.ok) {
                const folders = await res.json();
                setDbFolders(folders);
                
                // Update activeFolder if it matches the current one
                if (activeFolder) {
                    const updatedActiveFolder = folders.find((f: any) => f.name === activeFolder);
                    if (updatedActiveFolder) {
                        // activeFolder is just a string, but we need to ensure the folder data is fresh
                        // The folder data itself is in dbFolders, so this update to setDbFolders is sufficient
                    }
                }
            }
        } catch (err) {
            console.error("Upload to DB folder failed:", err);
        } finally {
            setTimeout(() => setUploading(false), 300);
        }
    };

    // --- Create New Folder ---
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        
        try {
            const res = await fetch(`${BASE_URL}/create_folder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newFolderName.trim() }),
            });
            
            if (res.ok) {
                // Refresh folders list
                const foldersRes = await fetch(`${BASE_URL}/database`);
                if (foldersRes.ok) {
                    const folders = await foldersRes.json();
                    setDbFolders(folders);
                }
            }
        } catch (err) {
            console.error("Create folder failed:", err);
        } finally {
            setShowNewFolder(false);
            setNewFolderName("");
        }
    };

    // --- Replace Main Document ---
    // Uses the endpoint style you had earlier: POST /replace_main_doc/{rfqName} (FormData)
    const handleReplaceMainDoc = async (rfqName: string, file: File) => {
        setReplacing(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(
                `${BASE_URL}/replace_main_doc/${encodeURIComponent(rfqName)}`,
                { method: "POST", body: formData }
            );

            if (res.ok) {
                // optional: read JSON and warn if skipped
                try {
                    const data = await res.json();
                    if (data?.skipped > 0) {
                        alert(`⚠️ ${file.name} was not replaced (already exists).`);
                    }
                } catch {
                    /* no-op if endpoint returns no JSON */
                }
                // refresh RFQs
                const rfqRes = await fetch(`${BASE_URL}/rfqs`);
                if (rfqRes.ok) {
                    const rfqs = await rfqRes.json();
                    setRfqs(rfqs);
                    
                    // Update activeRfq if it matches the current one
                    if (activeRfq) {
                        const updatedActiveRfq = rfqs.find((r: any) => r.name === activeRfq.name);
                        if (updatedActiveRfq) {
                            setActiveRfq(updatedActiveRfq);
                        }
                    }
                }
            } else {
                console.error("Replace main doc failed:", await res.text());
            }
        } catch (err) {
            console.error("Replace main doc error:", err);
        } finally {
            setTimeout(() => setReplacing(false), 300);
        }
    };

    // --- Delete (supports RFQ docs & DB files) ---
    const handleDelete = async (collection: string, filename: string) => {
        setDeleting(filename);
        try {
            await fetch(`${BASE_URL}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ collection, filename }),
            });

            if (collection.startsWith("db_")) {
                const res = await fetch(`${BASE_URL}/database`);
                if (res.ok) {
                    const folders = await res.json();
                    setDbFolders(folders);
                    // activeFolder data is automatically updated via setDbFolders
                }
            } else {
                const rfqRes = await fetch(`${BASE_URL}/rfqs`);
                if (rfqRes.ok) {
                    const rfqs = await rfqRes.json();
                    setRfqs(rfqs);
                    
                    // Update activeRfq if it matches the current one
                    if (activeRfq) {
                        const updatedActiveRfq = rfqs.find((r: any) => r.name === activeRfq.name);
                        if (updatedActiveRfq) {
                            setActiveRfq(updatedActiveRfq);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Delete error:", err);
        } finally {
            setTimeout(() => setDeleting(null), 300);
        }
    };

    // --- Refresh when switching modes ---
    useEffect(() => {
        async function fetchData() {
            try {
                if (docMode === "rfqs") {
                    const res = await fetch(`${BASE_URL}/rfqs`);
                    if (res.ok) {
                        const rfqs = await res.json();
                        const normalized = rfqs.map((r: any) => ({
                            ...r,
                            documents: r.documents || [r.mainDocument, ...(r.supportingDocuments || [])].filter(Boolean),
                        }));
                        setRfqs(normalized);
                    }
                } else if (docMode === "database") {
                    const res = await fetch(`${BASE_URL}/database`);
                    if (res.ok) {
                        setDbFolders(await res.json());
                    }
                }
            } catch (err) {
                console.error("Failed to fetch documents:", err);
            }
        }
        if (docMode) fetchData();
    }, [docMode, setRfqs, setDbFolders]);

    return (
        <>
            {/* Indicators */}
            {uploading && (
                <div className="fixed top-4 right-4 bg-white dark:bg-slate-900 shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 z-50">
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </div>
            )}
            {replacing && (
                <div className="fixed top-4 right-4 bg-white dark:bg-slate-900 shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 z-50">
                    <Loader2 className="w-4 h-4 animate-spin" /> Replacing main document…
                </div>
            )}
            {deleting && (
                <div className="fixed top-4 right-4 bg-white dark:bg-slate-900 shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 z-50">
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting {deleting}…
                </div>
            )}

            {!docMode && (
                <div className="flex flex-1 items-center justify-center gap-8">
                    <button
                        onClick={() => setDocMode("rfqs")}
                        className="flex-1 h-64 flex flex-col items-center justify-center gap-3 text-2xl font-semibold rounded-3xl bg-slate-100 dark:bg-slate-800 hover:scale-[1.02] transition"
                    >
                        <FileText className="w-10 h-10" /> RFQs
                    </button>
                    <button
                        onClick={() => setDocMode("database")}
                        className="flex-1 h-64 flex flex-col items-center justify-center gap-3 text-2xl font-semibold rounded-3xl bg-slate-100 dark:bg-slate-800 hover:scale-[1.02] transition"
                    >
                        <FolderOpen className="w-10 h-10" /> Database
                    </button>
                </div>
            )}

            {/* RFQ List */}
            {docMode === "rfqs" && !activeRfq && (
                <Card>
                    <CardHeader
                        title="RFQs"
                        subtitle="All RFQ projects you are working on"
                        icon={<FileText className="w-4 h-4" />}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rfqs.map((rfq, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveRfq(rfq)}
                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-left hover:border-slate-400"
                            >
                                <h3 className="font-semibold">{rfq.name}</h3>
                                <p className="text-sm text-slate-500">
                                    {rfq.client} • Due {rfq.dueDate}
                                </p>
                            </button>
                        ))}
                        <button
                            onClick={() => setShowNewRFQ(true)}
                            className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-2"
                        >
                            <FileText className="w-5 h-5" /> ➕ New RFQ
                        </button>
                    </div>
                </Card>
            )}

            {/* RFQ Detail */}
            {docMode === "rfqs" && activeRfq && (
                <Card>
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => setActiveRfq(null)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>

                        <button
                            onClick={() => setShowDeleteRFQ(true)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                            <Trash2 className="w-4 h-4" /> Delete RFQ
                        </button>
                    </div>

                    <CardHeader
                        title={activeRfq.name}
                        subtitle={`${activeRfq.client} • Due ${activeRfq.dueDate}`}
                        icon={<FileText className="w-4 h-4" />}
                    />

                    {/* Upload Supporting Docs */}
                    <div className="mb-4">
                        <input
                            ref={rfqUploadRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) =>
                                handleUploadSupportingDocs(
                                    activeRfq.name,
                                    (e.target as HTMLInputElement).files
                                )
                            }
                        />
                        <button
                            onClick={() => rfqUploadRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <Upload className="w-4 h-4" /> Upload Supporting Documents
                        </button>
                    </div>

                    {/* Main RFQ Document */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-4">
                        <div className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800">
                            Main RFQ Document
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                            {activeRfq.mainDocument ? (
                                <li className="px-3 py-2 text-sm flex items-center gap-2 group">
                                    <Paperclip className="w-3 h-3" /> {activeRfq.mainDocument}
                                    <div className="ml-auto flex gap-3 opacity-0 group-hover:opacity-100 transition">
                                        <button
                                            onClick={() => setViewFile(activeRfq.mainDocument)}
                                            className="text-slate-500 hover:text-blue-600"
                                            title="View"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>

                                        <a
                                            href={`${BASE_URL}/download/${encodeURIComponent(activeRfq.mainDocument)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-500 hover:text-green-600"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>

                                        <label
                                            className="cursor-pointer flex items-center gap-1 text-slate-500 hover:text-yellow-600 text-xs"
                                            title="Replace Main Document"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span>Replace</span>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleReplaceMainDoc(activeRfq.name, e.target.files[0]);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </li>
                            ) : (
                                <li className="px-3 py-3 text-sm text-slate-500">No main RFQ document uploaded.</li>
                            )}
                        </ul>
                    </div>

                    {/* Supporting Documents */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800">
                            Supporting Documents
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                            {(activeRfq.supportingDocuments || []).length === 0 && (
                                <li className="px-3 py-3 text-sm text-slate-500">No supporting documents uploaded.</li>
                            )}
                            {(activeRfq.supportingDocuments || []).map((doc, i) => (
                                <li key={i} className="px-3 py-2 text-sm flex items-center gap-2 group">
                                    <Paperclip className="w-3 h-3" /> {doc}
                                    <div className="ml-auto flex gap-3 opacity-0 group-hover:opacity-100 transition">
                                        <button
                                            onClick={() => setViewFile(doc)}
                                            className="text-slate-500 hover:text-blue-600"
                                            title="View"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>

                                        <a
                                            href={`${BASE_URL}/download/${encodeURIComponent(doc)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-500 hover:text-green-600"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>

                                        <button
                                            onClick={() =>
                                                handleDelete(safeCollectionName(`rfq_${activeRfq.name}`), doc)
                                            }
                                            className="text-slate-500 hover:text-red-600"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Card>
            )}

            {/* Database: Folder detail */}
            {docMode === "database" && activeFolder && (
                <Card>
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => setActiveFolder(null)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                    </div>
                    <CardHeader
                        title={activeFolder}
                        subtitle="Upload files into this folder"
                        icon={<FolderOpen className="w-4 h-4" />}
                    />

                    <input
                        ref={dbUploadRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) =>
                            handleUploadToFolder(activeFolder, (e.target as HTMLInputElement).files)
                        }
                    />
                    <button
                        onClick={() => dbUploadRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 mb-4"
                    >
                        <Upload className="w-4 h-4" /> Upload Files
                    </button>

                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {dbFolders.find((f) => f.name === activeFolder)?.files.map((file, idx) => (
                            <li key={idx} className="px-3 py-2 text-sm flex items-center gap-2 group">
                                <Paperclip className="w-3 h-3" /> {file.name}
                                <div className="ml-auto flex gap-3 opacity-0 group-hover:opacity-100 transition">
                                    <a
                                        href={`${BASE_URL}/download/${encodeURIComponent(file.name)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-slate-500 hover:text-green-600"
                                        title="Download"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>

                                    <button
                                        onClick={() =>
                                            handleDelete(safeCollectionName(`db_${activeFolder}`), file.name)
                                        }
                                        className="text-slate-500 hover:text-red-600"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {/* Database: Folders */}
            {docMode === "database" && !activeFolder && (
                <Card>
                    <CardHeader
                        title="Database"
                        subtitle="Click a folder to view & upload files"
                        icon={<FolderOpen className="w-4 h-4" />}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {dbFolders.map((folder: DBFolder) => (
                            <button
                                key={folder.name}
                                onClick={() => setActiveFolder(folder.name)}
                                className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 hover:border-slate-400"
                            >
                                <div className="font-semibold">{folder.name}</div>
                                <div className="text-xs text-slate-500">{folder.files.length} file(s)</div>
                            </button>
                        ))}
                        <button
                            onClick={() => setShowNewFolder(true)}
                            className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-2"
                        >
                            <FolderOpen className="w-5 h-5" /> ➕ New Folder
                        </button>
                    </div>
                </Card>
            )}

            {/* Delete RFQ Modal */}
            {showDeleteRFQ && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-lg font-semibold mb-4 text-red-600">Delete RFQ</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            Are you sure you want to delete <strong>{activeRfq?.name}</strong> and all its
                            documents? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowDeleteRFQ(false)}
                                className="px-4 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!activeRfq) return;
                                    setDeleting(activeRfq.name);
                                    await fetch(`${BASE_URL}/delete_rfq`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ name: activeRfq.name }),
                                    });
                                    setTimeout(() => setDeleting(null), 300);
                                    setShowDeleteRFQ(false);
                                    setActiveRfq(null);
                                    const res = await fetch(`${BASE_URL}/rfqs`);
                                    if (res.ok) {
                                        const rfqs = await res.json();
                                        setRfqs(rfqs);
                                        // No need to update activeRfq since it's set to null above
                                    }
                                }}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Viewer Modal */}
            {viewFile && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-4xl h-[80%] flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-sm font-semibold">{viewFile}</h2>
                            <button
                                onClick={() => setViewFile(null)}
                                className="text-red-500 hover:text-red-700 text-xs"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <iframe
                                src={`${BASE_URL}/view/${encodeURIComponent(viewFile)}`}
                                className="w-full h-full border rounded"
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}

            {/* New Folder Modal */}
            {showNewFolder && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-lg font-semibold mb-4">New Database Folder</h2>
                        <label className="block text-sm mb-4">
                            <span className="text-slate-600 dark:text-slate-300">Folder Name</span>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                                className="mt-1 w-full px-3 py-2 border rounded-lg bg-transparent"
                                placeholder="e.g., Contracts, Compliance, etc."
                                autoFocus
                            />
                        </label>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowNewFolder(false);
                                    setNewFolderName("");
                                }}
                                className="px-4 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim()}
                                className={`px-4 py-2 rounded-lg ${newFolderName.trim()
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                        : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                                    }`}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New RFQ Modal */}
            {showNewRFQ && (
                <NewRFQModal
                    onClose={() => setShowNewRFQ(false)}
                    onSave={async () => {
                        const res = await fetch(`${BASE_URL}/rfqs`);
                        if (res.ok) setRfqs(await res.json());
                        setShowNewRFQ(false);
                    }}
                />
            )}
        </>
    );
}

function NewRFQModal({
    onClose,
    onSave,
}: {
    onClose: () => void;
    onSave: () => void;
}) {
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportingDocs, setSupportingDocs] = useState<File[]>([]);
    const [name, setName] = useState("");
    const [client, setClient] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleMainDocUpload = async (file: File) => {
        setMainDoc(file);
        setLoading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${BASE_URL}/extract_rfq_metadata`, {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setName(data.metadata?.name || "");
                setClient(data.metadata?.client || "");
                setDueDate(data.metadata?.dueDate || "");
                setShowConfirm(true);
                console.log("Extracted RFQ metadata:", data.metadata);
            } else {
                console.error("Metadata extraction failed:", await res.text());
            }
        } catch (err) {
            console.error("Metadata extraction error:", err);
        } finally {
            setLoading(false);
        }
    };

    const canSave = !!mainDoc && name.trim().length > 0;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg">
                <h2 className="text-lg font-semibold mb-4">New RFQ</h2>

                {/* Main RFQ Upload */}
                <label className="block text-sm mb-3">
                    <span className="text-slate-600 dark:text-slate-300">Main RFQ Document *</span>
                    <div className="mt-2">
                        <input
                            id="mainDocInput"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleMainDocUpload(e.target.files[0]);
                                }
                            }}
                        />
                        <button
                            onClick={() => document.getElementById("mainDocInput")?.click()}
                            className="px-3 py-2 rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
                        >
                            Upload Main RFQ
                        </button>
                        {mainDoc && (
                            <span className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                                {mainDoc.name}
                            </span>
                        )}
                    </div>
                </label>

                {/* Supporting Docs Upload */}
                <label className="block text-sm mb-3">
                    <span className="text-slate-600 dark:text-slate-300">Supporting Documents (optional)</span>
                    <div className="mt-2">
                        <input
                            id="supportingDocsInput"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => setSupportingDocs(Array.from(e.target.files || []))}
                        />
                        <button
                            onClick={() => document.getElementById("supportingDocsInput")?.click()}
                            className="px-3 py-2 rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
                        >
                            Upload Supporting Docs
                        </button>
                        {supportingDocs.length > 0 && (
                            <span className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                                {supportingDocs.length} file(s) selected
                            </span>
                        )}
                    </div>
                </label>

                {/* Confirmation Popup */}
                {showConfirm && (
                    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800 mb-4">
                        <h3 className="font-medium mb-2 text-slate-700 dark:text-slate-200">
                            Confirm Extracted Metadata
                        </h3>
                        <label className="block text-sm mb-2">
                            <span className="text-slate-600 dark:text-slate-300">RFQ Name *</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 w-full px-3 py-2 border rounded-lg bg-transparent"
                            />
                        </label>
                        <label className="block text-sm mb-2">
                            <span className="text-slate-600 dark:text-slate-300">Client</span>
                            <input
                                type="text"
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                className="mt-1 w-full px-3 py-2 border rounded-lg bg-transparent"
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Due Date</span>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="mt-1 w-full px-3 py-2 border rounded-lg bg-transparent"
                            />
                        </label>
                    </div>
                )}

                {loading && <p className="text-sm text-slate-500 mb-3">Extracting metadata…</p>}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!canSave}
                        onClick={async () => {
                            if (!canSave || !mainDoc) return;

                            const payload = {
                                name,
                                client,
                                dueDate,
                                mainDocument: mainDoc.name,
                                supportingDocuments: supportingDocs.map((d) => d.name),
                            };

                            try {
                                const res = await fetch(`${BASE_URL}/save_rfq`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(payload),
                                });
                                if (res.ok) {
                                    await onSave();
                                } else {
                                    console.error("Save RFQ failed:", await res.text());
                                }
                            } catch (err) {
                                console.error("Failed to save RFQ:", err);
                            }
                        }}
                        className={`px-4 py-2 rounded-lg ${canSave
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                            }`}
                    >
                        Save RFQ
                    </button>
                </div>
            </div>
        </div>
    );
}
