# backend/db.py

import os
import re
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
import chromadb
from chromadb.config import Settings

# -------------------
# Setup
# -------------------
load_dotenv()

CHROMA_DIR = os.getenv("CHROMA_DIR", "./vectorstore")
DATA_FILE = os.getenv("DATA_FILE", "./data.json")

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# -------------------
# Helpers
# -------------------

def safe_collection_name(name: str) -> str:
    """Convert RFQ/folder names into Chroma-safe collection names."""
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    safe = safe.strip("._-")
    if len(safe) < 3:
        safe = f"col_{safe}"
    return safe

def get_chroma(collection: str):
    """Get or create a Chroma vector store for a specific collection."""
    collection = safe_collection_name(collection)
    return Chroma(
        collection_name=collection,
        embedding_function=embeddings,
        persist_directory=CHROMA_DIR
    )

def _chromadb_client():
    """Return a persistent Chroma client regardless of version differences."""
    try:
        # Newer versions
        return chromadb.PersistentClient(path=CHROMA_DIR)
    except TypeError:
        # Older versions
        return chromadb.Client(Settings(persist_directory=CHROMA_DIR))

def drop_collection(collection: str) -> bool:
    """
    Hard-drop an entire Chroma collection and clean up disk files.
    Works across Chroma versions by trying delete_collection,
    and falling back to deleting all IDs then dropping.
    """
    import shutil
    import glob
    
    name = safe_collection_name(collection)
    client = _chromadb_client()
    try:
        client.delete_collection(name)  # preferred path
        print(f"✅ Successfully dropped collection: {name}")
    except Exception as e:
        # Fall back: get collection, delete all IDs, then drop again
        try:
            col = client.get_collection(name)
        except Exception as e2:
            print(f"[drop_collection] No collection to drop: {name} ({e2})")
            # Still try to clean up any leftover files
            _cleanup_collection_files(name)
            return False

        try:
            data = col.get()  # no filters -> all docs
            ids = data.get("ids", [])
            if ids:
                col.delete(ids=ids)
                print(f"🗑️ Deleted {len(ids)} documents from collection: {name}")
            # try drop again (some versions require to be empty first)
            try:
                client.delete_collection(name)
                print(f"✅ Successfully dropped emptied collection: {name}")
            except Exception as e3:
                print(f"[drop_collection] Could not delete empty collection {name}: {e3}")
        except Exception as e4:
            print(f"[drop_collection] Failed to purge collection {name}: {e4}")
    
    # Clean up any remaining disk files
    _cleanup_collection_files(name)
    return True

def _cleanup_collection_files(collection_name: str):
    """Clean up physical vectorstore files for a collection."""
    import shutil
    import glob
    
    try:
        # Look for collection-specific directories/files in vectorstore
        collection_patterns = [
            os.path.join(CHROMA_DIR, f"*{collection_name}*"),
            os.path.join(CHROMA_DIR, collection_name),
            os.path.join(CHROMA_DIR, "**", f"*{collection_name}*")
        ]
        
        files_removed = 0
        for pattern in collection_patterns:
            matches = glob.glob(pattern, recursive=True)
            for match in matches:
                try:
                    if os.path.isdir(match):
                        shutil.rmtree(match)
                        print(f"🗂️ Removed directory: {match}")
                    else:
                        os.remove(match)
                        print(f"📄 Removed file: {match}")
                    files_removed += 1
                except Exception as e:
                    print(f"⚠️ Could not remove {match}: {e}")
        
        if files_removed > 0:
            print(f"🧹 Cleaned up {files_removed} vectorstore files for collection: {collection_name}")
        else:
            print(f"ℹ️ No vectorstore files found to clean for collection: {collection_name}")
            
    except Exception as e:
        print(f"⚠️ Error during file cleanup for collection {collection_name}: {e}")

# -------------------
# Metadata persistence
# -------------------

def load_data() -> Dict[str, Any]:
    if not os.path.exists(DATA_FILE):
        return {"rfqs": [], "database": []}
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
        # Migration: convert old "dbFolders" to "database" if needed
        if "dbFolders" in data and "database" not in data:
            data["database"] = data.pop("dbFolders")
        return data

