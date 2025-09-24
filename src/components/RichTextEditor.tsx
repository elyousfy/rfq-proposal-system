import React, { useMemo, useState, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Global state for ReactQuill to avoid re-importing
let globalReactQuill: any = null;
let loadingPromise: Promise<any> | null = null;

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [isReady, setIsReady] = useState(!!globalReactQuill);
  const [isLoading, setIsLoading] = useState(!globalReactQuill);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we already have ReactQuill loaded, use it
    if (globalReactQuill) {
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    // If we're already loading, wait for the existing promise
    if (loadingPromise) {
      loadingPromise
        .then(() => {
          setIsReady(true);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
      return;
    }

    // Start loading ReactQuill
    setIsLoading(true);
    loadingPromise = import('react-quill')
      .then((module) => {
        console.log('ReactQuill loaded successfully');
        globalReactQuill = module.default;
        setIsReady(true);
        setIsLoading(false);
        loadingPromise = null;
      })
      .catch((err) => {
        console.error('Failed to load ReactQuill:', err);
        setError(err.message);
        setIsLoading(false);
        loadingPromise = null;
        throw err;
      });
  }, []);

  // Configure Quill modules for proposal writing
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['blockquote', 'code-block'],
      [{ 'align': [] }],
      ['link'],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
    history: {
      delay: 1000,
      maxStack: 50,
      userOnly: false
    }
  }), []);

  // Configure formats allowed in the editor
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video',
    'align', 'color', 'background',
    'code-block'
  ];

  // Show loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="mb-2 font-medium">Loading Rich Text Editor</div>
          <div className="text-sm">This may take a moment...</div>
        </div>
      </div>
    );
  }

  // Show error state with fallback textarea
  if (error || (!isReady && !isLoading)) {
    return (
      <div className={className}>
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800 mb-2">
            <strong>Rich text editor unavailable.</strong> Using fallback text editor.
          </div>
          {error && (
            <div className="text-xs text-yellow-600">
              Error: {error}
            </div>
          )}
        </div>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Start writing your proposal section...'}
          className="w-full h-80 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          style={{ minHeight: '320px' }}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {globalReactQuill && React.createElement(globalReactQuill, {
        theme: "snow",
        value: value || '',
        onChange: onChange,
        modules: modules,
        formats: formats,
        placeholder: placeholder || 'Start writing your proposal section...',
        style: {
          height: '400px',
          backgroundColor: 'white'
        }
      })}
    </div>
  );
}

// Utility function to convert HTML to plain text for word counting
export function getTextFromHtml(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}

// Utility function to get word count from HTML content
export function getWordCount(html: string): number {
  const text = getTextFromHtml(html);
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}