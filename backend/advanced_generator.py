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
from advanced_prompts import build_prompt, pick_prompt_type, STRICT_JSON_SCHEMA, SYSTEM_ROLE

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
GENERATION_MODEL = "gpt-4o"

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

    # Check for global knowledge collections
    for coll_name in ["proposals", "datasheets", "standards", "global"]:
        try:
            kb_docs = search(section_title, k=max(3, top_k // 2), collection=coll_name)
            if kb_docs:
                kb_map[coll_name] = [doc.page_content for doc in kb_docs]
        except:
            # Collection doesn't exist or error occurred, skip
            continue

    return rfq_texts, rfq_ids, kb_map

def generate_advanced_section(
    section_title: str,
    rfq_collection: str,
    level: int = 1,
    outline_path: str = "",
    top_k: int = 5,
    temperature: float = 0.4,
) -> Dict:
    """
    Generate a sophisticated proposal section using advanced prompts and two-pass generation.
    Uses current database system but with advanced generation logic.
    """
    print(f"🎯 Generating advanced section: {section_title}")

    # Retrieve context using current system
    rfq_texts, rfq_ids, kb_map = _retrieve_context_langchain(
        section_title=section_title,
        rfq_collection=rfq_collection,
        top_k=top_k,
    )

    rfq_excerpt = "\n".join(rfq_texts)

    # Build comprehensive context from all available sources
    context_parts = [f"[RFQ CONTEXT — {rfq_collection}]\n" + "\n".join(rfq_texts)]

    for coll_name, texts in kb_map.items():
        if texts:
            context_parts.append(f"[KNOWLEDGE — {coll_name}]\n" + "\n".join(texts))

    context = "\n\n".join(context_parts)

    # Choose specialized prompt type based on section title
    section_type = pick_prompt_type(section_title)
    print(f"📝 Using prompt type: {section_type}")

    prompt = build_prompt(
        section_type,
        title=section_title,
        level=level,
        outline_path=outline_path,
        rfq_excerpt=rfq_excerpt,
        context=context,
    )

    # First pass: Generate draft
    print(f"🤖 Generating draft...")
    response = client.chat.completions.create(
        model=GENERATION_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ROLE},
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

    return output

def refine_section_advanced(
    title: str,
    rfq_excerpt: str,
    draft: str,
    temperature: float = 0.2
) -> Dict:
    """
    Second pass: Refine the generated section for better quality.
    """
    print(f"✨ Refining section: {title}")

    refine_prompt = (
        f"TITLE: {title}\n\n"
        f"[RFQ EXCERPT]\n{rfq_excerpt}\n\n"
        f"[DRAFT TO EDIT]\n{draft}\n\n"
        f"INSTRUCTIONS:\n"
        f"1) Improve clarity, structure, and compliance.\n"
        f"2) Preserve factual grounding. Do NOT invent content.\n"
        f"3) Preserve this STRICT JSON schema exactly (no extra text outside the JSON):\n"
        f"{STRICT_JSON_SCHEMA}\n"
    )

    response = client.chat.completions.create(
        model=GENERATION_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ROLE},
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
            raise ValueError(f"Refinement failed. Raw response: {raw}")

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
    top_k: int = 6
) -> Dict[str, Any]:
    """
    Generate a complete proposal using advanced system with current database.
    """
    print(f"🎯 Generating advanced proposal for RFQ: {rfq_name}")

    # Convert RFQ name to collection name using current system
    collection_name = safe_collection_name(f"rfq_{rfq_name}")
    print(f"📋 Using collection: {collection_name}")

    # Use TOC template if provided, otherwise use default structure
    if toc_template and toc_template.get("section_tree"):
        toc_nodes = toc_template_to_nodes(toc_template)
    else:
        # Default fallback structure
        default_sections = [
            {"title": "Executive Summary", "level": 1, "order": 0, "parent": None},
            {"title": "Technical Approach", "level": 1, "order": 1, "parent": None},
            {"title": "Implementation Plan", "level": 1, "order": 2, "parent": None},
            {"title": "Team & Qualifications", "level": 1, "order": 3, "parent": None},
            {"title": "Commercial Terms", "level": 1, "order": 4, "parent": None},
            {"title": "Compliance Matrix", "level": 1, "order": 5, "parent": None},
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

    print(f"🔧 Processing {len(toc_nodes)} sections")

    for node in toc_nodes:
        outline_path = node.path_str(toc_nodes)
        print(f"\n[GEN] {outline_path}")

        try:
            # Generate draft using advanced system
            draft_json = generate_advanced_section(
                section_title=node.title,
                rfq_collection=collection_name,
                level=node.level,
                outline_path=outline_path,
                top_k=top_k,
            )

            # Refine the draft (second pass)
            refined_json = refine_section_advanced(
                title=node.title,
                rfq_excerpt="",  # Will be populated internally
                draft=json.dumps(draft_json, ensure_ascii=False),
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