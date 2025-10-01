"""
Advanced proposal generation logic adapted to work with current LangChain + ChromaDB system.
Uses sophisticated prompts and two-pass generation while preserving existing database structure.
"""

import os
import json
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from openai import OpenAI

from db import get_chroma, search, safe_collection_name
from prompts import (
    build_prompt,
    pick_prompt_type,
    build_template_prompt,
    build_refine_prompt,
    STRICT_JSON_SCHEMA,
    DRAFT_SYSTEM_ROLE,
    REFINE_SYSTEM_ROLE,
    DRAFT_MODEL,
    REFINE_MODEL,
    MAX_CONTEXT_CHARS
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@dataclass
class SectionNode:
    title: str
    level: int
    order: int
    parent: Optional[int] = None

    def path_str(self, tree: List["SectionNode"]) -> str:
        """Generate hierarchical path for section."""
        chain: List[str] = [self.title]
        visited: set[int] = set()
        p = self.parent
        while p is not None and p not in visited:
            visited.add(p)
            if not isinstance(p, int) or p < 0 or p >= len(tree):
                break
            chain.append(tree[p].title)
            p = tree[p].parent
        return " > ".join(reversed(chain))

def _retrieve_context_langchain(
    section_title: str,
    rfq_collection: str,
    top_k: int = 5,
) -> Tuple[List[str], List[str], Dict[str, List[str]]]:
    """
    Retrieve context using current LangChain + ChromaDB system.
    Adapts the advanced multi-collection approach to work with existing database.
    """
    # Get RFQ-specific chunks using current system
    rfq_docs = search(section_title, k=top_k, collection=rfq_collection)
    rfq_texts = [doc.page_content for doc in rfq_docs]
    rfq_ids = [getattr(doc, 'metadata', {}).get('source', f'doc_{i}') for i, doc in enumerate(rfq_docs)]

    # Try to get additional context from other collections if they exist
    kb_map: Dict[str, List[str]] = {}

    # CRITICAL: Retrieve from TEMPLATES collection (uploaded old proposals)
    # This is where we learn how to write each section
    try:
        template_docs = search(section_title, k=top_k, collection="templates")
        if template_docs:
            kb_map["templates"] = [doc.page_content for doc in template_docs]
            print(f"📚 Retrieved {len(template_docs)} template examples for '{section_title}'")
    except Exception as e:
        print(f"⚠️ Could not retrieve from templates collection: {e}")

    # TODO: Future expansion - add more collections here
    # for coll_name in ["proposals", "datasheets", "standards", "global"]:
    #     try:
    #         kb_docs = search(section_title, k=max(3, top_k // 2), collection=coll_name)
    #         if kb_docs:
    #             kb_map[coll_name] = [doc.page_content for doc in kb_docs]
    #     except:
    #         continue

    return rfq_texts, rfq_ids, kb_map

def generate_advanced_section(
    section_title: str,
    rfq_collection: str,
    level: int = 1,
    outline_path: str = "",
    top_k: int = 5,
    template_data: Optional[Dict] = None,
    temperature: float = 0.4,
) -> Dict:
    """
    Generate a sophisticated proposal section using TWO-PASS generation:
    Pass 1: Draft with cheap model (gpt-4o-mini)
    Pass 2: Refine with expensive model (gpt-4o)

    template_data: dict with keys: writing_sample, target_words, table_count, image_count
    """
    print(f"🎯 Generating section: {section_title}")

    # Retrieve context using current system
    rfq_texts, rfq_ids, kb_map = _retrieve_context_langchain(
        section_title=section_title,
        rfq_collection=rfq_collection,
        top_k=top_k,
    )

    rfq_excerpt = "\n".join(rfq_texts)[:MAX_CONTEXT_CHARS]

    # Build comprehensive context from all available sources
    context_parts = [f"[RFQ CONTEXT]\n" + "\n".join(rfq_texts)]

    for coll_name, texts in kb_map.items():
        if texts:
            context_parts.append(f"[{coll_name.upper()}]\n" + "\n".join(texts))

    full_context = "\n\n".join(context_parts)
    context = full_context[:MAX_CONTEXT_CHARS]  # Apply context limit

    # Choose prompt based on whether we have template data
    if template_data and template_data.get('writing_sample'):
        print(f"📝 Using TEMPLATE-STYLE prompt")
        prompt = build_template_prompt(
            title=section_title,
            level=level,
            outline_path=outline_path,
            rfq_excerpt=rfq_excerpt,
            context=context,
            template_data=template_data
        )
    else:
        print(f"📝 Using FALLBACK prompt (no template)")
        section_type = pick_prompt_type(section_title)
        prompt = build_prompt(
            section_type,
            title=section_title,
            level=level,
            outline_path=outline_path,
            rfq_excerpt=rfq_excerpt,
            context=context,
        )

    # PASS 1: Generate draft with CHEAP model
    print(f"🤖 DRAFT: Using {DRAFT_MODEL}...")
    response = client.chat.completions.create(
        model=DRAFT_MODEL,
        messages=[
            {"role": "system", "content": DRAFT_SYSTEM_ROLE},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )

    raw = response.choices[0].message.content or ""

    # Parse JSON response
    try:
        output = json.loads(raw)
    except json.JSONDecodeError:
        try:
            # Try to extract JSON from response
            start = raw.find("{")
            end = raw.rfind("}") + 1
            output = json.loads(raw[start:end])
        except Exception:
            print(f"❌ Failed to parse JSON: {raw[:200]}...")
            raise ValueError(f"LLM did not return valid JSON. Raw response: {raw}")

    # Add cited chunks
    output.setdefault("cited_chunks", [])
    output["cited_chunks"] = list(set(output["cited_chunks"] + [str(rid) for rid in rfq_ids if rid]))

    # Ensure all required fields exist
    output.setdefault("image_suggestions", [])
    output.setdefault("notes", [])
    output.setdefault("risks", [])
    output.setdefault("assumptions", [])

    print(f"✅ Draft generated ({len(output.get('content', ''))} chars)")
    return output

def refine_section_advanced(
    title: str,
    rfq_excerpt: str,
    draft: str,
    template_style_notes: str = "",
    temperature: float = 0.2
) -> Dict:
    """
    PASS 2: Refine the generated section using EXPENSIVE model (gpt-4o).
    Improves clarity, compliance, and matches template style.
    """
    print(f"✨ REFINE: Using {REFINE_MODEL}...")

    # Use centralized refine prompt from prompts.py
    refine_prompt = build_refine_prompt(
        draft=draft,
        rfq_excerpt=rfq_excerpt[:MAX_CONTEXT_CHARS],
        template_style_notes=template_style_notes
    )

    response = client.chat.completions.create(
        model=REFINE_MODEL,
        messages=[
            {"role": "system", "content": REFINE_SYSTEM_ROLE},
            {"role": "user", "content": refine_prompt},
        ],
        temperature=temperature,
    )

    raw = response.choices[0].message.content or ""

    try:
        output = json.loads(raw)
    except json.JSONDecodeError:
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            output = json.loads(raw[start:end])
        except Exception:
            print(f"❌ Refine failed to parse JSON: {raw[:200]}...")
            raise ValueError(f"Refinement failed. Raw response: {raw}")

    print(f"✅ Refined section ({len(output.get('content', ''))} chars)")
    return output

def toc_template_to_nodes(toc_template: Dict[str, Any]) -> List[SectionNode]:
    """Convert TOC template structure to SectionNode list."""
    section_tree = toc_template.get("section_tree", [])
    nodes = []

    for i, section in enumerate(section_tree):
        node = SectionNode(
            title=section.get("title", f"Section {i+1}"),
            level=section.get("level", 1),
            order=section.get("order", i),
            parent=section.get("parent")
        )
        nodes.append(node)

    nodes.sort(key=lambda n: (n.order, n.level))
    return nodes

def generate_advanced_proposal(
    rfq_name: str,
    toc_template: Optional[Dict[str, Any]] = None,
    tone: str = "professional",
    top_k: int = 6,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate a complete proposal using advanced system with current database.
    Supports pause/stop/continue via session_id.
    """
    from generation_control import controller, GenerationStatus

    print(f"🎯 Generating advanced proposal for RFQ: {rfq_name}")

    # Initialize session if provided
    if session_id:
        controller.create_session(session_id)

    # Convert RFQ name to collection name using current system
    collection_name = safe_collection_name(f"rfq_{rfq_name}")
    print(f"📋 Using collection: {collection_name}")

    # Always try to use uploaded TOC templates first
    if not toc_template:
        # Import here to avoid circular imports
        from toc_extractor import get_toc_templates
        templates = get_toc_templates()
        if templates:
            # Use the first available template
            toc_template = templates[0]
            print(f"🎯 Using uploaded TOC template: {toc_template.get('name', 'Unknown')}")

    # Use TOC template if available
    if toc_template and toc_template.get("section_tree"):
        toc_nodes = toc_template_to_nodes(toc_template)
        print(f"📋 Using template with {len(toc_nodes)} sections from uploaded TOC")
    else:
        print("⚠️ No TOC template found, using minimal default structure")
        # Minimal fallback - user should upload templates
        default_sections = [
            {"title": "Executive Summary", "level": 1, "order": 0, "parent": None},
            {"title": "Technical Approach", "level": 1, "order": 1, "parent": None},
            {"title": "Commercial Terms", "level": 1, "order": 2, "parent": None},
        ]
        toc_nodes = [
            SectionNode(
                title=s["title"],
                level=s["level"],
                order=s["order"],
                parent=s["parent"]
            )
            for s in default_sections
        ]

    sections_payload: List[Dict[str, Any]] = []
    evidence_log: Dict[str, Any] = {"sections": []}

    # Extract template data for matching sections to writing samples
    template_section_map = {}
    if toc_template:
        # Get ai_writing_guidelines and detailed_sections from template
        ai_guidelines = toc_template.get('ai_writing_guidelines', {})
        detailed_sections = toc_template.get('detailed_sections', [])

        # Build map of section titles to their template data
        for section in detailed_sections:
            section_title = section.get('title', '')
            template_section_map[section_title] = {
                'writing_sample': section.get('content_sample', ''),
                'target_words': section.get('word_count', 200),
                'table_count': section.get('table_count', 0),
                'image_count': 1 if section.get('has_images') else 0,
            }
            # Also add subsections
            for subsection in section.get('subsections', []):
                sub_title = subsection.get('title', '')
                template_section_map[sub_title] = {
                    'writing_sample': subsection.get('content_sample', ''),
                    'target_words': subsection.get('word_count', 100),
                    'table_count': subsection.get('table_count', 0),
                    'image_count': 1 if subsection.get('has_images') else 0,
                }

        print(f"📊 Template data available for {len(template_section_map)} sections")

    print(f"🔧 Processing {len(toc_nodes)} sections")

    # Update total sections count
    if session_id:
        controller.update_progress(session_id, '', 0, len(toc_nodes))

    for idx, node in enumerate(toc_nodes):
        # Check if we should continue (pause/stop handling)
        if session_id:
            if not controller.wait_if_paused(session_id):
                print(f"⏹️ Generation stopped by user")
                controller.set_status(session_id, GenerationStatus.STOPPED, "Stopped by user")
                break

            controller.update_progress(session_id, node.title, idx, len(toc_nodes))

        outline_path = node.path_str(toc_nodes)
        print(f"\n[GEN] ({idx+1}/{len(toc_nodes)}) {outline_path}")

        # Get template data for this specific section
        template_data = template_section_map.get(node.title, None)
        if template_data:
            print(f"📝 Using template data: {template_data['target_words']} words, {template_data['table_count']} tables")

        try:
            # PASS 1: Generate draft using cheap model with template guidance
            draft_json = generate_advanced_section(
                section_title=node.title,
                rfq_collection=collection_name,
                level=node.level,
                outline_path=outline_path,
                top_k=top_k,
                template_data=template_data,  # Pass template data here
            )

            # PASS 2: Refine the draft using expensive model
            template_style_notes = f"Target: {template_data['target_words']} words" if template_data else ""
            refined_json = refine_section_advanced(
                title=node.title,
                rfq_excerpt="",  # Will use from retrieval
                draft=json.dumps(draft_json, ensure_ascii=False),
                template_style_notes=template_style_notes,
            )

            # Collect for final proposal
            sections_payload.append({
                "title": refined_json.get("title", node.title),
                "content": refined_json.get("content", ""),
                "level": node.level,
                "notes": refined_json.get("notes", []),
                "risks": refined_json.get("risks", []),
                "assumptions": refined_json.get("assumptions", []),
                "image_suggestions": refined_json.get("image_suggestions", [])
            })

            evidence_log["sections"].append({
                "title": node.title,
                "level": node.level,
                "outline_path": outline_path,
                "retrieval_top_k": top_k,
                "retrieved": draft_json.get("cited_chunks", []),
                "notes": refined_json.get("notes", []),
                "risks": refined_json.get("risks", []),
                "assumptions": refined_json.get("assumptions", [])
            })

            print(f"✅ Generated: {node.title}")

        except Exception as e:
            print(f"❌ Error generating {node.title}: {e}")
            # Fallback content
            sections_payload.append({
                "title": node.title,
                "content": f"**{node.title}**\n\nContent generation failed. Please regenerate this section.\n\nError: {str(e)}",
                "level": node.level,
                "notes": [],
                "risks": [],
                "assumptions": [],
                "image_suggestions": []
            })

    print(f"\n✅ Generated {len(sections_payload)} sections using advanced system")

    # Mark as completed if using session
    if session_id:
        controller.set_status(session_id, GenerationStatus.COMPLETED, "Proposal generation completed")
        controller.update_progress(session_id, "Completed", len(toc_nodes), len(toc_nodes))

    # Return proposal in format expected by frontend
    proposal_result = {
        "template": toc_template.get("name", "Advanced Template") if toc_template else "Default Template",
        "industry": "Custom",
        "sections": sections_payload,
        "variables": [
            {"key": "client_name", "label": "Client Name", "type": "text"},
            {"key": "project_name", "label": "Project Name", "type": "text"},
            {"key": "proposal_date", "label": "Proposal Date", "type": "date"},
            {"key": "company_name", "label": "Your Company Name", "type": "text"}
        ],
        "compliance_matrix": [],
        "generated_at": "",
        "rfq_name": rfq_name,
        "evidence_log": evidence_log
    }

    return proposal_result