# backend/proposal_generator.py

import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI
from db import search, safe_collection_name
from retrieval import format_context
from prompt import PROPOSAL_SECTION_PROMPTS, COMPLIANCE_MATRIX_GENERATION_PROMPT, REQUIREMENTS_EXTRACTION_PROMPT, TEMPLATE_BASED_SECTION_PROMPT

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Proposal Templates
PROPOSAL_TEMPLATES = {
    "standard": {
        "name": "Standard Business Proposal",
        "industry": "General",
        "sections": [
            {"title": "Executive Summary", "type": "executive_summary", "required": True},
            {"title": "Understanding of Requirements", "type": "requirements_understanding", "required": True},
            {"title": "Proposed Solution", "type": "technical_approach", "required": True},
            {"title": "Project Timeline", "type": "timeline", "required": True},
            {"title": "Team & Qualifications", "type": "team", "required": True},
            {"title": "Pricing", "type": "pricing", "required": True},
            {"title": "Compliance Matrix", "type": "compliance", "required": False},
            {"title": "Risk Management", "type": "risk_management", "required": False},
            {"title": "Quality Assurance", "type": "quality_assurance", "required": False},
            {"title": "References", "type": "references", "required": False}
        ],
        "variables": [
            {"key": "client_name", "label": "Client Name", "type": "text"},
            {"key": "project_name", "label": "Project Name", "type": "text"},
            {"key": "project_duration", "label": "Project Duration", "type": "text"},
            {"key": "total_budget", "label": "Total Budget", "type": "currency"},
            {"key": "company_name", "label": "Your Company Name", "type": "text"},
            {"key": "proposal_date", "label": "Proposal Date", "type": "date"}
        ]
    },
    "technical": {
        "name": "Technical Implementation Proposal",
        "industry": "Technology",
        "sections": [
            {"title": "Executive Summary", "type": "executive_summary", "required": True},
            {"title": "Technical Requirements Analysis", "type": "requirements_analysis", "required": True},
            {"title": "System Architecture", "type": "system_architecture", "required": True},
            {"title": "Implementation Methodology", "type": "implementation_methodology", "required": True},
            {"title": "Technology Stack", "type": "technology_stack", "required": True},
            {"title": "Security Framework", "type": "security_framework", "required": True},
            {"title": "Testing Strategy", "type": "testing_strategy", "required": True},
            {"title": "Deployment Plan", "type": "deployment_plan", "required": True},
            {"title": "Maintenance & Support", "type": "maintenance_support", "required": True},
            {"title": "Team & Expertise", "type": "team", "required": True},
            {"title": "Project Timeline", "type": "timeline", "required": True},
            {"title": "Investment & ROI", "type": "pricing", "required": True},
            {"title": "Compliance Matrix", "type": "compliance", "required": True}
        ],
        "variables": [
            {"key": "client_name", "label": "Client Name", "type": "text"},
            {"key": "system_name", "label": "System Name", "type": "text"},
            {"key": "technology_stack", "label": "Primary Technology Stack", "type": "text"},
            {"key": "implementation_duration", "label": "Implementation Duration", "type": "text"},
            {"key": "total_investment", "label": "Total Investment", "type": "currency"},
            {"key": "go_live_date", "label": "Target Go-Live Date", "type": "date"},
            {"key": "support_duration", "label": "Support Duration", "type": "text"}
        ]
    },
    "services": {
        "name": "Professional Services Proposal",
        "industry": "Consulting",
        "sections": [
            {"title": "Executive Summary", "type": "executive_summary", "required": True},
            {"title": "Situation Analysis", "type": "situation_analysis", "required": True},
            {"title": "Service Approach", "type": "service_approach", "required": True},
            {"title": "Deliverables", "type": "deliverables", "required": True},
            {"title": "Methodology", "type": "methodology", "required": True},
            {"title": "Team & Expertise", "type": "team", "required": True},
            {"title": "Project Phases", "type": "project_phases", "required": True},
            {"title": "Success Metrics", "type": "success_metrics", "required": True},
            {"title": "Investment", "type": "pricing", "required": True},
            {"title": "Terms & Conditions", "type": "terms_conditions", "required": False}
        ],
        "variables": [
            {"key": "client_name", "label": "Client Name", "type": "text"},
            {"key": "engagement_name", "label": "Engagement Name", "type": "text"},
            {"key": "service_duration", "label": "Service Duration", "type": "text"},
            {"key": "total_fee", "label": "Total Professional Fee", "type": "currency"},
            {"key": "start_date", "label": "Proposed Start Date", "type": "date"},
            {"key": "key_stakeholder", "label": "Key Client Stakeholder", "type": "text"}
        ]
    }
}


