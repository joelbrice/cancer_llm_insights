"""
LLM Service - Provides a unified interface for LLM inference.

Supports multiple providers:
  - OpenAI (default, production)
  - Groq  (fast inference with Llama 3)
  - Ollama (local Llama 3, self-hosted)

Retrieval-Augmented Generation (RAG) is used to ground responses in
peer-reviewed research papers and oncology guidelines ingested into
a ChromaDB vector store.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert oncology health advisor with deep knowledge in:
- Cancer biology, prevention, and early detection
- Evidence-based nutrition and lifestyle for cancer prevention/management
- Research from peer-reviewed journals, oncology guidelines (WHO, ACS, IARC)
- Integrative and complementary approaches to cancer care

IMPORTANT GUIDELINES:
1. Always base your responses on scientific evidence; cite sources when possible.
2. Always include the medical disclaimer: responses are informational, not medical advice.
3. Be compassionate, clear, and avoid unnecessary medical jargon.
4. If the user is diagnosed with cancer, provide supportive and constructive guidance.
5. If risk indicators are unclear, say so honestly rather than speculate.
6. Respect cultural differences in diet and lifestyle.
7. Respond in the user's preferred language.
8. Provide a structured JSON response with: risk_level, risk_score, insights,
   lifestyle_recommendations, nutrition_recommendations, and references.
"""

ANALYSIS_TEMPLATE = """
Based on the following information from the user, provide a comprehensive cancer insight analysis.

User Input: {user_input}
Cancer Type Focus: {cancer_type}
Language: {language}

Please analyse the symptoms, lifestyle factors, and any risk indicators mentioned.
Provide your response as a valid JSON object with these exact keys:
{{
  "risk_level": "low|moderate|high|unknown",
  "risk_score": <float 0.0–1.0>,
  "insights": "<detailed analysis in {language}>",
  "lifestyle_recommendations": "<actionable lifestyle advice in {language}>",
  "nutrition_recommendations": "<specific nutrition advice in {language}>",
  "references": [
    {{"title": "...", "source": "...", "year": 2024, "url": "..."}}
  ]
}}
"""


def _build_llm_client():
    """Build the appropriate LLM client based on configuration."""
    provider = settings.LLM_PROVIDER.lower()

    if provider == "openai" and settings.OPENAI_API_KEY:
        try:
            from openai import AsyncOpenAI
            return "openai", AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        except ImportError:
            logger.warning("openai package not installed; falling back to mock")

    if provider == "groq" and settings.GROQ_API_KEY:
        try:
            from openai import AsyncOpenAI  # Groq uses OpenAI-compatible API
            return "groq", AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
            )
        except ImportError:
            logger.warning("openai package not installed; falling back to mock")

    if provider == "ollama":
        try:
            from openai import AsyncOpenAI
            return "ollama", AsyncOpenAI(
                api_key="ollama",
                base_url=f"{settings.OLLAMA_BASE_URL}/v1",
            )
        except ImportError:
            logger.warning("openai package not installed; falling back to mock")

    logger.warning("No LLM provider configured — using mock responses for demonstration")
    return "mock", None


def _get_model_name(provider: str) -> str:
    if provider == "openai":
        return settings.OPENAI_MODEL
    if provider == "groq":
        return settings.GROQ_MODEL
    if provider == "ollama":
        return settings.OLLAMA_MODEL
    return "mock"


_MOCK_RESPONSE = {
    "risk_level": "moderate",
    "risk_score": 0.42,
    "insights": (
        "Based on the information provided, several lifestyle factors may be worth reviewing "
        "in the context of cancer risk. Sedentary behaviour, processed food consumption, and "
        "chronic stress are associated with increased cancer risk according to multiple large "
        "cohort studies. Regular screening and consultation with a healthcare provider is "
        "strongly advised."
    ),
    "lifestyle_recommendations": (
        "1. Aim for at least 150 minutes of moderate-intensity physical activity per week.\n"
        "2. Quit smoking if applicable — tobacco is the leading preventable cause of cancer.\n"
        "3. Limit alcohol to no more than 1 unit/day.\n"
        "4. Maintain a healthy body weight (BMI 18.5–24.9).\n"
        "5. Manage stress through mindfulness, yoga, or counselling."
    ),
    "nutrition_recommendations": (
        "1. Eat a plant-rich diet: at least 5 portions of fruits and vegetables daily.\n"
        "2. Choose whole grains over refined carbohydrates.\n"
        "3. Limit red meat to < 500 g/week; avoid processed meats.\n"
        "4. Include anti-inflammatory foods: turmeric, green tea, berries, omega-3 rich fish.\n"
        "5. Stay well-hydrated with water; limit sugary drinks."
    ),
    "references": [
        {
            "title": "Diet, Nutrition, Physical Activity and Cancer: a Global Perspective",
            "source": "WCRF/AICR Cancer Prevention Recommendations 2018",
            "year": 2018,
            "url": "https://www.wcrf.org/cancer-prevention/cancer-prevention-recommendations/",
        },
        {
            "title": "Cancer statistics, 2024",
            "source": "CA: A Cancer Journal for Clinicians",
            "year": 2024,
            "url": "https://doi.org/10.3322/caac.21820",
        },
    ],
}


async def run_analysis(
    user_input: str,
    cancer_type: Optional[str] = None,
    language: str = "en",
    context_docs: Optional[list[str]] = None,
) -> dict:
    """
    Run an LLM analysis and return a structured dict with cancer insights.

    Parameters
    ----------
    user_input:
        The text describing symptoms, lifestyle factors, or health concerns.
    cancer_type:
        Optional specific cancer type to focus on.
    language:
        ISO 639-1 language code for the response.
    context_docs:
        Optional list of retrieved RAG documents to include in the prompt.
    """
    provider, client = _build_llm_client()

    if provider == "mock" or client is None:
        return _MOCK_RESPONSE

    # Build prompt with optional RAG context
    context_section = ""
    if context_docs:
        context_section = "\n\nRelevant Research Context:\n" + "\n---\n".join(
            context_docs[:3]
        )

    prompt = ANALYSIS_TEMPLATE.format(
        user_input=user_input,
        cancer_type=cancer_type or "general cancer prevention",
        language=language,
    ) + context_section

    model = _get_model_name(provider)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as exc:
        logger.error("LLM inference failed: %s — returning mock response", exc)
        return _MOCK_RESPONSE
