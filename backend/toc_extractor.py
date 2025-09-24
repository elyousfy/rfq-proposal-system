# backend/toc_extractor.py

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from docx import Document
from pathlib import Path
from db import load_data, save_data

def extract_toc_from_docx(docx_path):
    """Extract headings and subheadings from a DOCX file."""
    doc = Document(docx_path)
    toc = []

    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ""
        text = para.text.strip()
        if not text:
            continue

        # Detect heading levels based on style name
        if style_name.startswith("Heading 1"):
            toc.append({"level": 1, "title": text})
        elif style_name.startswith("Heading 2"):
            toc.append({"level": 2, "title": text})
        elif style_name.startswith("Heading 3"):
            toc.append({"level": 3, "title": text})

    return toc

def extract_full_template_structure(docx_path):
    """Extract both TOC structure and actual content from each section."""
    doc = Document(docx_path)
    sections = []
    current_section = None

    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ""
        text = para.text.strip()

        # Check if this is a heading
        if style_name.startswith("Heading"):
            # Save previous section if exists
            if current_section:
                sections.append(current_section)

            # Start new section
            level = 1
            if style_name.startswith("Heading 1"):
                level = 1
            elif style_name.startswith("Heading 2"):
                level = 2
            elif style_name.startswith("Heading 3"):
                level = 3

            current_section = {
                "level": level,
                "title": text,
                "content": []
            }
        elif current_section and text:
            # Add content to current section
            current_section["content"].append(text)

    # Don't forget the last section
    if current_section:
        sections.append(current_section)

    return sections

def extract_template_with_content(docx_path):
    """Extract full template including content, tables, and formatting."""
    doc = Document(docx_path)
    template_data = {
        "sections": [],
        "tables": [],
        "full_content": ""
    }

    current_section = None
    section_content = []

    # Process paragraphs
    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ""
        text = para.text.strip()

        # Check if this is a heading
        if style_name.startswith("Heading"):
            # Save previous section
            if current_section:
                current_section["content_text"] = "\n".join(section_content)
                template_data["sections"].append(current_section)

            # Start new section
            level = 1
            if style_name.startswith("Heading 1"):
                level = 1
            elif style_name.startswith("Heading 2"):
                level = 2
            elif style_name.startswith("Heading 3"):
                level = 3

            current_section = {
                "level": level,
                "title": text,
                "content_paragraphs": [],
                "content_text": ""
            }
            section_content = []
        elif text and current_section:
            # Add content to current section
            current_section["content_paragraphs"].append(text)
            section_content.append(text)

    # Don't forget the last section
    if current_section:
        current_section["content_text"] = "\n".join(section_content)
        template_data["sections"].append(current_section)

    # Process tables
    for table in doc.tables:
        table_data = []
        for row in table.rows:
            row_data = []
            for cell in row.cells:
                row_data.append(cell.text.strip())
            table_data.append(row_data)
        template_data["tables"].append(table_data)

    # Create full content string
    all_text = []
    for para in doc.paragraphs:
        if para.text.strip():
            all_text.append(para.text.strip())
    template_data["full_content"] = "\n".join(all_text)

    return template_data

def print_toc(toc):
    """Print the extracted TOC to terminal with indentation."""
    for entry in toc:
        indent = "    " * (entry["level"] - 1)
        print(f"{indent}- {entry['title']}")

