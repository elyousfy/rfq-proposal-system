# backend/ingestion.py

import os
import glob
import zipfile
import hashlib
from typing import List

from langchain_community.document_loaders import Docx2txtLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

# Use pypdf directly to avoid warnings
try:
    import pypdf
    
    class QuietPyPDFLoader:
        """Custom PDF loader using pypdf to avoid warnings."""
        def __init__(self, file_path: str):
            self.file_path = file_path
        
        def load(self) -> List[Document]:
            docs = []
            try:
                with open(self.file_path, 'rb') as file:
                    pdf_reader = pypdf.PdfReader(file)
                    for page_num, page in enumerate(pdf_reader.pages):
                        text = page.extract_text()
                        if text.strip():
                            docs.append(Document(
                                page_content=text,
                                metadata={
                                    "source": self.file_path,
                                    "page": page_num + 1
                                }
                            ))
            except Exception as e:
                print(f"Error reading PDF {self.file_path}: {e}")
            return docs
            
except ImportError:
    # Fallback to langchain's PyPDFLoader
    from langchain_community.document_loaders.pdf import PyPDFLoader as QuietPyPDFLoader

from utils import excel_to_text
from db import add_documents


def load_one(path: str) -> List[Document]:
    """
    Load a single file into a list of LangChain Document objects.
    Supports PDF, DOCX, TXT, and XLSX.
    """
    path_low = path.lower()
    if path_low.endswith(".pdf"):
        return QuietPyPDFLoader(path).load()
    if path_low.endswith(".docx"):
        return Docx2txtLoader(path).load()
    if path_low.endswith(".txt") or path_low.endswith(".md"):
        return TextLoader(path, encoding="utf-8").load()
    if path_low.endswith(".xlsx") or path_low.endswith(".xls"):
        content = excel_to_text(path)
        return [Document(page_content=content, metadata={"source": os.path.basename(path)})]
    return []


def load_folder(folder: str) -> List[Document]:
    """
    Load all supported files inside a folder (recursively).
    """
    exts = ("*.pdf", "*.docx", "*.txt", "*.md", "*.xlsx", "*.xls")
    files = []
    for e in exts:
        files.extend(glob.glob(os.path.join(folder, "**", e), recursive=True))

    docs = []
    for f in files:
        docs.extend(load_one(f))
    return docs


def unzip_if_needed(path: str, target_dir: str) -> List[str]:
    """
    If the uploaded file is a ZIP, extract it to target_dir.
    Returns the list of extracted file paths.
    """
    if not path.lower().endswith(".zip"):
        return [path]

    with zipfile.ZipFile(path, "r") as z:
        z.extractall(target_dir)
    return glob.glob(os.path.join(target_dir, "**"), recursive=True)


def split_docs(docs: List[Document], chunk_size: int = 1200, chunk_overlap: int = 200) -> List[Document]:
    """
    Split docs into manageable chunks for embeddings.
    """
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return splitter.split_documents(docs)


def file_hash(path: str) -> str:
    """Generate a stable hash for a file (MD5)."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def ingest_paths(paths: List[str], upload_dir: str = "./uploads", collection: str = "global") -> dict:
    """
    Main entrypoint for ingestion:
    Returns dict {added, skipped}
    """
    print(f"🔄 Starting ingestion for collection: {collection}")
    print(f"📁 Paths to process: {paths}")
    
    os.makedirs(upload_dir, exist_ok=True)
    all_docs: List[Document] = []

    for p in paths:
        print(f"📄 Processing path: {p}")
        if os.path.isdir(p):
            folder_docs = load_folder(p)
            print(f"📂 Loaded {len(folder_docs)} documents from folder")
            all_docs.extend(folder_docs)
        else:
            extracted = unzip_if_needed(p, upload_dir)
            for f in extracted:
                if os.path.isfile(f):
                    print(f"📋 Loading file: {os.path.basename(f)}")
                    docs = load_one(f)
                    print(f"   → Extracted {len(docs)} pages/sections")
                    for d in docs:
                        d.metadata["source"] = os.path.basename(f)
                        print(f"   → Page content length: {len(d.page_content)} chars")
                    all_docs.extend(docs)

    print(f"📊 Total documents loaded: {len(all_docs)}")
    
    chunks = split_docs(all_docs)
    print(f"✂️ Split into {len(chunks)} chunks")
    
    # Assign unique hash to each chunk after splitting
    for i, chunk in enumerate(chunks):
        chunk_content = f"{chunk.page_content}{chunk.metadata.get('source', '')}"
        chunk.metadata["hash"] = hashlib.md5(chunk_content.encode()).hexdigest()
        chunk.metadata["chunk_index"] = i
        if i < 3:  # Log first 3 chunks for verification
            print(f"   🧩 Chunk {i}: {len(chunk.page_content)} chars, hash: {chunk.metadata['hash'][:8]}...")
    
    print(f"🎯 Adding chunks to collection: {collection}")
    result = add_documents(chunks, collection=collection)
    print(f"✅ Ingestion complete: {result}")
    
    return result



if __name__ == "__main__":
    # For quick CLI test: python ingestion.py ./sample_rfp.pdf
    import sys
    count = ingest_paths(sys.argv[1:])
    print(f"Ingested {count} chunks")
