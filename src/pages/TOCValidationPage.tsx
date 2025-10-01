import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Plus, Trash2, Edit, GripVertical, FileText } from 'lucide-react';
import { Card, CardHeader } from '../components/Atoms';

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

interface TOCValidationPageProps {
  rfqName: string;
  templateName: string;
  initialTOC: TOCSection[];
  onTOCUpdate: (sections: TOCSection[]) => void;
  canProceed: boolean;
}

export default function TOCValidationPage({
  rfqName,
  templateName,
  initialTOC,
  onTOCUpdate,
  canProceed
}: TOCValidationPageProps) {
  console.log('🔍 TOCValidationPage - Props received:', {
    rfqName,
    templateName,
    initialTOCLength: initialTOC?.length || 0,
    initialTOC,
    canProceed
  });

  const [sections, setSections] = useState<TOCSection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<'gap' | 'section' | null>(null);

  // Undo functionality
  const [history, setHistory] = useState<TOCSection[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize sections from props
  useEffect(() => {
    console.log('🔄 Initializing sections from props...');
    if (initialTOC && Array.isArray(initialTOC) && initialTOC.length > 0) {
      console.log('📋 Converting raw sections to normalized format...');

      // Function to recursively normalize sections and their subsections
      const normalizeSection = (section: any, index: number, parentId = ''): TOCSection => {
        const sectionId = section.id || `section-${parentId}-${index}-${Date.now()}`;

        const normalized: TOCSection = {
          id: sectionId,
          title: section.title || section.name || section.heading || `Section ${index + 1}`,
          level: section.level || 1,
          content: section.content || '',
          isOriginal: section.isOriginal !== undefined ? section.isOriginal : true,
          status: section.status || 'keep' as const,
          reason: section.reason
        };

        // Recursively normalize subsections if they exist
        if (section.subsections && Array.isArray(section.subsections) && section.subsections.length > 0) {
          normalized.subsections = section.subsections.map((subsection: any, subIndex: number) =>
            normalizeSection(subsection, subIndex, sectionId)
          );
          console.log(`📋 Section "${normalized.title}" has ${normalized.subsections.length} subsections`);
        }

        console.log(`✅ Section ${index}:`, {
          title: normalized.title,
          level: normalized.level,
          hasSubsections: !!normalized.subsections,
          subsectionCount: normalized.subsections?.length || 0
        });

        return normalized;
      };

      const normalizedSections = initialTOC.map((section: any, index: number) =>
        normalizeSection(section, index)
      );

      console.log('✅ Setting sections:', normalizedSections.length, 'total');
      console.log('🔍 DEBUG - Full normalized sections with subsections:', JSON.stringify(normalizedSections.map(s => ({
        title: s.title,
        level: s.level,
        subsections: s.subsections?.map(sub => ({ title: sub.title, level: sub.level }))
      })), null, 2));
      setSections(normalizedSections);
    } else {
      console.log('⚠️ No valid initialTOC provided, using empty array');
      setSections([]);
    }
  }, [initialTOC]);

  // Update parent when sections change
  useEffect(() => {
    console.log('📤 Updating parent with sections:', sections.length);
    onTOCUpdate(sections);
  }, [sections, onTOCUpdate]);

  // Add to history when sections change (for undo functionality)
  const addToHistory = (newSections: TOCSection[]) => {
    setHistory(prev => {
      // Remove any history after current index (when we make new changes after undoing)
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push(JSON.parse(JSON.stringify(sections))); // Deep copy current state
      // Keep only last 50 changes
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
    setSections(newSections);
  };

  // Undo functionality
  const undo = () => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setSections(JSON.parse(JSON.stringify(previousState))); // Deep copy
      setHistoryIndex(prev => prev - 1);
      console.log('↶ Undo applied');
    }
  };

  // CTRL+Z handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const addSection = () => {
    const newSection: TOCSection = {
      id: `new-section-${Date.now()}`,
      title: 'New Section',
      level: 1,
      isOriginal: false,
      status: 'keep',
      content: ''
    };

    const newSections = [...sections, newSection];
    addToHistory(newSections);
    setEditingId(newSection.id);
    setEditText(newSection.title);
  };

  const removeSection = (id: string) => {
    const newSections = sections.filter(section => section.id !== id);
    addToHistory(newSections);
  };

  const updateSectionStatus = (id: string, status: TOCSection['status']) => {
    const newSections = sections.map(section =>
      section.id === id ? { ...section, status } : section
    );
    addToHistory(newSections);
  };

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditText(currentTitle);
  };

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      const newSections = sections.map(section =>
        section.id === editingId
          ? { ...section, title: editText.trim() }
          : section
      );
      addToHistory(newSections);
    }
    setEditingId(null);
    setEditText('');
  };

  const saveEditSubsection = (parentId: string, subIndex: number) => {
    if (editingId && editText.trim()) {
      const newSections = sections.map(section => {
        if (section.id === parentId && section.subsections) {
          const updatedSubsections = [...section.subsections];
          updatedSubsections[subIndex] = {
            ...updatedSubsections[subIndex],
            title: editText.trim()
          };
          return { ...section, subsections: updatedSubsections };
        }
        return section;
      });
      addToHistory(newSections);
    }
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // Drag and drop handlers - improved for less fidgety behavior
  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    console.log('🔄 Drag started:', sectionId, 'at level:', sections.find(s => s.id === sectionId)?.level);

    // Ensure drag doesn't get blocked
    e.stopPropagation();

    setDraggedSection(sectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sectionId);

    // Add drag image for better UX
    const draggedElement = e.currentTarget as HTMLElement;
    draggedElement.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const draggedElement = e.currentTarget as HTMLElement;
    draggedElement.style.opacity = '1';

    setDraggedSection(null);
    setDragOverSection(null);
    setDragOverType(null);
  };

  const handleDragOver = (e: React.DragEvent, targetSectionId?: string, type: 'gap' | 'section' = 'gap') => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (targetSectionId && targetSectionId !== draggedSection) {
      setDragOverSection(targetSectionId);
      setDragOverType(type);
    } else if (!targetSectionId) {
      setDragOverSection('end');
      setDragOverType('gap');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear if we're leaving the entire drop zone area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverSection(null);
      setDragOverType(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSectionId?: string, dropZone: 'gap' | 'section' = 'gap') => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔄 Drop event:', { draggedSection, targetSectionId, dropZone, totalSections: sections.length });

    if (!draggedSection) {
      console.log('❌ No dragged section');
      return;
    }

    // Find dragged section in main sections or subsections
    let draggedIndex = sections.findIndex(s => s.id === draggedSection);
    let isDraggedSubsection = false;

    if (draggedIndex === -1) {
      // Check if it's a subsection being dragged
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].subsections) {
          const subIndex = sections[i].subsections!.findIndex(sub => sub.id === draggedSection);
          if (subIndex !== -1) {
            isDraggedSubsection = true;
            console.log('🔄 Dragging subsection');
            break;
          }
        }
      }
    }

    console.log('🔄 Drag analysis:', { draggedIndex, isDraggedSubsection, draggedSection });

    if (draggedIndex === -1 && !isDraggedSubsection) {
      console.error('❌ Could not find dragged section:', draggedSection);
      return;
    }

    if (dropZone === 'section' && targetSectionId && targetSectionId !== draggedSection) {
      // Drop ON a section - create subsection
      console.log('🔄 Creating subsection');
      moveToSubsection(draggedSection, targetSectionId);
    } else if (dropZone === 'gap' && !isDraggedSubsection) {
      // Drop in a gap - reorder sections (only for main sections)
      const targetIndex = targetSectionId && targetSectionId !== 'end'
        ? sections.findIndex(s => s.id === targetSectionId)
        : sections.length;

      if (targetIndex !== -1 && draggedIndex !== targetIndex && draggedIndex !== -1) {
        console.log('🔄 Reordering sections from', draggedIndex, 'to', targetIndex);
        reorderSections(draggedIndex, targetIndex);
      } else {
        console.log('⚠️ Cannot reorder:', { targetIndex, draggedIndex });
      }
    }

    setDraggedSection(null);
    setDragOverSection(null);
    setDragOverType(null);
  };

  const reorderSections = (fromIndex: number, toIndex: number) => {
    const newSections = [...sections];
    const [movedSection] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, movedSection);
    console.log('✅ Sections reordered', { fromIndex, toIndex, totalSections: newSections.length });
    addToHistory(newSections);
  };

  const moveToSubsection = (draggedId: string, targetId: string) => {
    const newSections = [...sections];

    // Check if dragged item is a subsection first
    let draggedSection: TOCSection | null = null;
    let isSubsection = false;

    // Try to find in main sections
    const draggedIndex = newSections.findIndex(s => s.id === draggedId);
    if (draggedIndex !== -1) {
      draggedSection = newSections.splice(draggedIndex, 1)[0];
    } else {
      // Check subsections
      for (const section of newSections) {
        if (section.subsections) {
          const subIndex = section.subsections.findIndex(sub => sub.id === draggedId);
          if (subIndex !== -1) {
            draggedSection = section.subsections.splice(subIndex, 1)[0];
            isSubsection = true;
            break;
          }
        }
      }
    }

    if (!draggedSection) {
      console.error('❌ Could not find dragged section:', draggedId);
      return;
    }

    // Find target section and add as subsection
    const targetSection = newSections.find(s => s.id === targetId);
    if (targetSection) {
      if (!targetSection.subsections) {
        targetSection.subsections = [];
      }
      // Convert to subsection
      draggedSection.level = 2;
      targetSection.subsections.push(draggedSection);
      console.log('✅ Section moved to subsection', { draggedId, targetId, wasSubsection: isSubsection });
      addToHistory(newSections);
    }
  };

  // Calculate statistics with detailed debugging
  const stats = {
    total: sections.length,
    kept: sections.filter(s => s.status === 'keep').length,
    suggested_add: sections.filter(s => s.status === 'suggested_add').length,
    suggested_remove: sections.filter(s => s.status === 'suggested_remove').length,
    original: sections.filter(s => s.isOriginal).length,
    custom: sections.filter(s => !s.isOriginal).length
  };

  console.log('📊 Current stats calculation:');
  console.log('- sections array:', sections);
  console.log('- sections.length:', sections.length);
  console.log('- status breakdown:', sections.map(s => ({ title: s.title, status: s.status, isOriginal: s.isOriginal })));
  console.log('- final stats:', stats);

  // If we have no sections but should have them, show loading state
  const isLoading = initialTOC && initialTOC.length > 0 && sections.length === 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Validate Table of Contents
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-3xl mx-auto">
          Review the extracted sections from <strong>{templateName}</strong> for the{' '}
          <strong>{rfqName}</strong> RFQ. Accept, modify, or remove sections as needed.
        </p>
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-blue-50 dark:bg-blue-950 rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
          Analysis Summary {isLoading && <span className="text-sm font-normal">(Loading...)</span>}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ) : (
                stats.total || initialTOC?.length || 0
              )}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Sections</div>
          </div>
          <div className="bg-green-100 dark:bg-green-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-green-200 dark:bg-green-700 rounded"></div>
              ) : (
                stats.kept
              )}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">Keeping</div>
          </div>
          <div className="bg-yellow-100 dark:bg-yellow-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-yellow-200 dark:bg-yellow-700 rounded"></div>
              ) : (
                stats.suggested_add
              )}
            </div>
            <div className="text-sm text-yellow-700 dark:text-yellow-300">AI Suggested</div>
          </div>
          <div className="bg-red-100 dark:bg-red-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-red-200 dark:bg-red-700 rounded"></div>
              ) : (
                stats.suggested_remove
              )}
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">For Removal</div>
          </div>
        </div>

        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
            <div>Debug: initialTOC length: {initialTOC?.length || 0}</div>
            <div>Debug: sections length: {sections.length}</div>
            <div>Debug: isLoading: {isLoading.toString()}</div>
          </div>
        )}
      </motion.div>

      {/* Add Section Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-between items-center"
      >
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Proposal Sections ({sections.length})
          </h3>
          {historyIndex > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Press Ctrl+Z to undo</span>
              <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                {historyIndex} changes
              </span>
            </div>
          )}
        </div>
        <button
          onClick={addSection}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </motion.div>

      {/* Sections List - COMPLETELY REBUILT */}
      <div className="space-y-4">
        {/* Debug section - shows what we actually have */}
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg text-sm">
          <div className="font-medium mb-2">🔍 Debug Info:</div>
          <div>initialTOC length: {initialTOC?.length || 0}</div>
          <div>sections length: {sections.length}</div>
          <div>First initialTOC item: {initialTOC?.[0] ? JSON.stringify(initialTOC[0]) : 'none'}</div>
          <div>First section item: {sections?.[0] ? JSON.stringify(sections[0]) : 'none'}</div>
        </div>

        {/* Show loading state */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                  </div>
                  <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show sections if we have any */}
        {!isLoading && sections.length > 0 && (
          <div className="space-y-2">
            {sections.map((section, index) => {
              console.log(`🔍 Rendering section ${index}:`, section.title, 'has subsections:', !!section.subsections, 'count:', section.subsections?.length || 0);
              return (
                <div key={section.id}>
                  {/* Drop zone above each section - improved */}
                  {draggedSection && draggedSection !== section.id && (
                    <div
                      onDragOver={(e) => handleDragOver(e, section.id, 'gap')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, section.id, 'gap')}
                      className={`h-4 mx-2 rounded transition-all duration-200 ${
                        dragOverSection === section.id && dragOverType === 'gap'
                          ? 'bg-blue-200 dark:bg-blue-800 border-2 border-dashed border-blue-400 shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 opacity-0 hover:opacity-100'
                      } flex items-center justify-center`}
                    >
                      {dragOverSection === section.id && dragOverType === 'gap' && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          Drop here to reorder
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main section */}
                  <div
                    onDragOver={(e) => handleDragOver(e, section.id, 'section')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, section.id, 'section')}
                    className={`
                      bg-white dark:bg-slate-800 rounded-lg border transition-all duration-200 relative
                      ${draggedSection === section.id ? 'opacity-30 transform scale-95' : ''}
                      ${dragOverSection === section.id && dragOverType === 'section' && draggedSection !== section.id
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-950 shadow-lg scale-102'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'}
                    `}
                  >
                    {/* Dedicated drag handle area */}
                    <div
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, section.id)}
                      onDragEnd={handleDragEnd}
                      onMouseDown={(e) => {
                        console.log('🔄 Mouse down on drag handle:', section.id);
                        e.stopPropagation();
                      }}
                      className="absolute left-0 top-0 bottom-0 w-12 cursor-grab active:cursor-grabbing flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors rounded-l-lg group border-r border-slate-300 dark:border-slate-600"
                      title={`Drag to reorder section ${index + 1} or create subsections`}
                      style={{ zIndex: 10 }}
                    >
                      <GripVertical className="w-5 h-5 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" />
                      {/* Debug indicator */}
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Drag handle active"></div>
                    </div>

                    <div className="flex items-start gap-4 ml-12 p-4">
                      {/* Section Number */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {editingId === section.id ? (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDragStart={(e) => e.preventDefault()}
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                              {section.title}
                            </h3>
                            <button
                              onClick={() => startEdit(section.id, section.title)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Reason if provided */}
                        {section.reason && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 italic mb-2">
                            "{section.reason}"
                          </p>
                        )}

                        {/* Visual indicator when being dragged over for subsection */}
                        {dragOverSection === section.id && draggedSection && draggedSection !== section.id && (
                          <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                            → Drop here to make subsection
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                        {section.status === 'suggested_add' && (
                          <>
                            <button
                              onClick={() => updateSectionStatus(section.id, 'keep')}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                            >
                              ✓ Accept
                            </button>
                            <button
                              onClick={() => removeSection(section.id)}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                            >
                              ✗ Reject
                            </button>
                          </>
                        )}

                        {section.status === 'suggested_remove' && (
                          <>
                            <button
                              onClick={() => updateSectionStatus(section.id, 'keep')}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                            >
                              ✓ Keep
                            </button>
                            <button
                              onClick={() => removeSection(section.id)}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                            >
                              ✗ Remove
                            </button>
                          </>
                        )}

                        {section.status === 'keep' && (
                          <button
                            onClick={() => removeSection(section.id)}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="px-3 py-1 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm font-medium"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Display subsections */}
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="ml-16 mt-4 space-y-2">
                        {section.subsections.map((subsection, subIndex) => (
                          <div
                            key={subsection.id}
                            className="bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 relative"
                          >
                            {/* Subsection drag handle */}
                            <div
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, subsection.id)}
                              onDragEnd={handleDragEnd}
                              onMouseDown={(e) => {
                                console.log('🔄 Mouse down on subsection drag handle:', subsection.id);
                                e.stopPropagation();
                              }}
                              className="absolute left-0 top-0 bottom-0 w-8 cursor-grab active:cursor-grabbing flex items-center justify-center bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors rounded-l-md group border-r border-slate-300 dark:border-slate-600"
                              title={`Drag subsection ${index + 1}.${subIndex + 1}`}
                              style={{ zIndex: 10 }}
                            >
                              <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                              {/* Debug indicator for subsection */}
                              <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>

                            <div className="flex items-center gap-3 ml-8 p-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {index + 1}.{subIndex + 1}
                              </div>

                              {/* Editable subsection title */}
                              {editingId === subsection.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditSubsection(section.id, subIndex);
                                      if (e.key === 'Escape') cancelEdit();
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onDragStart={(e) => e.preventDefault()}
                                    className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => saveEditSubsection(section.id, subIndex)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-1">
                                  <h4 className="text-md font-medium text-slate-800 dark:text-slate-200 flex-1">
                                    {subsection.title}
                                  </h4>
                                  <button
                                    onClick={() => startEdit(subsection.id, subsection.title)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center gap-2 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    // Remove subsection and make it a main section
                                    const newSections = [...sections];
                                    const parentSection = newSections.find(s => s.id === section.id);
                                    if (parentSection && parentSection.subsections) {
                                      const removedSub = parentSection.subsections.splice(subIndex, 1)[0];
                                      removedSub.level = 1;
                                      newSections.push(removedSub);
                                      addToHistory(newSections);
                                    }
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  ↗️ Promote
                                </button>
                                <button
                                  onClick={() => {
                                    // Remove subsection entirely
                                    const newSections = [...sections];
                                    const parentSection = newSections.find(s => s.id === section.id);
                                    if (parentSection && parentSection.subsections) {
                                      parentSection.subsections.splice(subIndex, 1);
                                      addToHistory(newSections);
                                    }
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final drop zone at the end */}
            {draggedSection && (
              <div
                onDragOver={(e) => handleDragOver(e, 'end', 'gap')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'end', 'gap')}
                className={`h-6 mx-2 rounded transition-all duration-200 border-2 border-dashed flex items-center justify-center text-sm font-medium ${
                  dragOverSection === 'end' && dragOverType === 'gap'
                    ? 'bg-blue-200 dark:bg-blue-800 border-blue-400 text-blue-600 dark:text-blue-400 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-600'
                }`}
              >
                {dragOverSection === 'end' && dragOverType === 'gap'
                  ? '↓ Drop here to move to end'
                  : 'Drop here to move to end'
                }
              </div>
            )}
          </div>
        )}

        {/* Show empty state only if not loading and no sections */}
        {!isLoading && sections.length === 0 && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-600 dark:text-slate-400 mb-2">
              No sections found
            </h3>
            <p className="text-slate-500 dark:text-slate-500 mb-6">
              The template analysis didn't return any sections, or they failed to process.
            </p>
            <button
              onClick={addSection}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ➕ Add Your First Section
            </button>
          </div>
        )}

        {/* Raw data dump for debugging */}
        {process.env.NODE_ENV === 'development' && (
          <details className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-xs">
            <summary className="font-medium cursor-pointer">🔍 Raw Data (Click to expand)</summary>
            <div className="mt-2 space-y-2">
              <div>
                <strong>initialTOC:</strong>
                <pre className="mt-1 p-2 bg-white dark:bg-slate-900 rounded overflow-auto">
                  {JSON.stringify(initialTOC, null, 2)}
                </pre>
              </div>
              <div>
                <strong>sections:</strong>
                <pre className="mt-1 p-2 bg-white dark:bg-slate-900 rounded overflow-auto">
                  {JSON.stringify(sections, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Bottom summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6"
      >
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Final Structure Summary
        </h4>

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4"></div>
          </div>
        ) : sections.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white dark:bg-slate-700 p-3 rounded-lg">
                <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Final Sections
                </div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.kept}
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs">
                  Will be generated
                </div>
              </div>
              <div className="bg-white dark:bg-slate-700 p-3 rounded-lg">
                <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                  From Template
                </div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {stats.original}
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs">
                  Original structure
                </div>
              </div>
              <div className="bg-white dark:bg-slate-700 p-3 rounded-lg">
                <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Added
                </div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.custom}
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs">
                  User additions
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400">
              Your proposal will include <strong>{stats.kept}</strong> sections total.
              {stats.original > 0 && (
                <> <strong>{stats.original}</strong> sections come from the template.</>
              )}
              {stats.custom > 0 && (
                <> <strong>{stats.custom}</strong> are custom additions.</>
              )}
            </div>

            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <div className="text-sm text-green-800 dark:text-green-200">
                ✅ Ready to proceed with content generation for {stats.kept} sections
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-slate-500 dark:text-slate-400">
              No sections configured yet. Add sections or wait for template analysis to complete.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}