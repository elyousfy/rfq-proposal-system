# backend/proposal_learner.py

import os
import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI
from db import search, safe_collection_name, load_data, save_data
from retrieval import format_context
from utils import file_to_text
from prompt import (
    PROPOSAL_STRUCTURE_ANALYSIS_PROMPT, 
    PROPOSAL_SECTION_EXTRACTION_PROMPT, 
    PROPOSAL_WRITING_STYLE_ANALYSIS_PROMPT, 
    PROPOSAL_ADAPTIVE_GENERATION_PROMPT
)

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ProposalTemplate:
    def __init__(self, name: str, client_type: str = "", industry: str = ""):
        self.name = name
        self.client_type = client_type  # e.g., "HGS", "Government", "Enterprise"
        self.industry = industry
        self.sections = []
        self.structure = {}
        self.tone_profile = {}
        self.length_profile = {}
        self.writing_style = {}
        self.source_documents = []

def extract_proposal_structure(content: str, filename: str = "") -> Dict[str, Any]:
    """Extract structure, TOC, and metadata from a proposal document."""
    
    prompt = PROPOSAL_STRUCTURE_ANALYSIS_PROMPT.format(content=content[:8000] + "...")

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are an expert proposal analyst. Extract structure, tone, and patterns from proposal documents with precision."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean JSON response
        if content.startswith('```json'):
            content = content[7:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        analysis = json.loads(content)
        analysis['source_file'] = filename
        analysis['extracted_at'] = datetime.now().isoformat()
        
        return analysis
        
    except Exception as e:
        print(f"Error analyzing proposal structure: {e}")
        return {
            "table_of_contents": [],
            "structure": {"total_sections": 0, "avg_section_length": 0},
            "tone_profile": {"formality": "unknown"},
            "content_patterns": {},
            "metadata": {"client_type": "unknown"},
            "source_file": filename
        }

def extract_section_content(content: str, section_title: str) -> str:
    """Extract specific section content from a proposal."""
    
    prompt = PROPOSAL_SECTION_EXTRACTION_PROMPT.format(
        section_title=section_title,
        content=content[:6000] + "..."
    )

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "Extract specific section content while preserving original style and formatting."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1500
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Error extracting section content: {e}")
        return "SECTION_NOT_FOUND"

def learn_writing_style(content: str, section_type: str = "general") -> Dict[str, Any]:
    """Analyze and learn the writing style from a proposal section."""
    
    prompt = PROPOSAL_WRITING_STYLE_ANALYSIS_PROMPT.format(
        section_type=section_type,
        content=content[:3000]
    )

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are a writing style analyst. Extract detailed style patterns from proposal content."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=800
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean JSON response
        if content.startswith('```json'):
            content = content[7:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        return json.loads(content)
        
    except Exception as e:
        print(f"Error analyzing writing style: {e}")
        return {"sentence_style": {}, "vocabulary": {}, "formatting": {}, "approach": {}}

def find_similar_proposals(client_type: str, proposal_type: str = "") -> List[Dict[str, Any]]:
    """Find similar proposal templates based on client type and proposal type."""
    
    data = load_data()
    templates = data.get("proposal_templates", [])
    
    similar = []
    for template in templates:
        score = 0
        
        # Exact client type match
        if template.get("metadata", {}).get("client_type", "").lower() == client_type.lower():
            score += 10
        
        # Partial client type match
        elif client_type.lower() in template.get("metadata", {}).get("client_type", "").lower():
            score += 5
        
        # Proposal type match
        if proposal_type and template.get("metadata", {}).get("proposal_type", "").lower() == proposal_type.lower():
            score += 8
        
        # Industry match (could be expanded)
        if template.get("metadata", {}).get("industry"):
            score += 3
        
        if score > 0:
            template["similarity_score"] = score
            similar.append(template)
    
    # Sort by similarity score
    similar.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
    return similar[:5]  # Return top 5 matches

def generate_adaptive_section(
    section_type: str,
    rfq_context: str,
    template_examples: List[Dict[str, Any]],
    client_type: str = ""
) -> str:
    """Generate a section that adapts style and structure from template examples."""
    
    if not template_examples:
        # Fallback to basic generation
        return f"No template examples found for {section_type}. Using standard generation."
    
    # Get the best matching template
    best_template = template_examples[0]
    style_profile = best_template.get("tone_profile", {})
    content_patterns = best_template.get("content_patterns", {})
    
    # Extract example content for this section type
    example_sections = []
    for template in template_examples[:3]:  # Use top 3 examples
        toc = template.get("table_of_contents", [])
        for section in toc:
            if section_type.lower().replace("_", " ") in section.get("title", "").lower():
                example_sections.append({
                    "title": section.get("title"),
                    "style": template.get("tone_profile", {}),
                    "patterns": template.get("content_patterns", {})
                })
    
    prompt = PROPOSAL_ADAPTIVE_GENERATION_PROMPT.format(
        section_type=section_type,
        client_type=client_type,
        rfq_context=rfq_context[:2000],
        formality=style_profile.get('formality', 'professional'),
        technical_level=style_profile.get('technical_level', 'medium'),
        persuasive_style=style_profile.get('persuasive_style', 'balanced'),
        sentence_complexity=style_profile.get('sentence_complexity', 'moderate'),
        executive_summary_style=content_patterns.get('executive_summary_style', 'standard'),
        uses_bullet_points=content_patterns.get('uses_bullet_points', True),
        uses_tables=content_patterns.get('uses_tables', True),
        evidence_style=content_patterns.get('evidence_style', 'mixed'),
        structure_examples=chr(10).join([f"- {ex['title']}: {ex['style']}" for ex in example_sections[:3]])
    )

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": f"You are an expert proposal writer specializing in {client_type} proposals. Adapt your writing style to match learned templates exactly."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Error generating adaptive section: {e}")
        return f"Error generating {section_type} section. Please try again."

def save_proposal_template(template_data: Dict[str, Any]) -> bool:
    """Save a learned proposal template to the database."""
    
    data = load_data()
    
    if "proposal_templates" not in data:
        data["proposal_templates"] = []
    
    # Check for duplicates
    existing = [t for t in data["proposal_templates"] if t.get("name") == template_data.get("name")]
    if existing:
        # Update existing template
        for i, template in enumerate(data["proposal_templates"]):
            if template.get("name") == template_data.get("name"):
                data["proposal_templates"][i] = template_data
                break
    else:
        # Add new template
        data["proposal_templates"].append(template_data)
    
    save_data(data)
    return True

def analyze_and_learn_proposal(file_path: str, filename: str, client_type: str = "") -> Dict[str, Any]:
    """Comprehensive proposal analysis and learning."""
    
    print(f"📚 Learning from proposal: {filename}")
    
    try:
        # Extract text content
        with open(file_path, 'rb') as f:
            content_bytes = f.read()
        content = file_to_text(content_bytes, filename)
        
        if not content.strip():
            raise Exception("No text content extracted")
        
        print(f"📄 Extracted {len(content)} characters from {filename}")
        
        # Extract structure and metadata
        structure_analysis = extract_proposal_structure(content, filename)
        
        # Learn writing styles for different sections
        section_styles = {}
        toc = structure_analysis.get("table_of_contents", [])
        
        for section in toc[:5]:  # Analyze top 5 sections
            section_title = section.get("title", "")
            section_content = extract_section_content(content, section_title)
            
            if section_content != "SECTION_NOT_FOUND":
                section_type = section_title.lower().replace(" ", "_")
                style_analysis = learn_writing_style(section_content, section_type)
                section_styles[section_type] = {
                    "content_sample": section_content[:500],  # Store sample for reference
                    "style_profile": style_analysis,
                    "length": len(section_content.split())
                }
        
        # Create template object
        template = {
            "name": filename.replace(".pdf", "").replace(".docx", ""),
            "client_type": client_type or structure_analysis.get("metadata", {}).get("client_type", ""),
            "industry": structure_analysis.get("metadata", {}).get("industry", ""),
            "structure": structure_analysis.get("structure", {}),
            "table_of_contents": structure_analysis.get("table_of_contents", []),
            "tone_profile": structure_analysis.get("tone_profile", {}),
            "content_patterns": structure_analysis.get("content_patterns", {}),
            "section_styles": section_styles,
            "metadata": structure_analysis.get("metadata", {}),
            "source_file": filename,
            "learned_at": datetime.now().isoformat(),
            "total_sections": len(toc),
            "avg_section_length": structure_analysis.get("structure", {}).get("avg_section_length", 0)
        }
        
        # Save template
        save_proposal_template(template)
        
        print(f"✅ Successfully learned from {filename}")
        print(f"   - Client Type: {template['client_type']}")
        print(f"   - Sections: {template['total_sections']}")
        print(f"   - Tone: {template['tone_profile'].get('formality', 'unknown')}")
        
        return template
        
    except Exception as e:
        print(f"❌ Error learning from proposal {filename}: {e}")
        return {}

def generate_proposal_from_template(
    rfq_name: str,
    client_type: str,
    proposal_type: str = "",
    requirements: List[str] = None
) -> Dict[str, Any]:
    """Generate a new proposal based on learned templates."""
    
    print(f"🎯 Generating {client_type} proposal for RFQ: {rfq_name}")
    
    # Find similar templates
    similar_templates = find_similar_proposals(client_type, proposal_type)
    
    if not similar_templates:
        print(f"⚠️ No templates found for {client_type}. Using standard generation.")
        return {"error": f"No templates found for {client_type} proposals"}
    
    best_template = similar_templates[0]
    print(f"📋 Using template: {best_template.get('name')} (score: {best_template.get('similarity_score')})")
    
    # Get RFQ context
    collection = safe_collection_name(f"rfq_{rfq_name}")
    rfq_context = ""
    try:
        docs = search("requirements objectives scope", k=8, collection=collection)
        rfq_context = format_context(docs)
    except:
        print("⚠️ Could not retrieve RFQ context")
    
    # Generate proposal using template structure
    proposal_sections = []
    toc = best_template.get("table_of_contents", [])
    
    for section in toc:
        section_title = section.get("title", "")
        section_type = section_title.lower().replace(" ", "_")
        
        print(f"  📝 Generating: {section_title}")
        
        content = generate_adaptive_section(
            section_type=section_type,
            rfq_context=rfq_context,
            template_examples=similar_templates,
            client_type=client_type
        )
        
        proposal_sections.append({
            "title": section_title,
            "type": section_type,
            "content": content,
            "template_source": best_template.get("name", "")
        })
    
    # Create final proposal
    proposal = {
        "template_used": best_template.get("name", ""),
        "client_type": client_type,
        "proposal_type": proposal_type,
        "sections": proposal_sections,
        "structure_match": best_template.get("structure", {}),
        "tone_profile": best_template.get("tone_profile", {}),
        "generated_at": datetime.now().isoformat(),
        "rfq_name": rfq_name,
        "similarity_score": best_template.get("similarity_score", 0)
    }
    
    print(f"✅ Generated proposal with {len(proposal_sections)} sections using {best_template.get('name')} template")
    
    return proposal