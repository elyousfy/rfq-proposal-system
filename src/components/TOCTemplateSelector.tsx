import React, { useState, useEffect } from 'react';
import { FileText, Upload, ChevronDown, Eye, Plus, Loader } from 'lucide-react';

const BASE_URL = "http://localhost:8000";

interface TOCTemplate {
  id: string;
  name: string;
  section_tree: Array<{
    title: string;
    level: number;
    order: number;
    parent: number | null;
  }>;
  source_file: string;
  metadata: {
    total_sections: number;
    max_depth: number;
    created_at: string;
  };
  statistics?: {
    total_sections: number;
    total_subsections: number;
    total_words: number;
    hierarchy_depth: number;
  };
}

interface TOCTemplateSelectorProps {
  onApplyTemplate?: (templateId: string) => void;
}

export function TOCTemplateSelector({ onApplyTemplate }: TOCTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TOCTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/get_toc_templates`);
      if (response.ok) {
        const result = await response.json();
        // Extract templates array from the response object
        const templatesData = result.templates || [];

        // Ensure templatesData is an array
        if (Array.isArray(templatesData)) {
          setTemplates(templatesData);
        } else {
          console.warn('Templates data is not an array:', templatesData);
          setTemplates([]);
        }
      } else {
        console.error('Failed to load templates:', response.status, response.statusText);
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading TOC templates:', error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is DOCX
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Please upload a DOCX file. Only Word documents with heading styles are supported.');
      event.target.value = '';
      return;
    }

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('files', file);

    try {
      // First upload the file
      const uploadResponse = await fetch(`${BASE_URL}/ingest`, {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        // Then extract TOC
        const extractResponse = await fetch(`${BASE_URL}/extract_toc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            template_name: ""
          }),
        });

        if (extractResponse.ok) {
          const result = await extractResponse.json();
          console.log('TOC extraction result:', result);

          if (result.status === 'success') {
            // Reload templates to include the new one
            await loadTemplates();
            setShowUpload(false);
            alert(`TOC template created successfully: ${result.template.template_name}`);
          } else {
            alert(`Failed to extract TOC: ${result.message}`);
          }
        } else {
          alert('Failed to extract TOC from uploaded file');
        }
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error processing file. Please try again.');
    } finally {
      setUploadLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !onApplyTemplate) return;

    try {
      onApplyTemplate(selectedTemplate);
    } catch (error) {
      console.error('Error applying template:', error);
    }
  };

  const handlePreviewTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/get_toc_preview/${templateId}`);
      if (response.ok) {
        const result = await response.json();
        // Extract preview text from the response object
        const previewText = result.preview || 'No preview available';
        setPreview(previewText);
        setShowPreview(true);
      } else {
        console.error('Failed to load preview:', response.status, response.statusText);
        setPreview('Failed to load preview');
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          TOC Templates
        </h4>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Template
        </button>
      </div>

      {/* File Upload Section */}
      {showUpload && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Upload DOCX Template
          </div>
          <div className="relative">
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".docx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploadLoading}
            />
            <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
              {uploadLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {uploadLoading ? 'Extracting TOC...' : 'Choose DOCX file with heading styles'}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Upload a Word document that uses Heading 1, 2, 3... styles for structure
          </div>
        </div>
      )}

      {/* Template Selection */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader className="w-4 h-4 animate-spin" />
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">
            No templates available yet.
            <br />
            Upload a DOCX document to create your first template.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="appearance-none w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a TOC template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.statistics?.total_sections || template.metadata?.total_sections || template.sections?.length || 0} sections{template.statistics?.total_subsections ? `, ${template.statistics.total_subsections} subsections` : ''})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-slate-500 pointer-events-none" />
            </div>

            {selectedTemplate && (
              <div className="flex gap-2">
                <button
                  onClick={handleApplyTemplate}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Apply Template
                </button>
                <button
                  onClick={() => handlePreviewTemplate(selectedTemplate)}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Template Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                {preview}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          How TOC Templates Work
        </div>
        <ul className="text-xs text-slate-500 space-y-1">
          <li>• Upload DOCX files that use Heading 1, 2, 3... styles</li>
          <li>• System extracts the heading structure automatically</li>
          <li>• Apply templates to create proposal sections with the same structure</li>
          <li>• No AI processing - direct extraction from document styles</li>
        </ul>
      </div>
    </div>
  );
}