def get_rfq_context(rfq_name: str, query: str = "", k: int = 10) -> str:
    """Get relevant context from RFQ documents."""
    collection = safe_collection_name(f"rfq_{rfq_name}")
    
    if not query:
        query = f"requirements objectives deliverables scope timeline budget"
    
    docs = search(query, k=k, collection=collection)
    return format_context(docs)

def find_original_template_section(section_title: str, template_data: Dict[str, Any]) -> str:
    """Find the original template section content that matches the given title."""

    if not template_data or "original_sections" not in template_data:
        return None

    original_sections = template_data["original_sections"]

    # Try exact match first
    for section in original_sections:
        if section.get("title", "").strip().lower() == section_title.strip().lower():
            return section.get("content_text", "")

    # Try partial match
    for section in original_sections:
        original_title = section.get("title", "").strip().lower()
        search_title = section_title.strip().lower()
        if search_title in original_title or original_title in search_title:
            return section.get("content_text", "")

    # Try keyword matching for similar sections
    keywords = section_title.lower().split()
    for section in original_sections:
        original_title = section.get("title", "").strip().lower()
        if any(keyword in original_title for keyword in keywords if len(keyword) > 3):
            return section.get("content_text", "")

    return None

def generate_template_based_section(
    section_title: str,
    rfq_name: str,
    template_data: Dict[str, Any],
    requirements: List[str] = None,
    tone: str = "professional"
) -> str:
    """Generate a section by adapting the original template content."""

    if requirements is None:
        requirements = []

    # Get RFQ context relevant to this section
    context = get_rfq_context(rfq_name, f"{section_title} requirements specifications")

    # Find the corresponding original template section
    original_content = find_original_template_section(section_title, template_data)

    if not original_content:
        print(f"⚠️ No original template content found for '{section_title}', using fallback")
        # Fallback to previous method if no template content found
        return generate_template_aware_section_fallback(section_title, rfq_name, requirements, tone)

    print(f"✅ Found original template content for '{section_title}' ({len(original_content)} chars)")

    # Use the template-based prompt with actual original content
    formatted_prompt = TEMPLATE_BASED_SECTION_PROMPT.format(
        original_section_title=section_title,
        original_section_content=original_content,
        new_section_title=section_title,
        rfq_context=context,
        requirements="\n".join([f"- {req}" for req in requirements]) if requirements else "No specific requirements provided"
    )

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are a senior proposal manager who specializes in adapting existing proposal templates to new projects. Your job is to take the original template content and modify it to fit new RFQ requirements while preserving the exact style, tone, structure, and professional approach of the original author. You are excellent at maintaining consistency in formatting, technical depth, and presentation style."},
                {"role": "user", "content": formatted_prompt}
            ],
            temperature=0.1,  # Very low temperature for consistency
            max_tokens=4000
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Error generating template-based section '{section_title}': {e}")
        return f"## {section_title}\n\nContent generation failed. Please regenerate this section."

