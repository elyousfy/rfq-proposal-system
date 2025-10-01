import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Eye, Plus, CheckCircle, X, Layout, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '../components/Atoms';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: string[];
  detailed_sections?: Array<{
    title: string;
    level: number;
    subsections?: Array<{
      title: string;
      level: number;
      subsections?: any[];
    }>;
  }>;
  preview?: string;
  statistics?: {
    total_sections: number;
    total_subsections: number;
    total_words: number;
    hierarchy_depth: number;
  };
}

interface TemplateSelectionPageProps {
  templates: Template[];
  selectedTemplate: string | null;
  onTemplateSelect: (templateId: string) => void;
  onTemplateUpload: (files: FileList) => void;
  onTemplateDelete?: (templateId: string) => void;
  canProceed: boolean;
}

const SAMPLE_TEMPLATES: Template[] = [
  {
    id: 'technical-services',
    name: 'Technical Services Proposal',
    description: 'Standard template for IT and technical consulting services with technical diagrams and team tables',
    category: 'Technical',
    sections: ['Executive Summary', 'Technical Approach', 'Team & Experience', 'Project Timeline', 'Budget', 'Terms & Conditions'],
    detailed_sections: [
      {
        title: 'Executive Summary',
        level: 1,
        subsections: [
          { title: 'Project Overview', level: 2 },
          { title: 'Key Benefits', level: 2 },
          { title: 'Investment Summary', level: 2 }
        ]
      },
      {
        title: 'Technical Approach',
        level: 1,
        subsections: [
          { title: 'Solution Architecture', level: 2 },
          { title: 'Technology Stack', level: 2 },
          { title: 'Implementation Methodology', level: 2 }
        ]
      },
      {
        title: 'Team & Experience',
        level: 1,
        subsections: [
          { title: 'Team Structure', level: 2 },
          { title: 'Key Personnel', level: 2 },
          { title: 'Relevant Experience', level: 2 }
        ]
      },
      { title: 'Project Timeline', level: 1 },
      { title: 'Budget', level: 1 },
      { title: 'Terms & Conditions', level: 1 }
    ],
    statistics: {
      total_sections: 6,
      total_subsections: 9,
      total_words: 5000,
      hierarchy_depth: 2
    },
    preview: 'Includes technical methodology sections, team capability tables, and timeline charts. Perfect for IT consulting and development proposals.'
  },
  {
    id: 'consulting',
    name: 'Business Consulting',
    description: 'Management consulting template with strategic frameworks and ROI tables',
    category: 'Consulting',
    sections: ['Executive Summary', 'Understanding Requirements', 'Proposed Solution', 'Implementation Plan', 'Team', 'Investment'],
    detailed_sections: [
      {
        title: 'Executive Summary',
        level: 1,
        subsections: [
          { title: 'Situation Analysis', level: 2 },
          { title: 'Recommended Approach', level: 2 }
        ]
      },
      {
        title: 'Understanding Requirements',
        level: 1,
        subsections: [
          { title: 'Current State', level: 2 },
          { title: 'Challenges', level: 2 },
          { title: 'Desired Outcomes', level: 2 }
        ]
      },
      {
        title: 'Proposed Solution',
        level: 1,
        subsections: [
          { title: 'Strategic Framework', level: 2 },
          { title: 'Key Initiatives', level: 2 }
        ]
      },
      { title: 'Implementation Plan', level: 1 },
      { title: 'Team', level: 1 },
      { title: 'Investment', level: 1 }
    ],
    statistics: {
      total_sections: 6,
      total_subsections: 7,
      total_words: 4500,
      hierarchy_depth: 2
    },
    preview: 'Features business case tables, implementation timelines, and team qualification matrices. Ideal for management and strategy consulting.'
  },
  {
    id: 'software-dev',
    name: 'Software Development',
    description: 'Development template with architecture diagrams and feature tables',
    category: 'Technical',
    sections: ['Project Overview', 'Technical Specifications', 'Development Methodology', 'Deliverables', 'Quality Assurance', 'Support & Maintenance'],
    detailed_sections: [
      {
        title: 'Project Overview',
        level: 1,
        subsections: [
          { title: 'Project Scope', level: 2 },
          { title: 'Objectives', level: 2 }
        ]
      },
      {
        title: 'Technical Specifications',
        level: 1,
        subsections: [
          { title: 'System Architecture', level: 2 },
          { title: 'Database Design', level: 2 },
          { title: 'API Specifications', level: 2 },
          { title: 'Security Requirements', level: 2 }
        ]
      },
      {
        title: 'Development Methodology',
        level: 1,
        subsections: [
          { title: 'Agile Approach', level: 2 },
          { title: 'Sprint Planning', level: 2 }
        ]
      },
      { title: 'Deliverables', level: 1 },
      { title: 'Quality Assurance', level: 1 },
      { title: 'Support & Maintenance', level: 1 }
    ],
    statistics: {
      total_sections: 6,
      total_subsections: 8,
      total_words: 6000,
      hierarchy_depth: 2
    },
    preview: 'Includes system architecture diagrams, feature comparison tables, and testing matrices. Perfect for software development projects.'
  },
  {
    id: 'research',
    name: 'Research & Analysis',
    description: 'Research template with methodology charts and data visualization placeholders',
    category: 'Research',
    sections: ['Research Objectives', 'Methodology', 'Scope of Work', 'Timeline', 'Expected Outcomes', 'Budget'],
    preview: 'Contains research methodology flowcharts, data collection tables, and outcome visualization placeholders.'
  }
];

