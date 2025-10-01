import React, { useState, useEffect } from 'react';
import { FileText, Settings, Eye, Wand2, Download } from 'lucide-react';
import ProposalWizard, { type WizardStep } from '../components/ProposalWizard';
import RFQSelectionPage from './RFQSelectionPage';
import TemplateSelectionPage from './TemplateSelectionPage';
import TOCValidationPage from './TOCValidationPage';
import ProposalGenerationPage from './ProposalGenerationPage';
import DocumentViewer from '../components/DocumentViewer';
// import { ProposalPage } from '../modules/Proposal'; // Not used in wizard
import type { RFQItem, Proposal, ProposalSection } from '../lib';

interface ProposalWizardPageProps {
  // Props from main App component
  rfqs: RFQItem[];
  onRfqUpload: (files: FileList) => void;
  onTemplateUpload: (files: FileList) => void;
  onProposalComplete: (proposal: Proposal) => void;
  BASE_URL: string;
}

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

interface TOCSection {
  id: string;
  title: string;
  level: number;
  content?: string;
  isOriginal: boolean;
  status: 'keep' | 'suggested_add' | 'suggested_remove' | 'modified';
  reason?: string;
  subsections?: TOCSection[];
}

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

export default function ProposalWizardPage({
  rfqs,
  onRfqUpload,
  onTemplateUpload,
  onProposalComplete,
  BASE_URL
}: ProposalWizardPageProps) {
  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Step 1: RFQ Selection
  const [selectedRFQ, setSelectedRFQ] = useState<string>('');

  // Predefined templates (same as in TemplateSelectionPage) - UPDATED WITH SUBSECTIONS
  const PREDEFINED_TEMPLATES: Template[] = [
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

  // Step 2: Template Selection (initialize with predefined templates)
  const [templates, setTemplates] = useState<Template[]>(PREDEFINED_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Step 3: TOC Validation
  const [tocSections, setTocSections] = useState<TOCSection[]>([]);
  const [extractedTOC, setExtractedTOC] = useState<TOCSection[]>([]);

  // Step 4: Proposal Generation
  const [generatedSections, setGeneratedSections] = useState<GeneratedSection[]>([]);

  // Step 5: Final Review
  const [finalProposal, setFinalProposal] = useState<Proposal | null>(null);

  // Load templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        console.log('🔄 Loading templates from backend...');
        const response = await fetch(`${BASE_URL}/get_toc_templates`);
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Backend templates response:', data);
          const backendTemplates = (data.templates || []).map((template: any) => ({
            id: template.id || template.name || `backend-${Date.now()}`,
            name: template.name || template.title || 'Unnamed Template',
            description: template.description || 'Backend template',
            category: template.category || 'Backend',
            sections: template.sections || template.toc || ['Default Section'],
            detailed_sections: template.detailed_sections, // PRESERVE hierarchical structure!
            statistics: template.statistics, // PRESERVE statistics!
            preview: template.preview || 'Template from backend system'
          }));
          console.log('📋 Setting templates:', backendTemplates.length, 'from backend');
          console.log('📋 First backend template:', backendTemplates[0]);
          console.log('📋 🔍 CRITICAL - detailed_sections:', backendTemplates[0]?.detailed_sections);
          console.log('📋 🔍 CRITICAL - statistics:', backendTemplates[0]?.statistics);

          // Merge predefined templates with backend templates, ensuring unique IDs
          const allBackendTemplates = backendTemplates.map((template, index) => ({
            ...template,
            id: template.id ? `backend-${template.id}` : `backend-${index}`
          }));

          console.log('🔍 PREDEFINED_TEMPLATES[0]:', PREDEFINED_TEMPLATES[0]);
          console.log('🔍 PREDEFINED has detailed_sections?', !!PREDEFINED_TEMPLATES[0]?.detailed_sections);
          console.log('🔍 PREDEFINED has statistics?', !!PREDEFINED_TEMPLATES[0]?.statistics);
          setTemplates([...PREDEFINED_TEMPLATES, ...allBackendTemplates]);
        } else {
          console.warn('⚠️ Failed to load backend templates:', response.status);
          setTemplates(PREDEFINED_TEMPLATES); // Keep predefined templates even if backend fails
        }
      } catch (error) {
        console.error('❌ Failed to load templates:', error);
        setTemplates(PREDEFINED_TEMPLATES); // Keep predefined templates even if backend fails
      }
    };
    loadTemplates();
  }, [BASE_URL]);

  // Extract TOC when template is selected
  useEffect(() => {
    const extractTOCFromTemplate = async () => {
      console.log('🔄 TOC extraction useEffect triggered:', { selectedTemplate, selectedRFQ });
      if (!selectedTemplate || !selectedRFQ) {
        console.log('⚠️ Missing template or RFQ, skipping extraction');
        return;
      }

      console.log('🔍 Starting TOC extraction for template:', selectedTemplate, 'RFQ:', selectedRFQ);
      console.log('🔍 Available templates:', templates.length, 'templates in array');
      console.log('🔍 Template IDs:', templates.map(t => t.id));

      // Check template type
      const isUploadedTemplate = selectedTemplate.startsWith('uploaded-');
      const isPredefinedTemplate = ['technical-services', 'consulting', 'software-dev', 'research'].includes(selectedTemplate);
      const isBackendTemplate = !isUploadedTemplate && !isPredefinedTemplate;

      console.log('🔍 Template type check:', {
        selectedTemplate,
        isUploadedTemplate,
        isPredefinedTemplate,
        isBackendTemplate
      });

      // Handle uploaded templates
      if (isUploadedTemplate) {
        console.log('📄 Taking UPLOADED template path for:', selectedTemplate);

        // For uploaded templates, create a basic TOC structure with AI suggestions
        const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
        console.log('📋 Selected template data for uploaded template:', selectedTemplateData);
        if (selectedTemplateData) {
          // Use detailed_sections if available (hierarchical), otherwise fall back to flat sections
          let originalSections: any[] = [];

          if (selectedTemplateData.detailed_sections && selectedTemplateData.detailed_sections.length > 0) {
            console.log('📝 Using detailed_sections (hierarchical):', selectedTemplateData.detailed_sections);
            // Convert hierarchical structure to TOCSection format
            originalSections = selectedTemplateData.detailed_sections.map((section: any, index: number) => {
              const mainSection: any = {
                title: section.title,
                level: section.level || 1,
                content: '',
                id: `uploaded-original-${index}`,
              };

              // Add subsections if they exist
              if (section.subsections && section.subsections.length > 0) {
                mainSection.subsections = section.subsections.map((subsection: any, subIndex: number) => ({
                  title: subsection.title,
                  level: subsection.level || 2,
                  content: '',
                  id: `uploaded-original-${index}-${subIndex}`,
                }));
              }

              return mainSection;
            });
          } else {
            console.log('📝 Using flat sections (fallback):', selectedTemplateData.sections);
            originalSections = selectedTemplateData.sections.map((sectionName: string, index: number) => ({
              title: sectionName,
              level: 1,
              content: '',
              id: `uploaded-original-${index}`,
            }));
          }

          console.log('📝 Created original sections:', originalSections);

          // Create some example AI suggestions based on common RFQ patterns
          const suggestedAdditions = [
            {
              title: 'Risk Management',
              level: 1,
              content: '',
              reason: 'Most RFPs require detailed risk assessment and mitigation strategies'
            },
            {
              title: 'Quality Assurance',
              level: 1,
              content: '',
              reason: 'Quality control measures are often required for professional services'
            },
            {
              title: 'Communication Plan',
              level: 1,
              content: '',
              reason: 'Stakeholder communication is typically a key requirement'
            }
          ];

          const tocWithSuggestions: TOCSection[] = [
            // Original sections from uploaded template
            ...originalSections.map((section: any, index: number) => ({
              id: `uploaded-original-${index}`,
              title: section.title,
              level: section.level || 1,
              content: section.content || '',
              isOriginal: true,
              status: 'keep' as const,
              subsections: section.subsections // IMPORTANT: Preserve subsections!
            })),
            // AI suggested additions
            ...suggestedAdditions.map((section: any, index: number) => ({
              id: `suggested-add-${index}`,
              title: section.title,
              level: section.level || 1,
              content: section.content || '',
              isOriginal: false,
              status: 'suggested_add' as const,
              reason: section.reason
            }))
          ];

          console.log('✅ Generated TOC with suggestions for uploaded template:', tocWithSuggestions.length, 'sections');
          console.log('📋 Setting tocSections to:', tocWithSuggestions);
          console.log('📋 Setting extractedTOC to:', tocWithSuggestions);
          setTocSections(tocWithSuggestions);
          setExtractedTOC(tocWithSuggestions);
          console.log('✅ State update complete for uploaded template');
          return;
        }
      }

      // Handle predefined templates
      if (isPredefinedTemplate) {
        console.log('📋 Taking PREDEFINED template path for:', selectedTemplate);

        // Now predefined templates should be in the main templates array
        let selectedTemplateData = templates.find(t => t.id === selectedTemplate);

        console.log('📋 Selected predefined template data:', selectedTemplateData);

        if (selectedTemplateData) {
          console.log('📝 Using predefined template sections:', selectedTemplateData.sections);

          // Create original sections from predefined template
          // Use detailed_sections if available (hierarchical), otherwise fall back to flat sections
          let originalSections: any[] = [];

          if (selectedTemplateData.detailed_sections && selectedTemplateData.detailed_sections.length > 0) {
            console.log('📝 Using detailed_sections (hierarchical) for predefined:', selectedTemplateData.detailed_sections);
            originalSections = selectedTemplateData.detailed_sections.map((section: any, index: number) => {
              const mainSection: any = {
                id: `predefined-original-${index}`,
                title: section.title,
                level: section.level || 1,
                content: '',
                isOriginal: true,
                status: 'keep' as const,
              };

              if (section.subsections && section.subsections.length > 0) {
                mainSection.subsections = section.subsections.map((subsection: any, subIndex: number) => ({
                  id: `predefined-original-${index}-${subIndex}`,
                  title: subsection.title,
                  level: subsection.level || 2,
                  content: '',
                  isOriginal: true,
                  status: 'keep' as const,
                }));
              }

              return mainSection;
            });
          } else {
            console.log('📝 Using flat sections (fallback) for predefined:', selectedTemplateData.sections);
            originalSections = selectedTemplateData.sections.map((sectionName: string, index: number) => ({
              id: `predefined-original-${index}`,
              title: sectionName,
              level: 1,
              content: '',
              isOriginal: true,
              status: 'keep' as const,
            }));
          }

          // Create AI suggestions based on RFQ analysis and template type
          let aiSuggestionsForRFQ: any[] = [];

          // Template-specific AI suggestions
          if (selectedTemplate === 'technical-services') {
            aiSuggestionsForRFQ = [
              {
                title: 'Security & Data Protection',
                level: 1,
                content: '',
                reason: `Technical services often require robust security measures. Added based on analysis of ${selectedRFQ}.`
              },
              {
                title: 'Scalability & Performance',
                level: 1,
                content: '',
                reason: 'Technical solutions must demonstrate scalability to meet future needs.'
              },
              {
                title: 'Risk Assessment & Mitigation',
                level: 1,
                content: '',
                reason: 'Technical projects require comprehensive risk management strategies.'
              }
            ];
          } else if (selectedTemplate === 'consulting') {
            aiSuggestionsForRFQ = [
              {
                title: 'Change Management Strategy',
                level: 1,
                content: '',
                reason: `Consulting engagements typically involve organizational change. Critical for ${selectedRFQ}.`
              },
              {
                title: 'Stakeholder Engagement Plan',
                level: 1,
                content: '',
                reason: 'Successful consulting requires comprehensive stakeholder management.'
              },
              {
                title: 'Knowledge Transfer & Training',
                level: 1,
                content: '',
                reason: 'Ensuring client capability building is essential for consulting success.'
              }
            ];
          } else if (selectedTemplate === 'software-dev') {
            aiSuggestionsForRFQ = [
              {
                title: 'DevOps & CI/CD Pipeline',
                level: 1,
                content: '',
                reason: `Modern software development requires automated deployment. Essential for ${selectedRFQ}.`
              },
              {
                title: 'Security & Code Review Process',
                level: 1,
                content: '',
                reason: 'Security considerations are critical in software development projects.'
              },
              {
                title: 'Documentation & Knowledge Base',
                level: 1,
                content: '',
                reason: 'Comprehensive documentation ensures long-term maintainability.'
              }
            ];
          } else if (selectedTemplate === 'research') {
            aiSuggestionsForRFQ = [
              {
                title: 'Data Management & Privacy',
                level: 1,
                content: '',
                reason: `Research projects require robust data handling protocols. Required for ${selectedRFQ}.`
              },
              {
                title: 'Publication & Dissemination Strategy',
                level: 1,
                content: '',
                reason: 'Research outcomes need clear dissemination and publication plans.'
              },
              {
                title: 'Ethical Considerations',
                level: 1,
                content: '',
                reason: 'Research projects must address ethical implications and compliance.'
              }
            ];
          } else {
            // Default suggestions for unknown template types
            aiSuggestionsForRFQ = [
              {
                title: 'Risk Assessment & Mitigation',
                level: 1,
                content: '',
                reason: `Added based on RFQ analysis for ${selectedRFQ}. Risk management is crucial for project success.`
              },
              {
                title: 'Quality Assurance Plan',
                level: 1,
                content: '',
                reason: 'Quality control measures are essential for professional service delivery.'
              },
              {
                title: 'Communication & Reporting',
                level: 1,
                content: '',
                reason: 'Clear communication plans ensure project transparency and success.'
              }
            ];
          }

          // Check for potential removals based on template type
          let suggestedRemovals: any[] = [];
          if (selectedTemplate === 'research' && selectedTemplateData.sections.includes('Budget')) {
            // For research templates, budget might be handled separately
            suggestedRemovals.push({
              title: 'Budget',
              reason: 'Budget details may be better placed in a separate financial section or appendix for research proposals.'
            });
          }

          const tocWithSuggestions: TOCSection[] = [
            // Original sections from predefined template
            ...originalSections,
            // AI suggested additions based on RFQ
            ...aiSuggestionsForRFQ.map((section: any, index: number) => ({
              id: `predefined-suggested-add-${index}`,
              title: section.title,
              level: section.level || 1,
              content: section.content || '',
              isOriginal: false,
              status: 'suggested_add' as const,
              reason: section.reason
            }))
          ];

          // Apply suggested removals
          suggestedRemovals.forEach((removal: any) => {
            const sectionToRemove = tocWithSuggestions.find(s =>
              s.title.toLowerCase().includes(removal.title.toLowerCase())
            );
            if (sectionToRemove) {
              sectionToRemove.status = 'suggested_remove';
              sectionToRemove.reason = removal.reason;
            }
          });

          console.log('✅ Generated TOC for predefined template with AI suggestions:', tocWithSuggestions.length, 'sections');
          console.log('📋 Setting tocSections to:', tocWithSuggestions);
          console.log('📋 Setting extractedTOC to:', tocWithSuggestions);
          setTocSections(tocWithSuggestions);
          setExtractedTOC(tocWithSuggestions);
          console.log('✅ State update complete for predefined template');
          return;
        }
      }

      try {
        console.log('📡 Taking BACKEND template path for:', selectedTemplate);
        console.log('📡 Calling backend wizard_extract_toc...');
        const response = await fetch(`${BASE_URL}/wizard_extract_toc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: selectedTemplate,
            rfqName: selectedRFQ
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📋 Backend TOC response:', data);
          if (data.status === 'success') {
            const tocWithSuggestions: TOCSection[] = [
              // Original sections from template
              ...data.originalSections.map((section: any, index: number) => ({
                id: `original-${index}`,
                title: section.title || section.name,
                level: section.level || 1,
                content: section.content || '',
                isOriginal: true,
                status: 'keep' as const,
                subsections: section.subsections?.map((sub: any, subIndex: number) => ({
                  id: `original-${index}-${subIndex}`,
                  title: sub.title || sub.name,
                  level: (sub.level || 2),
                  content: sub.content || '',
                  isOriginal: true,
                  status: 'keep' as const
                }))
              })),
              // AI suggested additions
              ...data.suggestedAdditions?.map((section: any, index: number) => ({
                id: `suggested-add-${index}`,
                title: section.title,
                level: section.level || 1,
                content: section.content || '',
                isOriginal: false,
                status: 'suggested_add' as const,
                reason: section.reason || 'Suggested based on RFQ analysis'
              })) || []
            ];

            // Mark suggested removals
            if (data.suggestedRemovals?.length > 0) {
              data.suggestedRemovals.forEach((removal: any) => {
                const sectionToRemove = tocWithSuggestions.find(s =>
                  s.title.toLowerCase().includes(removal.title.toLowerCase()) ||
                  removal.title.toLowerCase().includes(s.title.toLowerCase())
                );
                if (sectionToRemove) {
                  sectionToRemove.status = 'suggested_remove';
                  sectionToRemove.reason = removal.reason || 'Not relevant to RFQ requirements';
                }
              });
            }

            console.log('📋 About to set backend TOC state:', tocWithSuggestions);
            setTocSections(tocWithSuggestions);
            setExtractedTOC(tocWithSuggestions);
            console.log('✅ Successfully processed backend TOC with', tocWithSuggestions.length, 'sections');
            console.log('✅ Backend state update complete');
          } else {
            console.warn('⚠️ Backend TOC extraction failed:', data.message || 'No success status');
            console.log('🔄 Backend failed, using fallback...');
            throw new Error(data.message || 'Backend TOC extraction failed');
          }
        } else {
          console.warn('⚠️ Backend TOC request failed:', response.status, response.statusText);
          throw new Error(`Backend request failed: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to extract TOC from backend:', error);
        console.log('🔄 Falling back to client-side TOC generation...');

        // Fallback to basic template structure with AI suggestions
        const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
        if (selectedTemplateData) {
          console.log('📋 Creating fallback TOC from template:', selectedTemplateData.name);

          let basicTOC: TOCSection[] = [];

          // Use detailed_sections if available (hierarchical), otherwise fall back to flat sections
          if (selectedTemplateData.detailed_sections && selectedTemplateData.detailed_sections.length > 0) {
            console.log('📝 Using detailed_sections (hierarchical) for fallback:', selectedTemplateData.detailed_sections);
            basicTOC = selectedTemplateData.detailed_sections.map((section: any, index: number) => {
              const mainSection: any = {
                id: `template-${index}`,
                title: section.title,
                level: section.level || 1,
                isOriginal: true,
                status: 'keep'
              };

              if (section.subsections && section.subsections.length > 0) {
                mainSection.subsections = section.subsections.map((subsection: any, subIndex: number) => ({
                  id: `template-${index}-${subIndex}`,
                  title: subsection.title,
                  level: subsection.level || 2,
                  isOriginal: true,
                  status: 'keep'
                }));
              }

              return mainSection;
            });
          } else {
            console.log('📝 Using flat sections for fallback:', selectedTemplateData.sections);
            basicTOC = selectedTemplateData.sections.map((section, index) => ({
              id: `template-${index}`,
              title: section,
              level: 1,
              isOriginal: true,
              status: 'keep'
            }));
          }

          // Add some AI suggestions based on common RFQ patterns
          const aiSuggestions: TOCSection[] = [
            {
              id: 'ai-suggest-1',
              title: 'Risk Management & Mitigation',
              level: 1,
              isOriginal: false,
              status: 'suggested_add',
              reason: 'Most RFPs require comprehensive risk assessment and mitigation strategies'
            },
            {
              id: 'ai-suggest-2',
              title: 'Quality Assurance Plan',
              level: 1,
              isOriginal: false,
              status: 'suggested_add',
              reason: 'Quality control measures are typically required for professional services'
            },
            {
              id: 'ai-suggest-3',
              title: 'Communication & Reporting',
              level: 1,
              isOriginal: false,
              status: 'suggested_add',
              reason: 'Clear communication plans are essential for project success'
            }
          ];

          // Potentially mark some existing sections for removal (example)
          if (basicTOC.length > 3) {
            basicTOC[basicTOC.length - 1].status = 'suggested_remove';
            basicTOC[basicTOC.length - 1].reason = 'This section may not be relevant to the specific RFQ requirements';
          }

          const combinedTOC = [...basicTOC, ...aiSuggestions];
          console.log('✅ Created fallback TOC with', combinedTOC.length, 'sections including AI suggestions');
          console.log('📋 Fallback TOC structure:', combinedTOC);
          console.log('📋 About to set fallback state...');

          setTocSections(combinedTOC);
          setExtractedTOC(combinedTOC);
          console.log('✅ Fallback state update complete');
        }
      }
    };

    extractTOCFromTemplate();
  }, [selectedTemplate, selectedRFQ, templates, BASE_URL]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('🔍 ProposalWizardPage state changed:');
    console.log('- extractedTOC length:', extractedTOC?.length || 0);
    console.log('- tocSections length:', tocSections?.length || 0);
    console.log('- extractedTOC:', extractedTOC);
    console.log('- tocSections:', tocSections);
  }, [extractedTOC, tocSections]);

  // Convert generated sections to proposal format
  useEffect(() => {
    if (generatedSections.length > 0 && generatedSections.every(s => s.status === 'completed')) {
      const proposalSections: ProposalSection[] = generatedSections.map(section => ({
        id: section.id,
        title: section.title,
        contentMd: section.content,
        level: 1
      }));

      const proposal: Proposal = {
        id: `wizard-proposal-${Date.now()}`,
        title: `${selectedRFQ} - Proposal`,
        rfqName: selectedRFQ,
        sections: proposalSections,
        variables: [
          { key: 'rfq_name', label: 'RFQ Name', value: selectedRFQ },
          { key: 'client_name', label: 'Client Name', value: rfqs.find(r => r.name === selectedRFQ)?.client || '' }
        ],
        compliance: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: []
      };

      setFinalProposal(proposal);
    }
  }, [generatedSections, selectedRFQ, rfqs]);

  const handleRFQUpload = (files: FileList) => {
    onRfqUpload(files);
    // Refresh RFQ list or handle the upload
  };

  const handleTemplateDelete = async (templateId: string) => {
    console.log('🗑️ Deleting template:', templateId);

    try {
      // Only call backend for backend templates (not predefined ones)
      if (templateId.startsWith('backend-') || (!templateId.startsWith('technical-') && !templateId.startsWith('consulting') && !templateId.startsWith('software-') && !templateId.startsWith('research') && !templateId.startsWith('uploaded-'))) {
        // Extract actual backend template ID by removing prefix
        const actualTemplateId = templateId.startsWith('backend-') ? templateId.replace('backend-', '') : templateId;

        console.log('🗑️ Calling backend to delete template:', actualTemplateId);
        const response = await fetch(`${BASE_URL}/delete_template/${actualTemplateId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Backend deletion response:', result);
          if (result.status !== 'success') {
            console.warn('⚠️ Backend deletion warning:', result.message);
          }
        } else {
          console.error('❌ Backend deletion failed:', response.status, response.statusText);
          // Continue with local deletion even if backend fails
        }
      } else {
        console.log('📋 Skipping backend deletion for local template:', templateId);
      }

      // Remove from templates list
      setTemplates(prev => prev.filter(t => t.id !== templateId));

      // If the deleted template was selected, clear the selection
      if (selectedTemplate === templateId) {
        setSelectedTemplate(null);
        setTocSections([]);
        setExtractedTOC([]);
      }

      console.log('✅ Template deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting template:', error);

      // Still remove from local state even if backend call fails
      setTemplates(prev => prev.filter(t => t.id !== templateId));

      if (selectedTemplate === templateId) {
        setSelectedTemplate(null);
        setTocSections([]);
        setExtractedTOC([]);
      }

      console.log('✅ Template removed from local state despite backend error');
    }
  };

  const handleTemplateUpload = async (files: FileList) => {
    if (files.length === 0) return;

    const file = files[0];
    const fileName = file.name;
    const templateName = fileName.replace(/\.(pdf|docx?|txt)$/i, '');

    console.log('Processing uploaded template:', fileName);

    try {
      // Step 1: Upload the file to the backend
      const formData = new FormData();
      formData.append('files', file);
      formData.append('collection', 'templates');

      console.log('📤 Uploading file to backend...');
      const uploadRes = await fetch(`${BASE_URL}/ingest?collection=templates`, {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.statusText}`);
      }

      console.log('✅ File uploaded successfully');

      // Step 2: Extract TOC from the uploaded file
      console.log('📋 Extracting TOC structure...');
      const extractRes = await fetch(`${BASE_URL}/extract_toc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          template_name: templateName
        })
      });

      let extractedSections = [];
      if (extractRes.ok) {
        const extractData = await extractRes.json();
        console.log('📋 Raw extract response:', extractData);
        if (extractData.status === 'success') {
          // Check different possible locations for sections
          if (extractData.sections) {
            extractedSections = extractData.sections;
          } else if (extractData.template && extractData.template.sections) {
            extractedSections = extractData.template.sections;
          } else if (extractData.template && extractData.template.toc) {
            extractedSections = extractData.template.toc;
          } else {
            console.warn('⚠️ No sections found in response structure');
            console.log('📋 Available fields:', Object.keys(extractData));
            if (extractData.template) {
              console.log('📋 Template fields:', Object.keys(extractData.template));
              console.log('📋 Full template object:', extractData.template);
            }
          }

          if (extractedSections && extractedSections.length > 0) {
            console.log('✅ TOC extracted successfully:', extractedSections.length, 'sections');
            console.log('📋 First few sections:', extractedSections.slice(0, 5));
            console.log('📋 Section types:', extractedSections.map(s => typeof s));
          } else {
            console.warn('⚠️ No sections found in successful response');
            console.log('📋 extractedSections value:', extractedSections);
          }
        } else {
          console.warn('⚠️ TOC extraction failed:', extractData.message || 'No success status');
          console.log('📋 Full response for debugging:', extractData);
        }
      } else {
        console.warn('⚠️ TOC extraction endpoint failed:', extractRes.status, extractRes.statusText);
        const errorText = await extractRes.text();
        console.log('📋 Error response:', errorText);
      }

      // Step 3: Re-fetch ALL templates from backend to get the full template data with detailed_sections
      console.log('🔄 Re-fetching templates from backend to get complete data...');
      try {
        const templatesRes = await fetch(`${BASE_URL}/get_toc_templates`);
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          console.log('📋 Fetched templates data:', templatesData);

          if (templatesData.status === 'success' && templatesData.templates) {
            const backendTemplates = (templatesData.templates || []).map((template: any) => ({
              id: template.id || template.name || `backend-${Date.now()}`,
              name: template.name || template.title || 'Unnamed Template',
              description: template.description || 'Backend template',
              category: template.category || 'Backend',
              sections: template.sections || template.toc || ['Default Section'],
              detailed_sections: template.detailed_sections, // CRITICAL: Get hierarchical structure
              statistics: template.statistics, // Get statistics
              preview: template.preview || 'Template from backend system'
            }));

            // Merge with predefined templates
            const allBackendTemplates = backendTemplates.map((template, index) => ({
              ...template,
              id: template.id ? `backend-${template.id}` : `backend-${index}`
            }));

            setTemplates([...PREDEFINED_TEMPLATES, ...allBackendTemplates]);
            console.log('✅ Templates refreshed with full data');

            // Auto-select the newly uploaded template (it's the first in backend templates)
            if (allBackendTemplates.length > 0) {
              setSelectedTemplate(allBackendTemplates[0].id);
              console.log('✅ Auto-selected new template:', allBackendTemplates[0].name);
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to refresh templates:', error);
        // Fallback: use the old way
        const uploadedTemplate = {
          id: `uploaded-${Date.now()}`,
          name: templateName,
          description: `Custom uploaded template from ${fileName}`,
          category: 'Custom',
          sections: extractedSections.length > 0
            ? extractedSections.map((s: any) => {
                if (typeof s === 'string') return s;
                if (s.title) return s.title;
                return s.toString();
              })
            : ['Executive Summary', 'Scope of Work', 'Timeline', 'Budget', 'Terms'],
          preview: 'Custom template uploaded by user.'
        };
        setTemplates(prev => [uploadedTemplate, ...prev]);
        setSelectedTemplate(uploadedTemplate.id);
      }

      console.log('✅ Template processed successfully:', templateName);

      // Show user feedback
      setTimeout(() => {
        const message = extractedSections.length > 0
          ? `✅ Template "${templateName}" uploaded successfully!\n\n📋 Extracted ${extractedSections.length} sections from your document.\nThe template has been added to your library and automatically selected.`
          : `✅ Template "${templateName}" uploaded successfully!\n\n⚠️ Could not extract TOC structure, using default sections.\nThe template has been added to your library and automatically selected.`;
        alert(message);
      }, 100);

      // Call parent handler
      onTemplateUpload(files);

    } catch (error) {
      console.error('❌ Failed to process uploaded template:', error);
      alert(`❌ Failed to upload template: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`);
    }
  };

  const handleTOCUpdate = (updatedSections: TOCSection[]) => {
    setTocSections(updatedSections);
  };

  // Helper function to flatten hierarchical TOC sections for proposal generation
  const flattenTOCSections = (sections: TOCSection[]): TOCSection[] => {
    const flattened: TOCSection[] = [];

    const flattenSection = (section: TOCSection) => {
      // Add the main section if it should be kept
      if (section.status === 'keep') {
        flattened.push({
          ...section,
          subsections: undefined // Remove subsections from flattened version
        });
      }

      // Add all subsections recursively
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          flattenSection(subsection);
        });
      }
    };

    sections.forEach(section => flattenSection(section));

    console.log(`📋 Flattened ${sections.length} hierarchical sections into ${flattened.length} flat sections for proposal generation`);
    return flattened;
  };

  const handleGenerationComplete = (sections: GeneratedSection[]) => {
    setGeneratedSections(sections);
  };

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');

  const handleDocumentDownload = async (format: 'pdf' | 'docx') => {
    setIsDownloading(true);
    setDownloadMessage(`Generating ${format.toUpperCase()}...`);

    try {
      // Prepare sections data for download
      const sectionsForDownload = generatedSections.filter(section =>
        section.status === 'completed' && section.content?.trim()
      );

      if (sectionsForDownload.length === 0) {
        setDownloadMessage('No completed sections to download');
        setIsDownloading(false);
        return;
      }

      // Prepare proposal data for backend
      const proposalData = {
        title: `Proposal for ${selectedRFQ}`,
        rfqName: selectedRFQ,
        sections: sectionsForDownload.map(section => ({
          id: `section-${section.title.replace(/\s+/g, '-').toLowerCase()}`,
          title: section.title,
          content: section.content,
          level: section.level || 1
        })),
        updatedAt: new Date().toISOString()
      };

      if (format === 'pdf') {
        // Generate properly formatted HTML and open in new tab for PDF save
        setDownloadMessage('Generating PDF...');

        const response = await fetch(`${BASE_URL}/export_proposal/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalData)
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || 'Failed to generate PDF');
        }

        // Create a properly formatted HTML file and download it
        const htmlContent = result.content;
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${proposalData.title.replace(/[^a-zA-Z0-9]/g, '_')}_Proposal.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setDownloadMessage('HTML file downloaded! Open it in your browser and use Ctrl+P → "Save as PDF" to get PDF.');

        // Also open in new tab for immediate viewing/printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.onload = () => {
            // Don't auto-trigger print, let user decide
          };
        }

      } else if (format === 'docx') {
        // Generate actual DOCX file using backend python-docx
        setDownloadMessage('Generating DOCX...');

        const response = await fetch(`${BASE_URL}/export_proposal/docx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalData)
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || 'Failed to generate DOCX');
        }

        // Convert base64 to blob and download
        const base64Content = result.content;
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || `${proposalData.title.replace(/[^a-zA-Z0-9]/g, '_')}_Proposal.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setDownloadMessage('DOCX file downloaded! Ready to open in Microsoft Word.');
      }

    } catch (error) {
      console.error('Download failed:', error);
      setDownloadMessage(`Download failed: ${error.message}`);
    } finally {
      setIsDownloading(false);

      // Clear message after 8 seconds
      setTimeout(() => {
        setDownloadMessage('');
      }, 8000);
    }
  };

  // Helper function to convert text content to RTF format
  const convertToRTF = (textContent: string, title: string) => {
    // Basic RTF header
    let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';

    // Title
    rtf += `\\f0\\fs28\\b ${title}\\b0\\par\\par`;

    // Convert text content to RTF
    const lines = textContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        rtf += '\\par';
        continue;
      }

      // Handle section headers (lines ending with equals signs)
      if (trimmedLine.includes('====')) {
        continue; // Skip separator lines
      }

      // Handle section titles (all caps lines)
      if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
        rtf += `\\fs20\\b ${trimmedLine}\\b0\\par\\par`;
        continue;
      }

      // Handle bullet points
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('  •')) {
        rtf += `\\tab ${trimmedLine}\\par`;
        continue;
      }

      // Handle quotes
      if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
        rtf += `\\i ${trimmedLine}\\i0\\par`;
        continue;
      }

      // Regular paragraph
      rtf += `${trimmedLine}\\par`;
    }

    rtf += '}';
    return rtf;
  };

  const handleWizardComplete = () => {
    if (finalProposal) {
      // Save to completed proposals
      if ((window as any).saveCompletedProposal) {
        (window as any).saveCompletedProposal(finalProposal);
      }
      onProposalComplete(finalProposal);
    }
  };

  // Get selected template and RFQ data
  const selectedRFQData = rfqs.find(rfq => rfq.name === selectedRFQ);
  const selectedTemplateData = templates.find(template => template.id === selectedTemplate);

  // Define wizard steps
  const wizardSteps: WizardStep[] = [
    {
      id: 'rfq-selection',
      title: 'Select RFQ',
      icon: <FileText className="w-5 h-5" />,
      component: (
        <RFQSelectionPage
          rfqs={rfqs}
          selectedRFQ={selectedRFQ}
          onRFQSelect={setSelectedRFQ}
          onRFQUpload={handleRFQUpload}
          canProceed={!!selectedRFQ}
        />
      ),
      isComplete: !!selectedRFQ,
      canProceed: !!selectedRFQ
    },
    {
      id: 'template-selection',
      title: 'Choose Template',
      icon: <Settings className="w-5 h-5" />,
      component: (
        <TemplateSelectionPage
          templates={templates}
          selectedTemplate={selectedTemplate}
          onTemplateSelect={setSelectedTemplate}
          onTemplateUpload={handleTemplateUpload}
          onTemplateDelete={handleTemplateDelete}
          canProceed={!!selectedTemplate}
        />
      ),
      isComplete: !!selectedTemplate,
      canProceed: !!selectedTemplate
    },
    {
      id: 'toc-validation',
      title: 'Validate Structure',
      icon: <Eye className="w-5 h-5" />,
      component: (
        <div>
          {console.log('🔍 TOC Validation Debug:')}
          {console.log('- selectedRFQ:', selectedRFQ)}
          {console.log('- selectedTemplateData:', selectedTemplateData)}
          {console.log('- extractedTOC length:', extractedTOC?.length || 0)}
          {console.log('- extractedTOC type:', typeof extractedTOC)}
          {console.log('- extractedTOC is array:', Array.isArray(extractedTOC))}
          {console.log('- extractedTOC value:', extractedTOC)}
          {console.log('- tocSections length:', tocSections?.length || 0)}
          {console.log('- tocSections value:', tocSections)}
          {console.log('🔍 About to render TOCValidationPage with initialTOC:', extractedTOC)}
          <TOCValidationPage
            rfqName={selectedRFQ}
            templateName={selectedTemplateData?.name || 'Selected Template'}
            initialTOC={extractedTOC}
            onTOCUpdate={handleTOCUpdate}
            canProceed={tocSections.length > 0}
          />
        </div>
      ),
      isComplete: extractedTOC.length > 0 || tocSections.length > 0,
      canProceed: true // Allow proceeding even if TOC is still loading
    },
    {
      id: 'generate-content',
      title: 'Generate Content',
      icon: <Wand2 className="w-5 h-5" />,
      component: (
        <ProposalGenerationPage
          rfqName={selectedRFQ}
          templateName={selectedTemplateData?.name || 'Selected Template'}
          tocSections={flattenTOCSections(tocSections)}
          onGenerationComplete={handleGenerationComplete}
          canProceed={generatedSections.length > 0 && generatedSections.every(s => s.status === 'completed')}
        />
      ),
      isComplete: generatedSections.length > 0 && generatedSections.every(s => s.status === 'completed'),
      canProceed: generatedSections.length > 0 && generatedSections.every(s => s.status === 'completed')
    },
    {
      id: 'document-preview',
      title: 'Preview & Download',
      icon: <Eye className="w-5 h-5" />,
      component: generatedSections.length > 0 ? (
        <DocumentViewer
          rfqName={selectedRFQ}
          templateName={selectedTemplateData?.name || 'Selected Template'}
          sections={generatedSections}
          onDownload={handleDocumentDownload}
        />
      ) : (
        <div className="text-center text-slate-500 dark:text-slate-400 py-20">
          <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <div className="text-lg font-medium mb-2">Document Preview Not Available</div>
          <div className="text-sm">Complete content generation to preview your proposal</div>
        </div>
      ),
      isComplete: generatedSections.length > 0 && generatedSections.every(s => s.status === 'completed'),
      canProceed: true // Allow proceeding even without download
    },
    {
      id: 'final-review',
      title: 'Review & Export',
      icon: <Download className="w-5 h-5" />,
      component: finalProposal ? (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              🎉 Proposal Generated Successfully!
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Your proposal has been generated with {finalProposal.sections.length} sections.
              You can now review and export it.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-4">
              {finalProposal.title}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-700 dark:text-green-300">Sections:</span>
                <div className="text-green-600 dark:text-green-400">
                  {finalProposal.sections.length} sections
                </div>
              </div>
              <div>
                <span className="font-medium text-green-700 dark:text-green-300">RFQ:</span>
                <div className="text-green-600 dark:text-green-400">
                  {finalProposal.rfqName}
                </div>
              </div>
              <div>
                <span className="font-medium text-green-700 dark:text-green-300">Template:</span>
                <div className="text-green-600 dark:text-green-400">
                  {selectedTemplateData?.name || 'Custom'}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                console.log('Opening proposal in main editor...');
                handleWizardComplete();
              }}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Open in Proposal Editor
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-slate-500 dark:text-slate-400">
          Preparing final proposal...
        </div>
      ),
      isComplete: !!finalProposal,
      canProceed: !!finalProposal
    }
  ];

  return (
    <ProposalWizard
      steps={wizardSteps}
      currentStepIndex={currentStepIndex}
      onStepChange={setCurrentStepIndex}
      onComplete={handleWizardComplete}
    />
  );
}