def generate_template_aware_section_fallback(
    section_title: str,
    rfq_name: str,
    requirements: List[str] = None,
    tone: str = "professional"
) -> str:
    """Fallback section generation when no template content is available."""

    if requirements is None:
        requirements = []

    # Get RFQ context relevant to this section
    context = get_rfq_context(rfq_name, f"{section_title} requirements specifications")

    # Simple prompt for generating section content
    prompt = f"""
Generate professional proposal content for the section titled "{section_title}".

RFQ Context: {context}
Requirements: {requirements}

Create detailed, professional content appropriate for a technical engineering proposal.
Include tables, specifications, and detailed information as appropriate for this section type.
Use professional language and maintain technical accuracy.
"""

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are an expert technical proposal writer. Generate detailed, professional proposal content."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=3000
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Error generating fallback section '{section_title}': {e}")
        return f"## {section_title}\n\nContent generation failed. Please regenerate this section."

def generate_proposal_section(
    section_type: str,
    rfq_name: str,
    context: str = "",
    requirements: List[str] = None,
    tone: str = "professional"
) -> str:
    """Generate a specific proposal section using AI."""

    if requirements is None:
        requirements = []

    # Get additional context from RFQ if not provided
    if not context:
        context = get_rfq_context(rfq_name, f"{section_type} requirements")

    # Get the appropriate prompt template
    prompt_template = PROPOSAL_SECTION_PROMPTS.get(section_type, PROPOSAL_SECTION_PROMPTS["technical_approach"])

    # Format the prompt
    formatted_prompt = prompt_template.format(
        context=context,
        requirements="\n".join([f"- {req}" for req in requirements]),
        tone=tone
    )

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are an expert proposal writer with 15+ years of experience winning complex RFPs across industries. Write content that is compelling, professional, and demonstrates deep expertise."},
                {"role": "user", "content": formatted_prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Error generating section {section_type}: {e}")
        return f"Error generating {section_type} section. Please try again."

def generate_compliance_matrix(rfq_name: str, requirements: List[str] = None) -> List[Dict[str, str]]:
    """Generate a compliance matrix based on RFQ requirements."""
    
    if requirements is None:
        # Extract requirements from RFQ context
        context = get_rfq_context(rfq_name, "requirements compliance standards regulations must shall")
        requirements = extract_requirements_from_context(context)
    
    matrix = []
    
    for requirement in requirements:
        try:
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                messages=[
                    {"role": "system", "content": "You are a compliance expert. For each requirement, provide a specific response showing how you meet it, evidence/proof, and compliance status."},
                    {"role": "user", "content": COMPLIANCE_MATRIX_GENERATION_PROMPT.format(requirement=requirement)}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse the response
            response_text = ""
            evidence_text = ""
            status = "Compliant"
            
            lines = content.split('\n')
            for line in lines:
                if line.startswith('Response:'):
                    response_text = line.replace('Response:', '').strip()
                elif line.startswith('Evidence:'):
                    evidence_text = line.replace('Evidence:', '').strip()
                elif line.startswith('Status:'):
                    status = line.replace('Status:', '').strip()
            
            matrix.append({
                "requirement": requirement,
                "response": response_text or "We meet this requirement through our standard processes.",
                "evidence": evidence_text or "Documentation available upon request.",
                "status": status
            })
            
        except Exception as e:
            print(f"Error generating compliance for requirement '{requirement}': {e}")
            matrix.append({
                "requirement": requirement,
                "response": "We meet this requirement through our standard processes.",
                "evidence": "Documentation available upon request.",
                "status": "Compliant"
            })
    
    return matrix

def extract_requirements_from_context(context: str) -> List[str]:
    """Extract key requirements from RFQ context using AI."""
    
    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "Extract specific, actionable requirements from RFQ text. Focus on mandatory requirements, standards, certifications, and compliance needs."},
                {"role": "user", "content": REQUIREMENTS_EXTRACTION_PROMPT.format(context=context)}
            ],
            temperature=0.1,
            max_tokens=800
        )
        
        content = response.choices[0].message.content.strip()
        requirements = [req.strip() for req in content.split('\n') if req.strip() and not req.strip().startswith('#')]
        
        return requirements[:20]  # Limit to top 20 requirements
        
    except Exception as e:
        print(f"Error extracting requirements: {e}")
        return [
            "Provide secure, scalable solution",
            "Ensure data privacy and protection",
            "Deliver within specified timeline",
            "Provide ongoing support and maintenance",
            "Meet all technical specifications"
        ]