export default function TemplateSelectionPage({
  templates,
  selectedTemplate,
  onTemplateSelect,
  onTemplateUpload,
  onTemplateDelete,
  canProceed
}: TemplateSelectionPageProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge provided templates with sample templates for demo
  console.log('📋 TemplateSelectionPage templates:', templates.length, 'passed from parent');
  console.log('📋 SAMPLE_TEMPLATES:', SAMPLE_TEMPLATES.length, 'built-in templates');

  // Ensure all templates have the required structure
  const safeTemplates = templates.map((template, index) => ({
    id: template.id || `template-${index}`,
    name: template.name || 'Unnamed Template',
    description: template.description || 'No description',
    category: template.category || 'Other',
    sections: template.sections || ['Default Section'],
    detailed_sections: template.detailed_sections, // PRESERVE SUBSECTIONS!
    statistics: template.statistics, // PRESERVE STATS!
    preview: template.preview || 'No preview available'
  }));

  // Only add SAMPLE_TEMPLATES if no templates were passed from parent
  const allTemplates = templates.length === 0
    ? [...SAMPLE_TEMPLATES]
    : [...safeTemplates];
  console.log('📋 All templates combined:', allTemplates.length, 'total templates');
  const categories = ['all', ...new Set(allTemplates.map(t => t.category))];

  const filteredTemplates = selectedCategory === 'all'
    ? allTemplates
    : allTemplates.filter(t => t.category === selectedCategory);

  const selectedTemplateData = allTemplates.find(t => t.id === selectedTemplate);

  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      onTemplateUpload(files);
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
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold">
              ✓
            </div>
            <span className="ml-2 font-medium text-green-600">Select RFQ</span>
          </div>
          <div className="w-12 h-0.5 bg-green-300"></div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <span className="ml-2 font-medium text-blue-600">Choose Template</span>
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
          📋 Select a Proposal Template
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Choose a template that matches your proposal type. The AI will extract the table of contents structure,
          analyze content patterns, and identify where tables and images should be placed based on your template.
        </p>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What happens with your template:</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• TOC structure is extracted and analyzed</li>
            <li>• Content writing style is learned from examples</li>
            <li>• Table and image placement patterns are identified</li>
            <li>• Section requirements are matched against your RFQ</li>
          </ul>
        </div>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-md font-medium transition-all capitalize ${
                selectedCategory === category
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Upload Custom Template */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="mb-6">
          <div className="text-center p-6">
            <button
              onClick={() => setShowUploadDialog(true)}
              className="w-full p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all group"
            >
              <Plus className="w-10 h-10 mx-auto mb-3 text-slate-400 group-hover:text-blue-500" />
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Upload Custom Template
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Upload your own proposal template (.docx, .pdf, .txt)
              </div>
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Template Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Available Templates ({filteredTemplates.length})
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg relative ${
                  selectedTemplate === template.id
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="p-6" onClick={() => onTemplateSelect(template.id)}>
                  <div className="flex items-start justify-between mb-4">
                    <Layout className={`w-6 h-6 ${
                      selectedTemplate === template.id ? 'text-blue-600' : 'text-slate-400'
                    }`} />
                    <div className="flex items-center gap-2">
                      {/* Delete button for custom templates */}
                      {template.category === 'Custom' && onTemplateDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
                              onTemplateDelete(template.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                          title="Delete custom template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {selectedTemplate === template.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      selectedTemplate === template.id
                        ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {template.category}
                    </span>
                  </div>

                  <h5 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    {template.name}
                  </h5>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {template.description}
                  </p>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {console.log(`🔍 Template "${template.name}" stats:`, template.statistics, 'detailed_sections:', template.detailed_sections?.length)}
                    {template.statistics?.total_sections || template.sections?.length || 0} sections
                    {template.statistics?.total_subsections ? `, ${template.statistics.total_subsections} subsections` : ''}
                  </div>
                </div>

                {/* Preview Button */}
                <div className="px-4 pb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTemplate(template);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Structure
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Selected Template Summary */}
      {selectedTemplateData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
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
                  <Layout className="w-6 h-6 text-white" />
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-bold text-green-900 dark:text-green-100 text-lg">
                      ✅ Template Selected
                    </h5>
                  </div>
                  <p className="text-green-800 dark:text-green-200 font-medium mb-3">
                    {selectedTemplateData.name}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                    {selectedTemplateData.description}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">Category:</span>
                      <div className="text-green-600 dark:text-green-400">
                        {selectedTemplateData.category}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">Sections:</span>
                      <div className="text-green-600 dark:text-green-400">
                        {selectedTemplateData.statistics?.total_sections || selectedTemplateData.sections.length} sections
                        {selectedTemplateData.statistics?.total_subsections ? `, ${selectedTemplateData.statistics.total_subsections} subsections` : ''}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">Next Step:</span>
                      <div className="text-green-600 dark:text-green-400">
                        AI will analyze TOC structure
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Upload Dialog */}
      <AnimatePresence>
        {showUploadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowUploadDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Upload Template
                </h3>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                  Drop your template file here, or click to browse
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
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center">
                Supported formats: PDF, Word (.docx), Text (.txt)
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Preview Dialog */}
      <AnimatePresence>
        {previewTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewTemplate(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {previewTemplate.name}
                </h3>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="mb-4">
                  <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200 rounded-full">
                    {previewTemplate.category}
                  </span>
                </div>

                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  {previewTemplate.description}
                </p>

                {previewTemplate.preview && (
                  <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Preview</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {previewTemplate.preview}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">
                    Template Structure ({previewTemplate.statistics?.total_sections || previewTemplate.sections.length} sections{previewTemplate.statistics?.total_subsections ? `, ${previewTemplate.statistics.total_subsections} subsections` : ''})
                  </h4>
                  {/* DEBUG: Log what we have */}
                  {console.log('🔍 Preview Debug:', {
                    hasDetailedSections: !!previewTemplate.detailed_sections,
                    detailedSectionsLength: previewTemplate.detailed_sections?.length,
                    detailedSections: previewTemplate.detailed_sections,
                    sections: previewTemplate.sections
                  })}
                  <div className="space-y-2">
                    {previewTemplate.detailed_sections && previewTemplate.detailed_sections.length > 0 ? (
                      // Show hierarchical structure if available
                      <>
                        {console.log('✅ Using detailed_sections for preview')}
                        {previewTemplate.detailed_sections.map((section, index) => {
                          console.log(`📋 Section ${index}:`, section.title, 'subsections:', section.subsections?.length || 0);
                          return (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                                  {index + 1}
                                </span>
                                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                                  {section.title}
                                </span>
                              </div>
                              {section.subsections && section.subsections.length > 0 && (
                                <div className="ml-12 space-y-2">
                                  {console.log(`  📄 Rendering ${section.subsections.length} subsections`)}
                                  {section.subsections.map((subsection, subIndex) => (
                                    <div
                                      key={subIndex}
                                      className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"
                                    >
                                      <span className="w-6 h-6 bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">
                                        {index + 1}.{subIndex + 1}
                                      </span>
                                      <span className="text-slate-700 dark:text-slate-300 text-sm">
                                        {subsection.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                    ) : (
                      <>
                        {console.log('⚠️ Using fallback flat sections')}
                        {previewTemplate.sections.map((section, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <span className="text-slate-900 dark:text-slate-100 font-medium">
                            {section}
                          </span>
                        </div>
                      ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                <button
                  onClick={() => {
                    onTemplateSelect(previewTemplate.id);
                    setPreviewTemplate(null);
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Use This Template
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}