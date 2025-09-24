from __future__ import annotations
"""
Clean orchestrator wired into llm_generate + prompts.py.
Preserves:
  • Two-pass generation (Draft → Refine)
  • Retrieval & context caps
  • Evidence logging
  • Cycle-safe TOC traversal + validation
"""

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---- Project imports ----
from ingest.extract_pdf_chunks import extract_pdf_text
try:
    from rag.qdrant_ops import search_similar_chunks  # type: ignore
except Exception:
    from qdrant_ops import search_similar_chunks  # type: ignore

# LLM wrapper (uses prompts.py internally)
from llm.llm_generate import generate_section_from_rfq, refine_section_output

# Composer
from composer.doc_composer import compose_proposal_docx

# ---- Limits ----
MAX_RFQ_EXCERPT_CHARS = 8000
MAX_RETRIEVAL_CONTEXT_CHARS = 3500


@dataclass
class SectionNode:
    title: str
    level: int
    order: int
    parent: Optional[int] = None

    def path_str(self, tree: List["SectionNode"]) -> str:
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


# -----------------------------
# Utilities
# -----------------------------

def validate_toc(nodes: List[SectionNode]) -> None:
    n = len(nodes)
    for i, node in enumerate(nodes):
        if node.parent is not None:
            if not isinstance(node.parent, int) or node.parent < 0 or node.parent >= n:
                print(f"[WARN] '{node.title}' has invalid parent index: {node.parent}")
            elif node.parent == i:
                print(f"[WARN] '{node.title}' lists itself as parent.")
    # simple cycle detection
    def detect_cycle(idx: int, seen: set[int]) -> bool:
        if idx in seen:
            return True
        seen.add(idx)
        parent = nodes[idx].parent
        if parent is None or not isinstance(parent, int) or parent < 0 or parent >= n:
            return False
        return detect_cycle(parent, seen)
    for i in range(n):
        if detect_cycle(i, set()):
            print(f"[WARN] Cycle detected starting at index {i} ('{nodes[i].title}')")


def load_toc(path: str | Path) -> List[SectionNode]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    nodes = [
        SectionNode(
            title=d["title"],
            level=int(d.get("level", 1)),
            order=int(d.get("order", i)),
            parent=d.get("parent"),
        )
        for i, d in enumerate(data)
    ]
    nodes.sort(key=lambda n: (n.order, n.level))
    return nodes


def read_rfq_text(rfq_pdf: Optional[str]) -> str:
    if not rfq_pdf:
        return ""
    text = extract_pdf_text(rfq_pdf) or ""
    return text[:MAX_RFQ_EXCERPT_CHARS]


def run_pipeline(toc_json: str, rfq_pdf: Optional[str], out_docx: str, collection: str, top_k: int = 6) -> Path:
    toc_nodes = load_toc(toc_json)
    validate_toc(toc_nodes)
    rfq_excerpt = read_rfq_text(rfq_pdf)

    sections_payload: List[Dict[str, Any]] = []
    evidence_log: Dict[str, Any] = {"sections": []}

    for node in toc_nodes:
        outline_path = node.path_str(toc_nodes)
        print(f"\n[GEN] {outline_path}")

        # Draft with prompt library via llm_generate
        draft_json = generate_section_from_rfq(
            section_title=node.title,
            rfq_collection=collection,
            level=node.level,
            outline_path=outline_path,
            top_k=top_k,
        )

        # Refine
        refined_json = refine_section_output(
            title=node.title,
            rfq_excerpt=rfq_excerpt,
            draft=json.dumps(draft_json, ensure_ascii=False),
        )

        # Collect for composer
        sections_payload.append({
            "title": refined_json.get("title", node.title),
            "content": refined_json.get("content", ""),
            "level": node.level,
        })

        evidence_log["sections"].append({
            "title": node.title,
            "level": node.level,
            "outline_path": outline_path,
            "retrieval_top_k": top_k,
            "retrieved": draft_json.get("cited_chunks", []),
        })

    # Compose DOCX
    compose_proposal_docx(sections_payload, out_docx)

    # Save log
    out_path = Path(out_docx)
    log_path = out_path.with_suffix(".sources.json")
    Path(log_path).write_text(json.dumps(evidence_log, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✅ Wrote DOCX: {out_path}")
    print(f"🧾 Sources log: {log_path}")
    return out_path


# -----------------------------
# CLI
# -----------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Hybrid proposal generator using llm_generate + prompts")
    parser.add_argument("--toc_json", required=True)
    parser.add_argument("--rfq_pdf")
    parser.add_argument("--collection", default="proposal_chunks")
    parser.add_argument("--top_k", type=int, default=6)
    parser.add_argument("--out_docx", default="proposal_draft.docx")
    args = parser.parse_args()

    run_pipeline(
        toc_json=args.toc_json,
        rfq_pdf=args.rfq_pdf,
        out_docx=args.out_docx,
        collection=args.collection,
        top_k=args.top_k,
    )


if __name__ == "__main__":
    main()