def save_data(data: Dict[str, Any]):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# -------------------
# Document management
# -------------------

def add_documents(docs, collection: str):
    """Add new chunks to Chroma under a specific collection, skipping duplicates by hash."""
    print(f"🔍 Starting add_documents for collection: {collection}")
    db = get_chroma(collection)

    # Extract unique hashes from new docs
    new_hashes = {d.metadata.get("hash") for d in docs if "hash" in d.metadata}
    print(f"📊 New documents: {len(docs)}, unique hashes: {len(new_hashes)}")

    existing_hashes = set()
    if new_hashes:
        try:
            existing = db.get(where={"hash": {"$in": list(new_hashes)}})
            existing_hashes = {m.get("hash") for m in existing["metadatas"] if "hash" in m}
            print(f"🔍 Found {len(existing_hashes)} existing documents with matching hashes")
            
            # DEBUG: Print the hashes for comparison
            print(f"🆔 New hashes: {sorted(list(new_hashes))[:3]}...")
            print(f"🆔 Existing hashes: {sorted(list(existing_hashes))[:3]}...")
            
            # DEBUG: Check if the collection is actually empty
            try:
                client = _chromadb_client()
                col = client.get_collection(safe_collection_name(collection))
                total_count = col.count()
                print(f"📊 Collection currently contains {total_count} total documents")
                if total_count == 0:
                    print("❗ Collection is empty but duplicate check found matches - this is a bug!")
                    existing_hashes = set()  # Force empty if collection is actually empty
            except Exception as count_error:
                print(f"⚠️ Could not check collection count: {count_error}")
                
        except Exception as e:
            print(f"⚠️ Failed duplicate check: {e}")

    unique_docs = [d for d in docs if d.metadata.get("hash") not in existing_hashes]
    skipped = len(docs) - len(unique_docs)
    print(f"📝 Will add {len(unique_docs)} new documents, skip {skipped} duplicates")

    if unique_docs:
        print(f"🚀 Adding {len(unique_docs)} documents to Chroma...")
        
        # Test embedding generation before adding
        print(f"🧠 Testing embedding generation...")
        try:
            test_text = unique_docs[0].page_content[:200]  # Test with first chunk
            test_embedding = embeddings.embed_query(test_text)
            print(f"✅ Embedding test successful: {len(test_embedding)} dimensions")
            print(f"   Sample embedding values: {test_embedding[:3]}...")
        except Exception as e:
            print(f"❌ Embedding generation failed: {e}")
            return {"added": 0, "skipped": len(docs), "error": f"Embedding generation failed: {e}"}
        
        try:
            db.add_documents(unique_docs)
            db.persist()
            print(f"✅ Successfully added documents to collection: {collection}")
            
            # Verify the addition worked AND embeddings were stored
            try:
                client = _chromadb_client()
                col = client.get_collection(safe_collection_name(collection))
                total_count = col.count()
                print(f"📊 Collection now contains {total_count} total chunks")
                
                # Verify embeddings are actually stored
                sample_data = col.get(limit=1, include=["embeddings", "documents", "metadatas"])
                if sample_data.get("embeddings") and len(sample_data["embeddings"]) > 0:
                    emb = sample_data["embeddings"][0]
                    if emb and len(emb) > 0:
                        import numpy as np
                        emb_norm = np.linalg.norm(emb)
                        print(f"🧠 Embedding verification: {len(emb)} dims, norm: {emb_norm:.3f}")
                        print(f"   Sample values: {emb[:3]}...")
                    else:
                        print(f"⚠️ Warning: Embeddings are empty or null!")
                else:
                    print(f"⚠️ Warning: No embeddings found in stored data!")
                    
            except Exception as e:
                print(f"⚠️ Could not verify collection count/embeddings: {e}")
                
        except Exception as e:
            print(f"❌ Failed to add documents: {e}")
            return {"added": 0, "skipped": len(docs), "error": str(e)}
    else:
        print(f"ℹ️ No new documents to add to collection: {collection}")

    return {"added": len(unique_docs), "skipped": skipped}


def search(query: str, k: int = 5, collection: str = "global"):
    """Search top-k documents in a given collection."""
    db = get_chroma(collection)
    return db.similarity_search(query, k=k)

