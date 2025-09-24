# RFQ Bot System Features Summary

## Main Navigation Pages

### 1. Proposal Page
- **RFQ Selection**: Select active RFQ from dropdown to link proposal content
- **Section Management**:
  - Add new sections with customizable titles
  - Delete existing sections
  - Select and edit individual sections
  - Rich text editing with markdown support
- **AI Features**:
  - Generate full proposal draft from selected RFQ
  - AI rewrite sections with different tones (concise, formal, marketing)
  - Fill compliance matrix automatically from RFQ requirements
- **Template System**:
  - Apply Table of Contents (TOC) templates to structure proposals
  - Use learned proposal structures from previous documents
- **Variable Management**:
  - Define and manage proposal variables for dynamic content
- **Export Options**:
  - Export to PDF format
  - Export to DOCX format
- **Version Control**:
  - Save proposal versions with custom labels
  - Track proposal modifications with timestamps
- **Evaluation Tools**:
  - Open evaluator for proposal quality assessment
  - Target evaluation on whole proposal or specific sections

### 2. RFQ Bot (Chat) Page
- **Context Selection**: Choose active RFQ for targeted questioning
- **Interactive Chat**:
  - Ask questions about RFQ documents
  - Get AI-powered answers with citations
  - View conversation history
  - Real-time loading indicators
- **Document Search**: Search across ingested RFQ documents for relevant information

### 3. Documents Page
#### RFQ Management Mode
- **RFQ Operations**:
  - Create new RFQs with metadata (name, client, due date)
  - Upload main RFQ documents
  - Add supporting documents to existing RFQs
  - View and download RFQ files
  - Delete individual files or entire RFQs
- **File Management**:
  - Drag-and-drop file uploads
  - File preview capabilities
  - Document ingestion for AI processing
- **RFQ Metadata Extraction**: Automatic extraction of RFQ details from uploaded documents

#### Database Management Mode
- **Folder Operations**:
  - Create new database folders for document organization
  - Upload files to specific folders
  - Browse folder contents
- **File Operations**:
  - View uploaded files
  - Download files
  - Delete files from folders
- **Bulk Upload**: Support for multiple file uploads per folder

### 4. Evaluator Page
- **RFQ Selection**: Choose RFQ for evaluation analysis
- **Value Assessment**:
  - Set estimated project value in USD
  - Visual value gauge with percentage indicators
- **AI Evaluation**:
  - Run comprehensive RFQ analysis
  - Extract objectives, deliverables, constraints, risks
  - Identify success criteria and stakeholders
  - Analyze scope and compliance standards
- **Evaluation Management**:
  - Save evaluation results for future reference
  - Load previously saved evaluations
  - View evaluation history with timestamps
- **Results Display**:
  - Structured evaluation results in expandable sections
  - Value band classification (based on project size)
  - Summary statistics and key insights

## Additional Features

### TOC Template System
- **Template Creation**: Extract table of contents from DOCX files
- **Template Application**: Apply saved TOC structures to new proposals
- **Template Management**: View and manage saved TOC templates

### Proposal Learning System
- **Document Analysis**: Learn from existing proposal documents
- **Template Generation**: Create reusable templates from successful proposals
- **Client-Specific Templates**: Organize templates by client type and industry

### File Processing
- **Multiple Formats**: Support for PDF, DOCX, TXT, and other document types
- **Text Extraction**: Automatic text extraction from various file formats
- **Encoding Handling**: Robust handling of different file encodings

### Integration Features
- **OpenAI Integration**: Powered by GPT models for AI-generated content
- **Vector Database**: ChromaDB for document embeddings and search
- **Real-time Updates**: Live updates across different pages and components
- **Error Handling**: Comprehensive error handling with user-friendly messages

### Data Persistence
- **Local Storage**: Save user preferences and session state
- **Backend Storage**: Persistent storage of RFQs, evaluations, and templates
- **Version History**: Track changes and maintain proposal versions