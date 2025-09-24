import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Link,
  Quote
} from 'lucide-react';

interface SimpleRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SimpleRichTextEditor({ value, onChange, placeholder, className }: SimpleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      editorRef.current.innerHTML = value || '';
      setIsInitialized(true);
    }
  }, [value, isInitialized]);

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const toolbar = [
    { icon: Bold, command: 'bold', title: 'Bold' },
    { icon: Italic, command: 'italic', title: 'Italic' },
    { icon: Underline, command: 'underline', title: 'Underline' },
    { icon: List, command: 'insertUnorderedList', title: 'Bullet List' },
    { icon: ListOrdered, command: 'insertOrderedList', title: 'Numbered List' },
    { icon: AlignLeft, command: 'justifyLeft', title: 'Align Left' },
    { icon: AlignCenter, command: 'justifyCenter', title: 'Align Center' },
    { icon: AlignRight, command: 'justifyRight', title: 'Align Right' },
    { icon: Quote, command: 'formatBlock', value: 'blockquote', title: 'Quote' },
  ];

  return (
    <div className={`border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 ${className}`}>
      {/* Toolbar */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex flex-wrap gap-2">
        <select
          onChange={(e) => executeCommand('formatBlock', e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 mr-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue=""
        >
          <option value="">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="p">Paragraph</option>
        </select>

        {toolbar.map((tool, index) => (
          <button
            key={index}
            type="button"
            onClick={() => tool.value ? executeCommand(tool.command, tool.value) : executeCommand(tool.command)}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            title={tool.title}
          >
            <tool.icon size={16} />
          </button>
        ))}

        <button
          type="button"
          onClick={insertLink}
          className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          title="Insert Link"
        >
          <Link size={16} />
        </button>

        <div className="ml-auto flex gap-2">
          <select
            onChange={(e) => executeCommand('fontSize', e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue="3"
          >
            <option value="1">Small</option>
            <option value="2">Normal</option>
            <option value="3">Medium</option>
            <option value="4">Large</option>
            <option value="5">XL</option>
            <option value="6">XXL</option>
            <option value="7">Huge</option>
          </select>

          <input
            type="color"
            onChange={(e) => executeCommand('foreColor', e.target.value)}
            className="w-10 h-9 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 cursor-pointer"
            title="Text Color"
            defaultValue="#000000"
          />
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-80 focus:outline-none simple-rich-editor bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
        style={{ minHeight: '320px' }}
        data-placeholder={placeholder || 'Start writing your proposal section...'}
        suppressContentEditableWarning={true}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
          .simple-rich-editor:empty:before {
            content: attr(data-placeholder);
            color: #94a3b8;
            font-style: italic;
            pointer-events: none;
          }
          .dark .simple-rich-editor:empty:before {
            color: #64748b;
          }
          .simple-rich-editor:focus:empty:before {
            opacity: 0.5;
          }
          
          /* Rich text editor content styling */
          .simple-rich-editor h1 {
            font-size: 2em;
            font-weight: bold;
            margin: 0.67em 0;
          }
          .simple-rich-editor h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.75em 0;
          }
          .simple-rich-editor h3 {
            font-size: 1.17em;
            font-weight: bold;
            margin: 0.83em 0;
          }
          .simple-rich-editor h4 {
            font-size: 1em;
            font-weight: bold;
            margin: 1em 0;
          }
          .simple-rich-editor blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 1rem;
            margin: 1rem 0;
            font-style: italic;
            color: #64748b;
          }
          .dark .simple-rich-editor blockquote {
            color: #94a3b8;
          }
          .simple-rich-editor ul {
            list-style-type: disc;
            padding-left: 2rem;
            margin: 1rem 0;
          }
          .simple-rich-editor ol {
            list-style-type: decimal;
            padding-left: 2rem;
            margin: 1rem 0;
          }
          .simple-rich-editor li {
            margin: 0.25rem 0;
          }
          .simple-rich-editor a {
            color: #3b82f6;
            text-decoration: underline;
          }
          .dark .simple-rich-editor a {
            color: #60a5fa;
          }
          .simple-rich-editor p {
            margin: 0.5rem 0;
          }
        `
      }} />
    </div>
  );
}

// Utility functions
export function getTextFromHtml(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}

export function getWordCount(html: string): number {
  const text = getTextFromHtml(html);
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}