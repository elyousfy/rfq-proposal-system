"""
Advanced prompt templates specialized by section type.
Adapted from the sophisticated proposal generation system to work with current database.
"""

STRICT_JSON_SCHEMA = """
You MUST output STRICT JSON only, with this schema:
{
  "title": str,
  "content": str,
  "image_suggestions": [
    {"placeholder_id": str, "description": str, "position": "before|after|inline"}
  ],
  "cited_chunks": [str],
  "notes": [str],
  "risks": [str],
  "assumptions": [str]
}
"""

# Base system role
SYSTEM_ROLE = (
    "You are a senior proposal writer and compliance officer. "
    "Your job is to generate professional proposal sections grounded ONLY in provided evidence. "
    "Always follow the JSON schema exactly, with no extra text. "
    "If information is missing, insert [[TODO: ...]]. "
)

# Section-type specialized prompts
SECTION_PROMPTS = {
    "technical": """
SECTION TITLE: {title}
SECTION LEVEL: {level}
OUTLINE PATH: {outline_path}

[RFQ EXCERPT]
{rfq_excerpt}

[EVIDENCE CONTEXT]
{context}

INSTRUCTIONS:
1) Write a precise, factual technical section.
2) Include specifications, KPIs, and performance metrics.
3) Use tables or bullet points if needed (e.g., spec comparison, KPIs).
4) Do not invent values. Insert [[TODO: ...]] if missing.
5) Follow the JSON schema.
{schema}
""",

    "commercial": """
SECTION TITLE: {title}
SECTION LEVEL: {level}
OUTLINE PATH: {outline_path}

[RFQ EXCERPT]
{rfq_excerpt}

[EVIDENCE CONTEXT]
{context}

INSTRUCTIONS:
1) Write a commercial terms section with formal contract language.
2) Cover payment terms, delivery, validity, taxes, and warranties.
3) Use structured bullets or a table where possible (e.g., term → condition).
4) No assumptions beyond provided evidence.
5) Follow the JSON schema.
{schema}
""",

    "compliance": """
SECTION TITLE: {title}
SECTION LEVEL: {level}
OUTLINE PATH: {outline_path}

[RFQ EXCERPT]
{rfq_excerpt}

[EVIDENCE CONTEXT]
{context}

INSTRUCTIONS:
1) Ensure every statement is evidence-backed.
2) Present compliance in matrix style if possible (requirement vs. response).
3) If compliance status cannot be confirmed, use [[TODO: verify compliance]].
4) Formal, audit-ready tone (e.g., "The bidder hereby confirms…").
5) Follow the JSON schema.
{schema}
""",

    "corporate": """
SECTION TITLE: {title}
SECTION LEVEL: {level}
OUTLINE PATH: {outline_path}

[RFQ EXCERPT]
{rfq_excerpt}

[EVIDENCE CONTEXT]
{context}

INSTRUCTIONS:
1) Write in a polished, narrative style highlighting company strengths.
2) Emphasize track record, past projects, and credentials.
3) Tone: persuasive but factual, client-facing.
4) Include visuals where appropriate (org chart, project photo placeholder).
5) Follow the JSON schema.
{schema}
""",
}

# TOC → prompt type mapping
TOC_PROMPT_MAP = {
    "Technical Specifications": "technical",
    "Project Scope": "technical",
    "Technical Approach": "technical",
    "Implementation Plan": "technical",
    "HSE Requirements": "compliance",
    "Compliance Matrix": "compliance",
    "Payment Terms": "commercial",
    "Commercial Proposal": "commercial",
    "Commercial Terms": "commercial",
    "Company Profile": "corporate",
    "Past Projects": "corporate",
    "Team & Qualifications": "corporate",
    "Executive Summary": "corporate",
}

def build_prompt(section_type: str, title: str, level: int, outline_path: str, rfq_excerpt: str, context: str) -> str:
    """Build a specialized prompt based on section type."""
    tmpl = SECTION_PROMPTS.get(section_type, SECTION_PROMPTS["technical"])
    return tmpl.format(
        title=title,
        level=level,
        outline_path=outline_path,
        rfq_excerpt=rfq_excerpt or "[[TODO: RFQ excerpt missing]]",
        context=context or "[[TODO: context missing]]",
        schema=STRICT_JSON_SCHEMA,
    )

def pick_prompt_type(section_title: str) -> str:
    """Determine the appropriate prompt type based on section title."""
    section_lower = section_title.lower()
    for key, ptype in TOC_PROMPT_MAP.items():
        if key.lower() in section_lower:
            return ptype
    return "technical"  # default fallback