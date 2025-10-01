import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Calendar, Building, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '../components/Atoms';

interface RFQItem {
  name: string;
  client: string;
  dueDate: string;
  documents: string[];
}

interface RFQSelectionPageProps {
  rfqs: RFQItem[];
  selectedRFQ: string;
  onRFQSelect: (rfqName: string) => void;
  onRFQUpload: (files: FileList) => void;
  canProceed: boolean;
}

export default function RFQSelectionPage({
  rfqs,
  selectedRFQ,
  onRFQSelect,
  onRFQUpload,
  canProceed
}: RFQSelectionPageProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      onRFQUpload(files);
      setShowUploadDialog(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const selectedRFQData = rfqs.find(rfq => rfq.name === selectedRFQ);

  return (
    <div className="space-y-8">
      {/* Step Progress Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center mb-8"
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <span className="ml-2 font-medium text-blue-600">Select RFQ</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-300 dark:bg-slate-600"></div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <span className="ml-2 text-slate-500">Choose Template</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-300 dark:bg-slate-600"></div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <span className="ml-2 text-slate-500">Validate Structure</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-300 dark:bg-slate-600"></div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <span className="ml-2 text-slate-500">Generate</span>
          </div>
        </div>
      </motion.div>

      {/* Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center max-w-2xl mx-auto"
      >
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          🎯 Choose Your RFQ/RFP Document
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Select an existing RFQ from your library or upload a new one. This document will be analyzed
          to understand the requirements and generate a tailored proposal structure.
        </p>
      </motion.div>

      {/* Upload New RFQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="mb-6">
          <div className="text-center p-6">
            <button
              onClick={() => setShowUploadDialog(true)}
              className="w-full p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all group"
            >
              <Upload className="w-16 h-16 mx-auto mb-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
              <div className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                📄 Upload New RFQ/RFP
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Click to browse or drag and drop your RFQ/RFP documents
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Supports: PDF, DOC, DOCX, TXT
              </div>
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Existing RFQs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Available RFQs ({rfqs.length})
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rfqs.map((rfq, index) => (
            <motion.div
              key={rfq.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedRFQ === rfq.name
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className="p-6"
                  onClick={() => onRFQSelect(rfq.name)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <FileText className={`w-6 h-6 ${
                      selectedRFQ === rfq.name ? 'text-blue-600' : 'text-slate-400'
                    }`} />
                    {selectedRFQ === rfq.name && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center"
                      >
                        <ChevronRight className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </div>

                  <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2 line-clamp-2">
                    {rfq.name}
                  </h5>

                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      <span>{rfq.client || 'No client specified'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{rfq.dueDate || 'No due date'}</span>
                    </div>
                    <div className="text-xs">
                      {rfq.documents.length} document{rfq.documents.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Selected RFQ Details */}
      {selectedRFQData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-green-200 dark:border-green-800 shadow-lg">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg"
                >
                  <FileText className="w-6 h-6 text-white" />
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-bold text-green-900 dark:text-green-100 text-lg">
                      ✅ RFQ Selected
                    </h5>
                  </div>
                  <p className="text-green-800 dark:text-green-200 font-medium mb-3">
                    {selectedRFQData.name}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">Client:</span>
                      <div className="text-green-600 dark:text-green-400">
                        {selectedRFQData.client || 'Not specified'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">Due Date:</span>
                      <div className="text-green-600 dark:text-green-400">
                        {selectedRFQData.dueDate || 'Not specified'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">Documents:</span>
                      <div className="text-green-600 dark:text-green-400">
                        {selectedRFQData.documents.length} file{selectedRFQData.documents.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {selectedRFQData.documents.length > 0 && (
                    <div className="mt-4">
                      <details className="text-sm">
                        <summary className="font-medium text-green-700 dark:text-green-300 cursor-pointer">
                          View Documents
                        </summary>
                        <ul className="mt-2 space-y-1 text-green-600 dark:text-green-400">
                          {selectedRFQData.documents.map((doc, index) => (
                            <li key={index} className="truncate">• {doc}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowUploadDialog(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Upload RFQ/RFP Documents
            </h3>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                dragOver
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Drop your RFQ/RFP files here, or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Files
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowUploadDialog(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}