def inspect_collection(collection: str) -> Dict[str, Any]:
    """
    Inspect a collection to verify ingestion and embeddings.
    Returns detailed information about the collection contents.
    """
    try:
        client = _chromadb_client()
        name = safe_collection_name(collection)
        
        # Get collection info
        try:
            col = client.get_collection(name)
        except Exception as e:
            return {
                "status": "error",
                "message": f"Collection '{name}' not found: {e}",
                "collection": name
            }
        
        # Get all documents in collection
        data = col.get(include=["metadatas", "documents", "embeddings"])
        
        # Analyze the data
        total_chunks = len(data.get("ids", []))
        documents = data.get("documents", [])
        metadatas = data.get("metadatas", [])
        embeddings = data.get("embeddings", [])
        
        # Group by source file
        sources = {}
        for i, metadata in enumerate(metadatas):
            source = metadata.get("source", "unknown")
            if source not in sources:
                sources[source] = {
                    "chunks": 0,
                    "total_chars": 0,
                    "sample_chunks": []
                }
            sources[source]["chunks"] += 1
            if documents and i < len(documents):
                sources[source]["total_chars"] += len(documents[i])
                if len(sources[source]["sample_chunks"]) < 2:
                    sources[source]["sample_chunks"].append({
                        "index": i,
                        "chars": len(documents[i]),
                        "preview": documents[i][:100] + "..." if len(documents[i]) > 100 else documents[i],
                        "hash": metadata.get("hash", "no-hash")[:8] + "...",
                        "has_embedding": i < len(embeddings) and embeddings[i] is not None
                    })
        
        # Check embedding dimensions
        embedding_info = {
            "has_embeddings": len(embeddings) > 0,
            "embedding_count": len(embeddings),
            "dimension": len(embeddings[0]) if embeddings and embeddings[0] else 0,
            "sample_embedding_norm": None
        }
        
        if embeddings and embeddings[0]:
            import numpy as np
            embedding_info["sample_embedding_norm"] = float(np.linalg.norm(embeddings[0]))
        
        return {
            "status": "success",
            "collection": name,
            "total_chunks": total_chunks,
            "unique_sources": len(sources),
            "sources": sources,
            "embedding_info": embedding_info,
            "sample_metadata": metadatas[:3] if metadatas else []
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to inspect collection: {e}",
            "collection": collection
        }

def delete_documents(collection: str, source: Optional[str] = None, file_hash: Optional[str] = None) -> int:
    """
    Delete all chunks for a given filename or hash from Chroma + metadata.
    Either `source` (filename) or `file_hash` must be provided.
    Returns number of deletions requested (not guaranteed).
    """
    print(f"🗑️ Starting deletion from collection: {collection}")
    if source:
        print(f"📄 Deleting chunks for file: {source}")
    if file_hash:
        print(f"🔗 Deleting chunks for hash: {file_hash}")
        
    db = get_chroma(collection)

    if not source and not file_hash:
        raise ValueError("delete_documents requires source filename or file_hash")

    where = {}
    if source:
        where["source"] = source
    if file_hash:
        where["hash"] = file_hash

    # First, get the documents that will be deleted for logging
    chunks_to_delete = 0
    try:
        existing = db.get(where=where)
        chunks_to_delete = len(existing.get("ids", []))
        
        if chunks_to_delete > 0:
            print(f"🔍 Found {chunks_to_delete} chunks to delete")
            # Log sample of what's being deleted
            docs = existing.get("documents", [])
            metas = existing.get("metadatas", [])
            for i in range(min(3, chunks_to_delete)):
                if i < len(docs) and i < len(metas):
                    preview = docs[i][:100] + "..." if len(docs[i]) > 100 else docs[i]
                    chunk_hash = metas[i].get("hash", "no-hash")[:8] + "..."
                    print(f"   🧩 Chunk {i}: {len(docs[i])} chars, hash: {chunk_hash}")
                    print(f"      Preview: {preview}")
        else:
            print(f"ℹ️ No chunks found matching deletion criteria")
            
    except Exception as e:
        print(f"⚠️ Failed to query chunks before deletion: {e}")

    # Now delete them
    try:
        db.delete(where=where)
        db.persist()
        print(f"✅ Successfully deleted {chunks_to_delete} chunks from collection: {collection}")
        
        # Verify deletion worked
        try:
            client = _chromadb_client()
            col = client.get_collection(safe_collection_name(collection))
            total_count = col.count()
            print(f"📊 Collection now contains {total_count} total chunks")
        except Exception as e:
            print(f"⚠️ Could not verify collection count after deletion: {e}")
            
    except Exception as e:
        print(f"❌ Failed to delete docs from {collection}: {e}")

    # also update metadata file
    data = load_data()
    if collection.startswith("rfq_"):
        for rfq in data["rfqs"]:
            if safe_collection_name("rfq_" + rfq["name"]) == collection:
                # remove from both mainDocument and supportingDocuments
                if source and rfq.get("mainDocument") == source:
                    rfq["mainDocument"] = ""
                    print(f"📝 Removed {source} as main document from RFQ: {rfq['name']}")
                if source and source in rfq.get("supportingDocuments", []):
                    rfq["supportingDocuments"].remove(source)
                    print(f"📝 Removed {source} from supporting documents of RFQ: {rfq['name']}")
    elif collection.startswith("db_"):
        for folder in data.get("database", []):
            if safe_collection_name("db_" + folder["name"]) == collection:
                if source:
                    original_count = len(folder["files"])
                    folder["files"] = [f for f in folder["files"] if f["name"] != source]
                    removed_count = original_count - len(folder["files"])
                    print(f"📝 Removed {removed_count} file entries from folder: {folder['name']}")
    save_data(data)
    return chunks_to_delete


