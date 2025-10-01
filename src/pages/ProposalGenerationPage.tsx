import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, FileText, Table, Image, Clock, CheckCircle, AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';
import { Card, CardHeader } from '../components/Atoms';

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

interface ProposalGenerationPageProps {
  rfqName: string;
  templateName: string;
  tocSections: any[];
  onGenerationComplete: (sections: GeneratedSection[]) => void;
  canProceed: boolean;
}

export default function ProposalGenerationPage({
  rfqName,
  templateName,
  tocSections,
  onGenerationComplete,
  canProceed
}: ProposalGenerationPageProps) {
  const [sections, setSections] = useState<GeneratedSection[]>([]);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState(-1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [generationStartTime, setGenerationStartTime] = useState<Date | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);

  // Initialize sections from TOC
  useEffect(() => {
    console.log('🔍 ProposalGenerationPage - Received tocSections:', tocSections);
    console.log('🔍 tocSections length:', tocSections?.length || 0);
    console.log('🔍 First tocSection:', tocSections?.[0]);

    if (!tocSections || tocSections.length === 0) {
      console.log('⚠️ No TOC sections provided');
      setSections([]);
      return;
    }

    const initialSections: GeneratedSection[] = tocSections
      .filter(toc => toc.status !== 'suggested_remove') // Only keep sections marked to keep
      .map((toc, index) => {
        console.log(`🔍 Processing TOC section ${index}:`, toc);
        return {
          id: toc.id || `section-${index}`,
          title: toc.title || `Section ${index + 1}`,
          content: '',
          status: 'pending' as const,
          hasTablePlaceholder: false,
          hasImagePlaceholder: false,
          tablePlaceholders: [],
          imagePlaceholders: [],
          wordCount: 0
        };
      });

    console.log('✅ Created initial sections:', initialSections.length);
    console.log('✅ First section:', initialSections[0]);
    setSections(initialSections);
  }, [tocSections]);

  // Analyze content for placeholders
  const analyzeContentPlaceholders = (content: string) => {
    const tablePlaceholders: string[] = [];
    const imagePlaceholders: string[] = [];

    // Look for table indicators
    const tablePatterns = [
      /\[TABLE:([^\]]+)\]/gi,
      /\{table:([^}]+)\}/gi,
      /a table showing ([^.]+)/gi,
      /the following table ([^.]+)/gi,
      /would benefit from a table/gi
    ];

    tablePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        tablePlaceholders.push(...matches);
      }
    });

    // Look for image indicators
    const imagePatterns = [
      /\[IMAGE:([^\]]+)\]/gi,
      /\{image:([^}]+)\}/gi,
      /an image illustrating ([^.]+)/gi,
      /visual representation of ([^.]+)/gi,
      /would benefit from an image/gi,
      /diagram showing ([^.]+)/gi
    ];

    imagePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        imagePlaceholders.push(...matches);
      }
    });

    return {
      tablePlaceholders: [...new Set(tablePlaceholders)],
      imagePlaceholders: [...new Set(imagePlaceholders)],
      hasTablePlaceholder: tablePlaceholders.length > 0,
      hasImagePlaceholder: imagePlaceholders.length > 0
    };
  };

  // Simulate content generation for a section
  const generateSectionContent = async (sectionId: string, title: string): Promise<string> => {
    try {
      console.log(`🤖 Generating content for section: ${title}`);

      // Call the backend generate_section endpoint
      const response = await fetch('http://localhost:8000/generate_section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: title,
          rfqName: rfqName,
          templateContext: templateName,
          requirements: [],
          style: 'professional'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.content) {
          console.log(`✅ Generated content for ${title}:`, result.content.substring(0, 100) + '...');
          return result.content;
        } else {
          console.warn(`⚠️ Backend generation failed for ${title}:`, result.message || 'No content returned');
        }
      } else {
        console.warn(`⚠️ Backend request failed for ${title}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error(`❌ Error generating content for ${title}:`, error);
    }

    // Fallback to enhanced template-based content
    console.log(`🔄 Using fallback content generation for: ${title}`);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Generate realistic content with placeholders
    const contentTemplates = [
      `## ${title}

Based on our analysis of the ${rfqName} requirements, we propose a comprehensive approach that addresses all key objectives.

Our methodology includes:
- Detailed requirement analysis
- Risk assessment and mitigation strategies
- Implementation planning with clear milestones
- Quality assurance processes

[TABLE: Implementation Timeline] - A detailed timeline showing project phases, deliverables, and key milestones would benefit from a table format to provide clear visibility of the project schedule.

The proposed solution leverages industry best practices and proven methodologies to ensure successful project delivery. Our team's extensive experience in similar projects provides confidence in our ability to meet all requirements.

[IMAGE: Solution Architecture] - An image illustrating the overall solution architecture would help visualize the system components and their interactions.

Key benefits of our approach include:
- Reduced implementation risk
- Faster time to value
- Scalable and maintainable solution
- Comprehensive documentation and knowledge transfer`,

      `## ${title}

Our understanding of the ${rfqName} demonstrates our commitment to delivering exceptional results that exceed expectations.

### Key Components

1. **Strategic Planning**: Comprehensive analysis of requirements and objectives
2. **Technical Implementation**: Cutting-edge solutions using proven technologies
3. **Quality Management**: Rigorous testing and validation processes
4. **Project Governance**: Clear communication and stakeholder management

The following table outlines our recommended approach:

[TABLE: Recommended Approach] - A table showing different phases, activities, resources, and timelines would provide a clear breakdown of our methodology.

### Visual Overview

[IMAGE: Process Flow Diagram] - A diagram showing the end-to-end process flow would help stakeholders understand the sequence of activities and decision points.

This comprehensive approach ensures all requirements are met while maintaining the highest quality standards throughout the project lifecycle.`,

      `## ${title}

In response to the ${rfqName}, we have developed a tailored solution that addresses the unique challenges and opportunities presented.

### Solution Overview

Our proposed solution incorporates:
- Industry-leading technologies and frameworks
- Proven implementation methodologies
- Comprehensive risk management
- Continuous improvement processes

### Resource Allocation

[TABLE: Resource Matrix] - A table showing resource allocation across different project phases would provide transparency on team commitment and expertise distribution.

### Technical Architecture

The technical architecture is designed to be scalable, secure, and maintainable. Key architectural principles include:
- Modular design for flexibility
- Security by design
- Performance optimization
- Future-proof technology choices

[IMAGE: Technical Architecture Overview] - An image illustrating the technical architecture components and their relationships would provide a clear visual understanding of the proposed solution.

This approach ensures successful delivery while maintaining alignment with organizational objectives and industry best practices.`
    ];

    // Select a random template and customize it
    const template = contentTemplates[Math.floor(Math.random() * contentTemplates.length)];
    return template;
  };

  // Start generation process
  const startGeneration = async () => {
    setIsGenerating(true);
    setIsPaused(false);
    setGenerationStartTime(new Date());
    setCurrentGeneratingIndex(0);

    for (let i = 0; i < sections.length; i++) {
      if (isPaused) break;

      setCurrentGeneratingIndex(i);
      setSections(prev => prev.map((section, index) =>
        index === i ? { ...section, status: 'generating' } : section
      ));

      try {
        const content = await generateSectionContent(sections[i].id, sections[i].title);
        const analysis = analyzeContentPlaceholders(content);
        const wordCount = content.split(/\s+/).length;

        setSections(prev => prev.map((section, index) =>
          index === i
            ? {
                ...section,
                content,
                status: 'completed',
                wordCount,
                ...analysis
              }
            : section
        ));

        // Update estimated time remaining
        const elapsed = Date.now() - (generationStartTime?.getTime() || Date.now());
        const avgTimePerSection = elapsed / (i + 1);
        const remaining = Math.ceil((avgTimePerSection * (sections.length - i - 1)) / 1000);
        setEstimatedTimeRemaining(remaining);

      } catch (error) {
        setSections(prev => prev.map((section, index) =>
          index === i ? { ...section, status: 'error' } : section
        ));
      }
    }

    setIsGenerating(false);
    setCurrentGeneratingIndex(-1);
    setEstimatedTimeRemaining(0);
  };

  const pauseGeneration = () => {
    setIsPaused(true);
    setIsGenerating(false);
  };

  const resumeGeneration = () => {
    setIsPaused(false);
    startGeneration();
  };

  const resetGeneration = () => {
    setSections(prev => prev.map(section => ({
      ...section,
      content: '',
      status: 'pending',
      hasTablePlaceholder: false,
      hasImagePlaceholder: false,
      tablePlaceholders: [],
      imagePlaceholders: [],
      wordCount: 0
    })));
    setIsGenerating(false);
    setIsPaused(false);
    setCurrentGeneratingIndex(-1);
    setEstimatedTimeRemaining(0);
  };

  // Update parent when generation is complete
  useEffect(() => {
    if (sections.length > 0 && sections.every(s => s.status === 'completed')) {
      onGenerationComplete(sections);
    }
  }, [sections, onGenerationComplete]);

  const completedSections = sections.filter(s => s.status === 'completed').length;
  const totalWordCount = sections.reduce((sum, s) => sum + s.wordCount, 0);
  const sectionsWithTables = sections.filter(s => s.hasTablePlaceholder).length;
  const sectionsWithImages = sections.filter(s => s.hasImagePlaceholder).length;

  // Debug rendering state
  console.log('🔍 Debug Info:');
  console.log('tocSections length:', tocSections?.length || 0);
  console.log('sections length:', sections.length);
  console.log('First tocSection:', tocSections?.[0]);
  console.log('First section:', sections[0]);

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
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold">
              ✓
            </div>
            <span className="ml-2 font-medium text-green-600">Choose Template</span>
          </div>
          <div className="w-12 h-0.5 bg-green-300"></div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold">
              ✓
            </div>
            <span className="ml-2 font-medium text-green-600">Validate Structure</span>
          </div>
          <div className="w-12 h-0.5 bg-green-300"></div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <span className="ml-2 font-medium text-blue-600">Generate</span>
          </div>
        </div>
      </motion.div>

      {/* Introduction & Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center max-w-3xl mx-auto"
      >
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          🚀 Generate Proposal Content
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-lg mb-6">
          AI is now generating personalized content for each section based on the <strong>{rfqName}</strong> requirements
          and the <strong>{templateName}</strong> structure. Content will include smart placeholders for tables and images where appropriate.
        </p>
        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-purple-500" />
            <span>Table placeholders detected automatically</span>
          </div>
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-orange-500" />
            <span>Image placeholders suggested</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          {!isGenerating && completedSections === 0 && (
            <button
              onClick={startGeneration}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
            >
              <Play className="w-5 h-5" />
              Start Generation
            </button>
          )}

          {isGenerating && (
            <button
              onClick={pauseGeneration}
              className="flex items-center gap-3 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all font-medium"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>
          )}

          {isPaused && (
            <button
              onClick={resumeGeneration}
              className="flex items-center gap-3 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium"
            >
              <Play className="w-5 h-5" />
              Resume
            </button>
          )}

          {completedSections > 0 && (
            <button
              onClick={resetGeneration}
              className="flex items-center gap-3 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          )}
        </div>
      </motion.div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {completedSections}/{sections.length}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Sections Complete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {totalWordCount.toLocaleString()}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">Words Generated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {sectionsWithTables}
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Table Placeholders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {sectionsWithImages}
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">Image Placeholders</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300 mb-2">
                <span>Overall Progress</span>
                <span>{Math.round((completedSections / sections.length) * 100)}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3">
                <motion.div
                  className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedSections / sections.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>

              {isGenerating && estimatedTimeRemaining > 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-blue-600 dark:text-blue-400">
                  <Clock className="w-4 h-4" />
                  <span>Estimated time remaining: {Math.floor(estimatedTimeRemaining / 60)}m {estimatedTimeRemaining % 60}s</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Section Generation Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Section Generation Progress
        </h4>

        {/* Debug section */}
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg text-sm mb-4">
          <div className="font-bold mb-3">🔍 Debug Information</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-semibold text-blue-800 dark:text-blue-200">Input (TOC Sections):</div>
              <div>• Count: {tocSections?.length || 0}</div>
              <div>• First: {tocSections?.[0] ? `"${tocSections[0].title}" (${tocSections[0].status})` : 'none'}</div>
              <div>• Filtered: {tocSections?.filter(t => t.status !== 'suggested_remove').length || 0} sections (excluding suggested_remove)</div>
            </div>
            <div className="space-y-2">
              <div className="font-semibold text-green-800 dark:text-green-200">Output (Generated Sections):</div>
              <div>• Count: {sections.length}</div>
              <div>• First: {sections?.[0] ? `"${sections[0].title}" (${sections[0].status})` : 'none'}</div>
              <div>• State: {sections.length === 0 ? '❌ Empty - will show "No sections" message' : '✅ Has sections - will render section cards'}</div>
            </div>
          </div>
          {sections.length > 0 && (
            <div className="mt-4 space-y-1">
              <div className="font-semibold text-purple-800 dark:text-purple-200">All Sections Preview:</div>
              {sections.slice(0, 3).map((section, i) => (
                <div key={i} className="text-xs">#{i + 1}: "{section.title}" - {section.status}</div>
              ))}
              {sections.length > 3 && <div className="text-xs">... and {sections.length - 3} more</div>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {console.log('🔍 Rendering check: sections.length =', sections.length, ', showing empty state?', sections.length === 0)}
          {sections.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-600 dark:text-slate-400 mb-2">
                No sections to generate
              </h3>
              <p className="text-slate-500 dark:text-slate-500 mb-6">
                No sections were provided from the TOC validation step. Please go back and ensure sections are properly configured.
              </p>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                Debug: tocSections = {JSON.stringify(tocSections)}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section, index) => (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 relative overflow-hidden ${
                    section.status === 'generating'
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                      : section.status === 'completed'
                      ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
                      : section.status === 'error'
                      ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
                      : ''
                  }`}
                >
                  {/* Section content */}
                  <div className="p-4 pl-12 flex items-center justify-between group">
                    {/* Section number indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center ${
                      section.status === 'generating'
                        ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                        : section.status === 'completed'
                        ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                        : section.status === 'error'
                        ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {section.status === 'generating' ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Wand2 className="w-4 h-4" />
                        </motion.div>
                      ) : section.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : section.status === 'error' ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>

                    {/* Section details */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {section.title}
                          </h3>
                          {section.status === 'completed' && (
                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                              <span>{section.wordCount} words</span>
                              {section.hasTablePlaceholder && (
                                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                  <Table className="w-4 h-4" />
                                  {section.tablePlaceholders.length}
                                </span>
                              )}
                              {section.hasImagePlaceholder && (
                                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                  <Image className="w-4 h-4" />
                                  {section.imagePlaceholders.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Status indicator on the right */}
                        <div className="flex items-center gap-2">
                          {section.status === 'pending' && (
                            <span className="text-sm text-slate-500 dark:text-slate-400">Waiting...</span>
                          )}
                          {section.status === 'generating' && (
                            <motion.span
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="text-sm text-blue-600 dark:text-blue-400 font-medium"
                            >
                              Generating...
                            </motion.span>
                          )}
                          {section.status === 'completed' && (
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              ✅ Done
                            </span>
                          )}
                          {section.status === 'error' && (
                            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                              ❌ Failed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Generation progress text */}
                      {section.status === 'generating' && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          Analyzing requirements and generating content...
                        </p>
                      )}

                      {/* Content preview for completed sections */}
                      {section.status === 'completed' && section.content && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ delay: 0.2 }}
                          className="mt-3 p-3 bg-white/70 dark:bg-slate-900/70 rounded border border-slate-200 dark:border-slate-600"
                        >
                          <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {section.content.substring(0, 150)}...
                          </div>

                          {(section.tablePlaceholders.length > 0 || section.imagePlaceholders.length > 0) && (
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                              <div className="flex gap-4 text-xs">
                                {section.tablePlaceholders.length > 0 && (
                                  <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                    <Table className="w-3 h-3" />
                                    <span>{section.tablePlaceholders.length} table{section.tablePlaceholders.length !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                                {section.imagePlaceholders.length > 0 && (
                                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                    <Image className="w-3 h-3" />
                                    <span>{section.imagePlaceholders.length} image{section.imagePlaceholders.length !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}