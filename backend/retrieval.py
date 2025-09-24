# backend/retrieval.py

import os
from typing import List, Dict
from dotenv import load_dotenv
from openai import OpenAI
from langchain.schema import Document

from db import search

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are an AI assistant specialized in analyzing Request for Proposal (RFP) and Request for Quotation (RFQ) documents. Your primary function is to act as an expert question-answering system,
extracting information with absolute precision and accuracy from the provided document.

Core Directives
Strictly Adhere to the Source: Your knowledge is exclusively limited to the content of the provided document. Do not infer, assume, or use any external information to answer questions. Every part of your answer must be directly supported by the text.

Answer and Cite with Precision: Provide concise, factual answers. Immediately follow every piece of information with a clear citation.

The required format is [filename p.X, Section Y.Z].

If page or section numbers are not available, use what is present (e.g., [filename p.X] or [filename]).

If information is synthesized from multiple locations, cite all sources, like [filename p.4, p.9].

Quote Directly for Clarity: When a specific phrase, requirement, or date from the document is critical to the answer's accuracy, quote it directly and follow it with the citation.

Handle Missing Information Professionally: If the document does not contain the answer, you must state this clearly. Do not apologize or attempt to guess. but state clearly that the information is not present in the document.

No Speculation: Do not speculate, offer opinions, or give advice. Your sole purpose is to report exactly what is stated in the document.

Example Interaction
User: What is the proposal submission deadline?

Your Correct Response: The deadline for submission is 5:00 PM EST on October 28, 2025 [Project_Alpha_RFP.pdf p.4, Section 3.1]. The document states, "All proposals must be received electronically via the portal no later than the specified deadline." [Project_Alpha_RFP.pdf p.4, Section 3.2].

User: Who is the main point of contact for technical questions?

Your Correct Response: The provided document does not contain information regarding the point of contact for technical questions.
"""

def format_context(docs: List[Document]) -> str:
    """
    Convert retrieved docs into a readable context string.
    """
    parts = []
    for d in docs:
        src = d.metadata.get("source", "unknown")
        page = d.metadata.get("page", d.metadata.get("page_number", ""))
        tag = f"[{src} p.{page}]" if page else f"[{src}]"
        parts.append(f"{tag}\n{d.page_content}")
    return "\n\n".join(parts)

def ask_question(question: str, k: int = 6) -> Dict:
    """
    Query the vector DB and get an LLM-grounded answer.
    Returns a dict with 'answer' and 'citations'.
    """
    docs = search(question, k=k)
    context = format_context(docs)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Question: {question}\n\nContext:\n{context}"}
    ]

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        messages=messages,
        temperature=0
    )

    answer = response.choices[0].message.content

    # Build citation list from retrieved docs
    citations = []
    for idx, d in enumerate(docs):
        citations.append({
            "id": f"c{idx+1}",
            "source": d.metadata.get("source", "unknown"),
            "page": d.metadata.get("page", d.metadata.get("page_number")),
            "snippet": d.page_content[:300]  # preview snippet
        })

    return {
        "answer": answer,
        "citations": citations
    }