def build_section_tree_with_parents(toc: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Add parent indices to a flat TOC list that contains `level` and `title`."""
    stack = []  # (level, index_in_tree)
    section_tree: List[Dict[str, Any]] = []
    for idx, entry in enumerate(toc):
        level = int(entry.get("level", 1))
        parent_idx = None
        while stack and stack[-1][0] >= level:
            stack.pop()
        if stack:
            parent_idx = stack[-1][1]
        node = {
            "title": entry["title"],
            "level": level,
            "order": idx,
            "parent": parent_idx,
        }
        section_tree.append(node)
        stack.append((level, idx))
    return section_tree

def save_toc_template(template_data: Dict[str, Any], template_name: str = None) -> str:
    """Save a TOC template for reuse."""
    data = load_data()

    if "toc_templates" not in data:
        data["toc_templates"] = []

    # Generate template ID and name
    template_id = f"template_{len(data['toc_templates']) + 1}"

    if not template_name:
        # Auto-generate name based on structure
        total_sections = len(template_data.get('section_tree', []))
        template_name = f"Template {chr(65 + len(data['toc_templates']))} ({total_sections} sections)"

    # Create template object
    template = {
        "id": template_id,
        "name": template_name,
        "section_tree": template_data.get('section_tree', []),
        "source_file": template_data.get('source_file', ''),
        "metadata": {
            "total_sections": len(template_data.get('section_tree', [])),
            "max_depth": max([s.get('level', 1) for s in template_data.get('section_tree', [])], default=0),
            "created_at": datetime.now().isoformat()
        }
    }

    data["toc_templates"].append(template)
    save_data(data)

    print(f"✅ Saved TOC template: {template_name} (ID: {template_id})")
    return template_id

def get_toc_templates() -> List[Dict[str, Any]]:
    """Get all available TOC templates."""
    data = load_data()
    return data.get("toc_templates", [])

def apply_toc_template(template_id: str, proposal_title: str = "New Proposal") -> List[Dict[str, Any]]:
    """Apply a TOC template to create proposal sections with proper subsection support."""
    templates = get_toc_templates()
    template = next((t for t in templates if t["id"] == template_id), None)

    if not template:
        return []

    sections = []
    section_tree = template.get("section_tree", [])

    # Create sections with subsection relationships
    for i, section in enumerate(section_tree):
        section_data = {
            "id": f"section_{i+1}",
            "title": section.get("title", f"Section {i+1}"),
            "contentMd": "",
            "contentHtml": "",
            "locked": False,
            "template_source": template_id,
            "level": section.get("level", 1),
            "order": section.get("order", i),
            "parent": section.get("parent")
        }

        # Add subsections if this section has children
        subsections = []
        for j, child_section in enumerate(section_tree):
            if child_section.get("parent") == i:
                subsections.append({
                    "id": f"subsection_{i+1}_{j+1}",
                    "title": child_section.get("title", f"Subsection {j+1}"),
                    "contentMd": "",
                    "contentHtml": "",
                    "locked": False,
                    "level": child_section.get("level", 2),
                    "parent_id": section_data["id"]
                })

        if subsections:
            section_data["subsections"] = subsections

        sections.append(section_data)

    return sections

def learn_toc_from_file(file_path: str, filename: str, template_name: str = None) -> Dict[str, Any]:
    """Complete workflow to learn TOC and content from a DOCX file and save as template."""
    print(f"🎯 Learning template structure and content from {filename}")

    try:
        # Only support DOCX files for direct extraction
        if not filename.lower().endswith('.docx'):
            return {"error": "Only DOCX files are supported for template extraction"}

        # Extract TOC structure (for compatibility)
        toc = extract_toc_from_docx(file_path)

        if not toc:
            return {"error": "No heading styles found in the document. Please ensure the document uses Heading 1, 2, 3... styles."}

        print(f"📑 Extracted {len(toc)} heading levels")

        # Extract full template with content
        template_content = extract_template_with_content(file_path)

        print(f"📄 Extracted {len(template_content['sections'])} sections with content")
        print(f"📊 Extracted {len(template_content['tables'])} tables")

        # Build hierarchical structure
        section_tree = build_section_tree_with_parents(toc)

        print(f"🌳 Built section tree with {len(section_tree)} sections")

        # Print TOC for debugging
        print("\nExtracted Table of Contents:")
        print_toc(toc)

        # Prepare enhanced template data
        template_data = {
            "section_tree": section_tree,
            "source_file": filename,
            "template_content": template_content,  # Add full content
            "original_sections": template_content["sections"],  # Direct section mapping
            "tables": template_content["tables"],
            "full_content_preview": template_content["full_content"][:1000] + "..." if len(template_content["full_content"]) > 1000 else template_content["full_content"]
        }

        # Save as template
        template_id = save_toc_template(template_data, template_name)

        return {
            "status": "success",
            "template_id": template_id,
            "template_name": template_name or f"Template from {filename}",
            "sections_count": len(section_tree),
            "section_tree": section_tree,
            "content_extracted": True,
            "content_sections": len(template_content["sections"])
        }

    except Exception as e:
        print(f"❌ Error learning template from {filename}: {e}")
        return {"error": str(e)}

def generate_toc_preview(template_id: str) -> str:
    """Generate a markdown preview of a TOC template."""
    templates = get_toc_templates()
    template = next((t for t in templates if t["id"] == template_id), None)

    if not template:
        return "Template not found"

    preview = f"# {template['name']}\n\n"
    preview += f"**Total Sections:** {template.get('metadata', {}).get('total_sections', 0)}\n"
    preview += f"**Max Depth:** {template.get('metadata', {}).get('max_depth', 0)}\n"
    preview += f"**Source:** {template.get('source_file', 'Unknown')}\n\n"
    preview += "## Table of Contents\n\n"

    section_tree = template.get("section_tree", [])
    for section in section_tree:
        level = section.get("level", 1)
        indent = "  " * (level - 1)
        title = section.get("title", "Untitled")

        preview += f"{indent}- {title}\n"

    return preview