def generate_full_proposal(
    rfq_name: str,
    structure: str = "standard",
    tone: str = "professional",
    requirements: List[str] = None,
    include_compliance: bool = True,
    toc_template_id: str = None
) -> Dict[str, Any]:
    """Generate a complete proposal based on TOC template and RFQ."""

    if requirements is None:
        context = get_rfq_context(rfq_name)
        requirements = extract_requirements_from_context(context)

    # Check if we should use TOC template or fallback to hardcoded templates
    if toc_template_id:
        from toc_extractor import get_toc_templates
        templates = get_toc_templates()
        toc_template = next((t for t in templates if t["id"] == toc_template_id), None)

        if toc_template:
            print(f"🎯 Using TOC template: {toc_template['name']}")
            return generate_proposal_from_toc_template(
                rfq_name=rfq_name,
                toc_template=toc_template,
                tone=tone,
                requirements=requirements,
                include_compliance=include_compliance
            )
        else:
            print(f"⚠️ TOC template {toc_template_id} not found, falling back to hardcoded template")

    # Fallback to original hardcoded templates
    template = PROPOSAL_TEMPLATES.get(structure, PROPOSAL_TEMPLATES["standard"])

    proposal = {
        "template": template["name"],
        "industry": template["industry"],
        "sections": [],
        "variables": template["variables"],
        "compliance_matrix": [],
        "generated_at": "",
        "rfq_name": rfq_name
    }

    # Generate each section
    for section_def in template["sections"]:
        if not include_compliance and section_def["type"] == "compliance":
            continue

        print(f"Generating section: {section_def['title']}")

        content = generate_proposal_section(
            section_type=section_def["type"],
            rfq_name=rfq_name,
            requirements=requirements,
            tone=tone
        )

        proposal["sections"].append({
            "title": section_def["title"],
            "type": section_def["type"],
            "content": content,
            "required": section_def.get("required", False)
        })

    # Generate compliance matrix if requested
    if include_compliance:
        print("Generating compliance matrix...")
        proposal["compliance_matrix"] = generate_compliance_matrix(rfq_name, requirements)

    return proposal


