import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, Calendar, User, Eye, Trash2, Search, Filter } from 'lucide-react';
import { Card, CardHeader } from '../components/Atoms';
import type { Proposal } from '../lib';
import { loadDemoData } from '../utils/demoData';

interface CompletedProposal {
  id: string;
  title: string;
  rfqName: string;
  client: string;
  createdAt: string;
  updatedAt: string;
  sectionsCount: number;
  wordCount: number;
  status: 'completed' | 'draft';
  templateUsed?: string;
}

interface CompletedProposalsPageProps {
  BASE_URL: string;
  onOpenProposal: (proposal: Proposal) => void;
}

export default function CompletedProposalsPage({
  BASE_URL,
  onOpenProposal
}: CompletedProposalsPageProps) {
  const [proposals, setProposals] = useState<CompletedProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'draft'>('all');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');

  // Load completed proposals from localStorage and backend
  useEffect(() => {
    loadCompletedProposals();
  }, []);

  const loadCompletedProposals = () => {
    setLoading(true);
    try {
      // Load demo data if no proposals exist
      loadDemoData();

      // Load from localStorage
      const savedProposals = localStorage.getItem('completed-proposals');
      if (savedProposals) {
        const parsed = JSON.parse(savedProposals);
        setProposals(parsed);
      }
    } catch (error) {
      console.error('Failed to load completed proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save a proposal to the completed proposals list
  const saveCompletedProposal = (proposal: Proposal) => {
    const completedProposal: CompletedProposal = {
      id: proposal.id,
      title: proposal.title,
      rfqName: proposal.rfqName,
      client: proposal.variables?.find(v => v.key === 'client_name')?.value || 'Unknown Client',
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      sectionsCount: proposal.sections.length,
      wordCount: proposal.sections.reduce((total, section) => {
        const content = section.contentMd || '';
        if (!content.trim()) return total;
        return total + content.trim().split(/\s+/).length;
      }, 0),
      status: 'completed',
      templateUsed: 'Custom'
    };

    try {
      const existingProposals = localStorage.getItem('completed-proposals');
      const proposals = existingProposals ? JSON.parse(existingProposals) : [];

      // Check if proposal already exists and update it
      const existingIndex = proposals.findIndex((p: CompletedProposal) => p.id === completedProposal.id);
      if (existingIndex >= 0) {
        proposals[existingIndex] = completedProposal;
      } else {
        proposals.unshift(completedProposal); // Add to beginning
      }

      localStorage.setItem('completed-proposals', JSON.stringify(proposals));

      // Also save the full proposal data for later retrieval
      localStorage.setItem(`proposal-${proposal.id}`, JSON.stringify(proposal));

      setProposals(proposals);
    } catch (error) {
      console.error('Failed to save completed proposal:', error);
    }
  };

  // Download proposal in specified format
  const handleDownload = async (proposalId: string, format: 'pdf' | 'docx') => {
    setIsDownloading(proposalId);
    setDownloadMessage(`Generating ${format.toUpperCase()}...`);

    try {
      // Load the full proposal data
      const proposalData = localStorage.getItem(`proposal-${proposalId}`);
      if (!proposalData) {
        throw new Error('Proposal data not found');
      }

      const proposal: Proposal = JSON.parse(proposalData);

      // Prepare data for backend
      const exportData = {
        title: proposal.title,
        rfqName: proposal.rfqName,
        sections: proposal.sections.map(section => ({
          id: section.id,
          title: section.title,
          content: section.contentMd || '',
          level: section.level || 1
        })),
        updatedAt: proposal.updatedAt
      };

      if (format === 'pdf') {
        setDownloadMessage('Generating PDF...');

        const response = await fetch(`${BASE_URL}/export_proposal/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportData)
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || 'Failed to generate PDF');
        }

        // Open print dialog in new window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };
          setDownloadMessage('PDF print dialog opened - use "Save as PDF" option');
        } else {
          throw new Error('Popup blocked - please allow popups for this site');
        }

      } else if (format === 'docx') {
        setDownloadMessage('Generating DOCX...');

        const response = await fetch(`${BASE_URL}/export_proposal/docx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportData)
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || 'Failed to generate DOCX');
        }

        // Convert to RTF and download
        const rtfContent = convertToRTF(result.content, proposal.title);
        const blob = new Blob([rtfContent], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${proposal.title.replace(/\s+/g, '_')}.rtf`;
        link.click();
        URL.revokeObjectURL(url);

        setDownloadMessage('RTF file downloaded - open in Word and save as DOCX');
      }

    } catch (error) {
      console.error('Download failed:', error);
      setDownloadMessage(`Download failed: ${error.message}`);
    } finally {
      setIsDownloading(null);

      // Clear message after 5 seconds
      setTimeout(() => {
        setDownloadMessage('');
      }, 5000);
    }
  };

  // Convert text content to RTF format
  const convertToRTF = (textContent: string, title: string) => {
    let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
    rtf += `\\f0\\fs28\\b ${title}\\b0\\par\\par`;

    const lines = textContent.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        rtf += '\\par';
        continue;
      }
      if (trimmedLine.includes('====')) {
        continue;
      }
      if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
        rtf += `\\fs20\\b ${trimmedLine}\\b0\\par\\par`;
        continue;
      }
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('  •')) {
        rtf += `\\tab ${trimmedLine}\\par`;
        continue;
      }
      if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
        rtf += `\\i ${trimmedLine}\\i0\\par`;
        continue;
      }
      rtf += `${trimmedLine}\\par`;
    }
    rtf += '}';
    return rtf;
  };

  // Open proposal in the editor
  const handleOpenProposal = (proposalId: string) => {
    try {
      const proposalData = localStorage.getItem(`proposal-${proposalId}`);
      if (!proposalData) {
        alert('Proposal data not found');
        return;
      }

      const proposal: Proposal = JSON.parse(proposalData);
      onOpenProposal(proposal);
    } catch (error) {
      console.error('Failed to open proposal:', error);
      alert('Failed to open proposal');
    }
  };

  // Delete proposal
  const handleDelete = (proposalId: string) => {
    if (!confirm('Are you sure you want to delete this proposal? This action cannot be undone.')) {
      return;
    }

    try {
      // Remove from completed proposals list
      const updatedProposals = proposals.filter(p => p.id !== proposalId);
      setProposals(updatedProposals);
      localStorage.setItem('completed-proposals', JSON.stringify(updatedProposals));

      // Remove full proposal data
      localStorage.removeItem(`proposal-${proposalId}`);
    } catch (error) {
      console.error('Failed to delete proposal:', error);
      alert('Failed to delete proposal');
    }
  };

  // Filter proposals based on search and status
  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         proposal.rfqName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         proposal.client.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || proposal.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Expose the save function globally so other components can use it
  useEffect(() => {
    (window as any).saveCompletedProposal = saveCompletedProposal;
    return () => {
      delete (window as any).saveCompletedProposal;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          📁 Completed Proposals
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Access and download your previously generated proposals
        </p>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400 w-4 h-4" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'completed' | 'draft')}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </motion.div>

      {/* Download Status Message */}
      {downloadMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center"
        >
          <div className="text-blue-900 dark:text-blue-100 font-medium">
            {downloadMessage}
          </div>
        </motion.div>
      )}

      {/* Proposals List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div className="mt-2 text-slate-600 dark:text-slate-400">Loading proposals...</div>
          </div>
        ) : filteredProposals.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                {proposals.length === 0 ? 'No Completed Proposals' : 'No Matching Proposals'}
              </h3>
              <p className="text-slate-500 dark:text-slate-500">
                {proposals.length === 0
                  ? 'Complete proposals using the Proposal Wizard to see them here.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
            </CardHeader>
          </Card>
        ) : (
          filteredProposals.map((proposal, index) => (
            <motion.div
              key={proposal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {proposal.title}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          proposal.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                        }`}>
                          {proposal.status === 'completed' ? 'Completed' : 'Draft'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>RFQ: {proposal.rfqName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>Client: {proposal.client}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Updated: {new Date(proposal.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-500">
                        <span>{proposal.sectionsCount} sections</span>
                        <span>{proposal.wordCount.toLocaleString()} words</span>
                        {proposal.templateUsed && <span>Template: {proposal.templateUsed}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleOpenProposal(proposal.id)}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 rounded-lg transition-colors"
                        title="Open in Editor"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => handleDownload(proposal.id, 'pdf')}
                        disabled={isDownloading === proposal.id}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 rounded-lg transition-colors disabled:opacity-50"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">PDF</span>
                      </button>

                      <button
                        onClick={() => handleDownload(proposal.id, 'docx')}
                        disabled={isDownloading === proposal.id}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 rounded-lg transition-colors disabled:opacity-50"
                        title="Download DOCX"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">DOCX</span>
                      </button>

                      <button
                        onClick={() => handleDelete(proposal.id)}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 rounded-lg transition-colors"
                        title="Delete Proposal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}