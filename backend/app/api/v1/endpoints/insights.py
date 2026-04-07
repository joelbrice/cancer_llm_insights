"""
Insights endpoints — research-backed cancer information and tips.
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.services.rag_service import rag_service, SEED_DOCUMENTS

router = APIRouter()

CANCER_TYPES = [
    "breast", "lung", "colorectal", "prostate", "skin", "cervical",
    "ovarian", "pancreatic", "liver", "stomach", "leukaemia", "lymphoma",
    "thyroid", "kidney", "bladder",
]


@router.get(
    "/cancer-types",
    summary="List supported cancer types",
    tags=["insights"],
)
async def list_cancer_types():
    """Returns a list of cancer types the platform can provide insights on."""
    return {
        "cancer_types": CANCER_TYPES,
        "note": "The platform can answer questions about any cancer type. "
                "This list reflects the most commonly covered types.",
    }


@router.get(
    "/research",
    summary="Search the research knowledge base",
    tags=["insights"],
)
async def search_research(
    query: str = Query(..., min_length=3, description="Search query"),
    n: int = Query(3, ge=1, le=10, description="Number of results"),
):
    """
    Full-text search through the ingested cancer research knowledge base.
    Returns relevant research snippets with source attribution.
    """
    docs = rag_service.retrieve(query, n_results=n)
    if not docs:
        return {"results": [], "message": "No matching research found for your query."}

    # Match back to metadata
    result_items = []
    for doc_text in docs:
        meta = {}
        for seed in SEED_DOCUMENTS:
            if seed["content"] == doc_text:
                meta = seed.get("metadata", {})
                break
        result_items.append({"content": doc_text, "source": meta})

    return {"results": result_items, "query": query}


@router.get(
    "/lifestyle-tips",
    summary="Get evidence-based lifestyle tips for cancer prevention",
    tags=["insights"],
)
async def lifestyle_tips(
    cancer_type: Optional[str] = Query(None, description="Optional cancer type filter"),
    language: str = Query("en", description="Language code"),
):
    """
    Returns a curated list of evidence-based lifestyle tips for cancer prevention.
    These are sourced from WCRF, ACS, IARC, and WHO guidelines.
    """
    tips = [
        {
            "category": "Physical Activity",
            "tip": "Get at least 150–300 min/week of moderate-intensity exercise.",
            "evidence": "Strong — ACS 2020 Guidelines",
        },
        {
            "category": "Diet",
            "tip": "Eat 5+ servings of fruits and vegetables daily.",
            "evidence": "Strong — WCRF/AICR 2018",
        },
        {
            "category": "Diet",
            "tip": "Limit red meat to < 500 g/week and avoid processed meats.",
            "evidence": "Strong — IARC Group 1 carcinogen",
        },
        {
            "category": "Alcohol",
            "tip": "Limit or avoid alcohol — no safe level for cancer risk.",
            "evidence": "Strong — IARC / WHO",
        },
        {
            "category": "Tobacco",
            "tip": "Do not smoke or use any tobacco products.",
            "evidence": "Very strong — IARC Group 1 carcinogens",
        },
        {
            "category": "Weight",
            "tip": "Maintain a healthy BMI (18.5–24.9) throughout adult life.",
            "evidence": "Strong — AICR 2018",
        },
        {
            "category": "Sun Protection",
            "tip": "Use SPF 30+ sunscreen and avoid tanning beds.",
            "evidence": "Strong — WCRF / IARC",
        },
        {
            "category": "Screening",
            "tip": "Participate in recommended cancer screening programmes for your age/sex.",
            "evidence": "Strong — national guidelines worldwide",
        },
        {
            "category": "Breastfeeding",
            "tip": "Breastfeed your baby if possible — protective for both mother and child.",
            "evidence": "Strong — WCRF 2018",
        },
        {
            "category": "Supplements",
            "tip": "Do not rely on supplements for cancer prevention; food-first approach is best.",
            "evidence": "WCRF 2018 recommendation",
        },
    ]

    return {
        "tips": tips,
        "language": language,
        "disclaimer": (
            "These tips are for informational purposes only and are based on current "
            "scientific evidence. They do not constitute medical advice."
        ),
    }


@router.get(
    "/nutrition-guide",
    summary="Get cancer-fighting nutrition guide",
    tags=["insights"],
)
async def nutrition_guide(
    cancer_type: Optional[str] = Query(None),
    language: str = Query("en"),
):
    """
    Provides a structured nutrition guide with anti-cancer foods,
    foods to limit, and meal planning principles.
    """
    guide = {
        "foods_to_include": [
            {"food": "Broccoli & cruciferous vegetables", "reason": "Sulforaphane — anti-cancer compound"},
            {"food": "Berries", "reason": "High in antioxidants (anthocyanins, ellagic acid)"},
            {"food": "Fatty fish (salmon, sardines)", "reason": "Omega-3 anti-inflammatory effects"},
            {"food": "Turmeric / curcumin", "reason": "Anti-inflammatory; may inhibit tumour growth"},
            {"food": "Green tea", "reason": "Catechins (EGCG) — antioxidant and anti-proliferative"},
            {"food": "Garlic & onions", "reason": "Organosulfur compounds — immune support"},
            {"food": "Legumes", "reason": "Fibre and phytoestrogens — colorectal cancer protection"},
            {"food": "Whole grains", "reason": "Dietary fibre — colorectal cancer protection"},
            {"food": "Tomatoes", "reason": "Lycopene — prostate cancer risk reduction"},
            {"food": "Nuts (walnuts, almonds)", "reason": "Vitamin E, omega-3, polyphenols"},
        ],
        "foods_to_limit": [
            {"food": "Processed meats (bacon, sausage)", "reason": "IARC Group 1 carcinogen"},
            {"food": "Red meat (> 500 g/week)", "reason": "IARC Group 2A probable carcinogen"},
            {"food": "Sugary beverages", "reason": "Linked to obesity — indirect cancer risk"},
            {"food": "Highly processed foods", "reason": "Often high in salt, sugar, trans fats"},
            {"food": "Alcohol", "reason": "Causal link to multiple cancer types"},
            {"food": "Charred/grilled meat", "reason": "Heterocyclic amines — carcinogens"},
        ],
        "meal_principles": [
            "Fill two-thirds of your plate with plant-based foods.",
            "Choose whole grain carbohydrates over refined.",
            "Use extra-virgin olive oil as your primary cooking fat.",
            "Season with herbs and spices rather than excess salt.",
            "Cook at lower temperatures to reduce carcinogen formation.",
        ],
        "cancer_type": cancer_type,
        "language": language,
        "disclaimer": "This guide is educational. Consult a registered dietitian for a personalised plan.",
    }
    return guide