def generate_proposal_from_toc_template(
    rfq_name: str,
    toc_template: Dict[str, Any],
    tone: str = "professional",
    requirements: List[str] = None,
    include_compliance: bool = True
) -> Dict[str, Any]:
    """Generate a proposal using a TOC template structure."""

    if requirements is None:
        requirements = []

    # Create proposal structure based on TOC template
    proposal = {
        "template": toc_template["name"],
        "industry": "Custom",
        "sections": [],
        "variables": [
            {"key": "client_name", "label": "Client Name", "type": "text"},
            {"key": "project_name", "label": "Project Name", "type": "text"},
            {"key": "proposal_date", "label": "Proposal Date", "type": "date"},
            {"key": "company_name", "label": "Your Company Name", "type": "text"}
        ],
        "compliance_matrix": [],
        "generated_at": "",
        "rfq_name": rfq_name,
        "toc_template_id": toc_template["id"]
    }

    section_tree = toc_template.get("section_tree", [])

    # Generate content only for top-level sections (no parent or parent is None)
    top_level_sections = [s for i, s in enumerate(section_tree) if s.get("parent") is None or s.get("parent") == ""]

    print(f"📊 Section tree analysis:")
    print(f"   Total sections in tree: {len(section_tree)}")
    print(f"   Top-level sections found: {len(top_level_sections)}")
    for i, s in enumerate(section_tree):
        print(f"   {i}: '{s.get('title', 'Untitled')}' (level: {s.get('level', 1)}, parent: {s.get('parent')})")

    for section_idx, section_def in enumerate(top_level_sections):
        original_idx = next(i for i, s in enumerate(section_tree) if s == section_def)
        section_title = section_def.get("title", f"Section {section_idx+1}")
        section_level = section_def.get("level", 1)

        print(f"Generating section: {section_title}")

        # Use template-based generation with original content
        content = generate_template_based_section(
            section_title=section_title,
            rfq_name=rfq_name,
            template_data=toc_template,  # Pass the full template data
            requirements=requirements,
            tone=tone
        )

        # Create section object
        section_data = {
            "id": f"section_{section_idx+1}",
            "title": section_title,
            "content": content,
            "contentMd": content,
            "type": section_type,
            "level": section_level,
            "order": section_idx,
            "parent": None,
            "template_source": toc_template["id"]
        }

        # Handle subsections - find ALL descendant children of this section (not just direct children)
        def get_all_children(parent_idx, depth=0):
            children = []
            direct_children = [s for i, s in enumerate(section_tree) if s.get("parent") == parent_idx]

            for child_idx, child_section in enumerate([s for i, s in enumerate(section_tree) if s.get("parent") == parent_idx]):
                child_original_idx = next(i for i, s in enumerate(section_tree) if s == child_section)
                child_title = child_section.get("title", f"Subsection {child_idx+1}")

                print(f"{'  ' * (depth+1)}Generating subsection: {child_title}")

                # Use template-based generation for subsections too
                child_content = generate_template_based_section(
                    section_title=child_title,
                    rfq_name=rfq_name,
                    template_data=toc_template,  # Pass the full template data
                    requirements=requirements,
                    tone=tone
                )

                child_data = {
                    "id": f"subsection_{section_idx+1}_{len(children)+1}",
                    "title": child_title,
                    "content": child_content,
                    "contentMd": child_content,
                    "type": child_type,
                    "level": child_section.get("level", depth + 2),
                    "parent_id": section_data["id"]
                }

                # Recursively get children of this child
                grandchildren = get_all_children(child_original_idx, depth + 1)
                if grandchildren:
                    child_data["subsections"] = grandchildren

                children.append(child_data)

            return children

        subsections = get_all_children(original_idx)
        if subsections:
            section_data["subsections"] = subsections

        proposal["sections"].append(section_data)

    # Generate compliance matrix if requested and not already included
    if include_compliance:
        compliance_sections = [s for s in proposal["sections"] if "compliance" in s["title"].lower()]
        if not compliance_sections:
            print("Generating compliance matrix...")
            proposal["compliance_matrix"] = generate_compliance_matrix(rfq_name, requirements)

    return proposal


def infer_section_type_from_title(title: str) -> str:
    """Infer the section type from the title using keyword matching."""
    title_lower = title.lower()

    # Mapping of keywords to section types
    type_mappings = {
        "executive": "executive_summary",
        "summary": "executive_summary",
        "overview": "executive_summary",
        "understanding": "requirements_understanding",
        "requirement": "requirements_understanding",
        "approach": "technical_approach",
        "solution": "technical_approach",
        "methodology": "technical_approach",
        "technical": "technical_approach",
        "timeline": "timeline",
        "schedule": "timeline",
        "project plan": "timeline",
        "team": "team",
        "staff": "team",
        "personnel": "team",
        "qualifications": "team",
        "price": "pricing",
        "pricing": "pricing",
        "cost": "pricing",
        "budget": "pricing",
        "investment": "pricing",
        "compliance": "compliance",
        "standards": "compliance",
        "regulations": "compliance",
        "risk": "risk_management",
        "quality": "quality_assurance",
        "qa": "quality_assurance",
        "testing": "quality_assurance",
        "reference": "references",
        "experience": "references",
        "case study": "references",
        "deliverable": "deliverables",
        "scope": "requirements_understanding",
        "objective": "requirements_understanding"
    }

    # Find matching section type
    for keyword, section_type in type_mappings.items():
        if keyword in title_lower:
            return section_type

    # Default fallback
    return "technical_approach"