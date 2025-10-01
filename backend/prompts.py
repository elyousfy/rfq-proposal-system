"""
Central prompt library for proposal generation.
All prompts must be defined here - NO prompts in other files.
"""

# ======================
# MODEL CONFIGURATION
# ======================
DRAFT_MODEL = "gpt-4o-mini"  # Cheap model for draft generation
REFINE_MODEL = "gpt-4o"       # Expensive model for refinement
MAX_CONTEXT_CHARS = 3500      # Configurable RAG context limit

# ======================
# JSON SCHEMA
# ======================
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

# ======================
# SYSTEM ROLES
# ======================
DRAFT_SYSTEM_ROLE = (
    "You are a senior proposal writer. "
    "Generate professional proposal sections based on provided evidence and template examples. "
    "Follow the JSON schema exactly. If information is missing, insert [[TODO: ...]]. "
    "Focus on getting the facts and structure right - polish comes later."
)

REFINE_SYSTEM_ROLE = (
    "You are an expert proposal editor and compliance officer. "
    "Your job is to polish and refine draft proposal content. "
    "Ensure compliance, improve clarity, fix tone, and match the template's writing style. "
    "Output STRICT JSON only. Maintain all [[TODO: ...]] placeholders."
)

# ======================
# TEMPLATE-STYLE PROMPT (PRIMARY)
# ======================
TEMPLATE_STYLE_PROMPT = """
SECTION TITLE: {title}
SECTION LEVEL: {level}
OUTLINE PATH: {outline_path}

[WRITING SAMPLE FROM TEMPLATE]
{template_writing_sample}

[RFQ CONTEXT]
{rfq_excerpt}

[EVIDENCE CONTEXT]
{context}

INSTRUCTIONS:
1) Write the "{title}" section matching the style from the template writing sample above
2) TARGET WORD COUNT: {target_words} (±10%)
3) WRITING STYLE: Match the template's style as closely as possible
4) TABLES: Include {table_count} table(s) if expected
5) IMAGES: Suggest {image_count} image placeholder(s) if expected
6) Use ONLY provided evidence. Insert [[TODO: ...]] for missing information
7) Follow the JSON schema exactly

{schema}
"""

# ======================
# FALLBACK: Section-type specialized prompts (when no template available)
# ======================
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

# ======================
# REFINE PROMPT (Second Pass)
# ======================
REFINE_PROMPT = """
You are refining a draft proposal section to ensure it meets quality standards.

[ORIGINAL DRAFT]
{draft}

[RFQ EXCERPT FOR CONTEXT]
{rfq_excerpt}

[TEMPLATE STYLE REFERENCE]
{template_style_notes}

REFINEMENT INSTRUCTIONS:
1) Improve clarity, flow, and readability
2) Ensure compliance with RFQ requirements
3) Match the formality and tone from the template
4) Fix any grammar, spelling, or formatting issues
5) Maintain all [[TODO: ...]] placeholders - do not remove them
6) Ensure target word count is met (±10%)
7) Keep all cited_chunks, notes, risks, assumptions
8) Output STRICT JSON with the same schema

{schema}
"""

# ======================
# HELPER FUNCTIONS
# ======================
def build_template_prompt(
    title: str,
    level: int,
    outline_path: str,
    rfq_excerpt: str,
    context: str,
    template_data: dict
) -> str:
    """Build prompt using template style (PRIMARY METHOD)."""
    return TEMPLATE_STYLE_PROMPT.format(
        title=title,
        level=level,
        outline_path=outline_path,
        template_writing_sample=template_data.get('writing_sample', ''),
        rfq_excerpt=rfq_excerpt[:MAX_CONTEXT_CHARS],
        context=context[:MAX_CONTEXT_CHARS],
        target_words=template_data.get('target_words', 200),
        table_count=template_data.get('table_count', 0),
        image_count=template_data.get('image_count', 0),
        schema=STRICT_JSON_SCHEMA,
    )

def build_refine_prompt(draft: str, rfq_excerpt: str, template_style_notes: str = "") -> str:
    """Build refinement prompt for second pass."""
    return REFINE_PROMPT.format(
        draft=draft,
        rfq_excerpt=rfq_excerpt[:MAX_CONTEXT_CHARS],
        template_style_notes=template_style_notes,
        schema=STRICT_JSON_SCHEMA,
    )