# -------------------
# Metadata helpers
# -------------------

def add_rfq(rfq: Dict[str, Any]):
    """
    Add a new RFQ entry to metadata.
    Expected structure:
    {
      "name": str,
      "client": str,
      "dueDate": str,
      "mainDocument": str,
      "supportingDocuments": [str]
    }
    """
    data = load_data()
    existing = next((r for r in data["rfqs"] if r["name"] == rfq["name"]), None)
    if existing:
        existing.update(rfq)
    else:
        data["rfqs"].append(rfq)
    save_data(data)
    return rfq

def add_file_to_rfq(rfq_name: str, filename: str, is_main: bool = False):
    data = load_data()
    for rfq in data["rfqs"]:
        if rfq["name"] == rfq_name:
            if is_main:
                rfq["mainDocument"] = filename
            else:
                if rfq.get("mainDocument") == filename:
                    return {"status": "error", "reason": "File is already set as mainDocument"}
                rfq.setdefault("supportingDocuments", [])
                if filename not in rfq["supportingDocuments"]:
                    rfq["supportingDocuments"].append(filename)
    save_data(data)
    return {"status": "success", "file": filename}

def add_file_to_folder(folder_name: str, file_entry: Dict[str, Any]):
    """Track uploaded file under a DB folder."""
    data = load_data()
    database_folders = data.get("database", [])
    
    for folder in database_folders:
        if folder["name"] == folder_name:
            folder["files"].append(file_entry)
            break
    else:
        # Folder doesn't exist, create it
        database_folders.append({"name": folder_name, "files": [file_entry]})
        data["database"] = database_folders
    save_data(data)

def get_rfqs() -> List[Dict[str, Any]]:
    return load_data()["rfqs"]

def get_db_folders() -> List[Dict[str, Any]]:
    """Get all database folders with their files."""
    data = load_data()
    
    # Initialize default folders if database section doesn't exist or is empty
    if "database" not in data or len(data["database"]) == 0:
        data["database"] = [
            {"name": "Templates", "files": []},
            {"name": "Legal", "files": []},
            {"name": "Security", "files": []}
        ]
        save_data(data)
        print("📁 Created default database folders: Templates, Legal, Security")
    
    return data["database"]

def delete_rfq(rfq_name: str):
    """Delete an RFQ completely from metadata."""
    data = load_data()
    data["rfqs"] = [r for r in data["rfqs"] if r["name"] != rfq_name]
    save_data(data)
    return {"status": "success", "deleted": rfq_name}
