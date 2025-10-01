import React from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, Printer } from 'lucide-react';
import { Card, CardHeader } from './Atoms';

interface GeneratedSection {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  hasTablePlaceholder: boolean;
  hasImagePlaceholder: boolean;
  tablePlaceholders: string[];
  imagePlaceholders: string[];
  wordCount: number;
}

interface DocumentViewerProps {
  rfqName: string;
  templateName: string;
  sections: GeneratedSection[];
  onDownload: (format: 'pdf' | 'docx') => void;
}

export default function DocumentViewer({
  rfqName,
  templateName,
  sections,
  onDownload
}: DocumentViewerProps) {
  // Calculate document statistics
  const stats = {
    totalSections: sections.length,
    totalWords: sections.reduce((sum, s) => sum + s.wordCount, 0),
    totalPages: Math.ceil(sections.reduce((sum, s) => sum + s.wordCount, 0) / 250), // ~250 words per page
    tablesCount: sections.reduce((sum, s) => sum + s.tablePlaceholders.length, 0),
    imagesCount: sections.reduce((sum, s) => sum + s.imagePlaceholders.length, 0)
  };

  const completedSections = sections.filter(s => s.status === 'completed');
  const hasContent = completedSections.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          📄 Document Preview
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Review your generated proposal and download in your preferred format
        </p>
      </motion.div>

      {/* Document Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              Document Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalSections}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Sections</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                <div className="text-xl font-bold text-green-900 dark:text-green-100">
                  {stats.totalWords.toLocaleString()}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300">Words</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.totalPages}
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300">Est. Pages</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
                  {stats.tablesCount}
                </div>
                <div className="text-xs text-orange-700 dark:text-orange-300">Table Placeholders</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                <div className="text-xl font-bold text-red-900 dark:text-red-100">
                  {stats.imagesCount}
                </div>
                <div className="text-xs text-red-700 dark:text-red-300">Image Placeholders</div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-center gap-4 flex-wrap"
      >
        <button
          onClick={() => onDownload('pdf')}
          className="flex items-center gap-3 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          <Download className="w-5 h-5" />
          Download PDF
        </button>

        <button
          onClick={() => onDownload('docx')}
          className="flex items-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Download className="w-5 h-5" />
          Download DOCX
        </button>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-3 bg-slate-600 text-white px-6 py-3 rounded-lg hover:bg-slate-700 transition-colors font-medium"
        >
          <Printer className="w-5 h-5" />
          Print Page
        </button>
      </motion.div>

      {/* Document Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden"
      >
        <div className="bg-slate-100 dark:bg-slate-700 px-6 py-4 border-b border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Document Preview
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <FileText className="w-4 h-4" />
              <span>Proposal for {rfqName}</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {hasContent ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  📄 Document Ready for Download
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Your proposal has been generated with {completedSections.length} section{completedSections.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Section Summary */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">
                  Generated Sections
                </h4>
                <div className="space-y-2">
                  {completedSections.map((section, index) => (
                    <div key={section.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-green-700 dark:text-green-200">
                            {index + 1}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {section.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {section.wordCount} words
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actual Document Content Preview */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-h-96 overflow-y-auto">
                <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4 sticky top-0 bg-white dark:bg-slate-800 pb-2 border-b border-slate-200 dark:border-slate-600">
                  📄 Document Content Preview
                </h4>
                <div className="space-y-6">
                  {/* Document Header */}
                  <div className="text-center border-b border-slate-200 dark:border-slate-600 pb-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                      Proposal for {rfqName}
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Generated using {templateName} template
                    </p>
                  </div>

                  {/* Section Content */}
                  {completedSections.map((section, index) => (
                    <div key={section.id} className="space-y-3">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600 pb-1">
                        {section.title}
                      </h2>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {section.content.length > 500
                            ? `${section.content.substring(0, 500)}...`
                            : section.content
                          }
                        </div>
                        {section.content.length > 500 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                            Content truncated for preview. Full content available in downloaded document.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Ready to Download
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      Use the download buttons above to get your proposal in PDF or DOCX format.
                      The PDF option will open a print dialog where you can save as PDF.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
                No Content Available
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-500">
                Complete content generation to download your proposal
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}