"""Server-side strings (evidence rationales, abstentions, disclaimers) in the supported languages."""

from __future__ import annotations

LANGUAGE_NAMES = {"en": "English", "fr": "French (français)", "es": "Spanish (español)",
                  "pt": "Portuguese (português)", "de": "German (Deutsch)"}

MESSAGES: dict[str, dict[str, str]] = {
    "disclaimer": {
        "en": "Educational information based on published evidence — not a diagnosis or a substitute for your care team.",
        "fr": "Information éducative fondée sur des données publiées — ni un diagnostic, ni un substitut à votre équipe soignante.",
        "es": "Información educativa basada en evidencia publicada: no es un diagnóstico ni sustituye a su equipo médico.",
        "pt": "Informação educativa baseada em evidência publicada — não é um diagnóstico nem substitui a sua equipa de saúde.",
        "de": "Bildungsinformation auf Grundlage veröffentlichter Evidenz – keine Diagnose und kein Ersatz für Ihr Behandlungsteam.",
    },
    "abstain": {
        "en": "I couldn't find enough reliable evidence in the library to answer this confidently. Rather than guess, I suggest discussing it with your doctor or care team.",
        "fr": "Je n'ai pas trouvé suffisamment de preuves fiables dans la bibliothèque pour répondre avec confiance. Plutôt que de deviner, je vous suggère d'en parler à votre médecin ou à votre équipe soignante.",
        "es": "No encontré suficiente evidencia fiable en la biblioteca para responder con seguridad. En lugar de suponer, le sugiero comentarlo con su médico o equipo de salud.",
        "pt": "Não encontrei evidência fiável suficiente na biblioteca para responder com confiança. Em vez de adivinhar, sugiro que fale com o seu médico ou equipa de saúde.",
        "de": "Ich habe in der Bibliothek nicht genug verlässliche Evidenz gefunden, um dies sicher zu beantworten. Statt zu raten, besprechen Sie es bitte mit Ihrer Ärztin, Ihrem Arzt oder Ihrem Behandlungsteam.",
    },
    "awaiting_data": {
        "en": "The evidence library is still empty — answers will be available as soon as research documents are connected.",
        "fr": "La bibliothèque de preuves est encore vide — les réponses seront disponibles dès que des documents de recherche seront connectés.",
        "es": "La biblioteca de evidencia aún está vacía: las respuestas estarán disponibles en cuanto se conecten documentos de investigación.",
        "pt": "A biblioteca de evidência ainda está vazia — as respostas estarão disponíveis assim que forem ligados documentos de investigação.",
        "de": "Die Evidenzbibliothek ist noch leer – Antworten sind verfügbar, sobald Forschungsdokumente verbunden sind.",
    },
    "extractive_intro": {
        "en": "Here is what the sources in the library say:",
        "fr": "Voici ce que disent les sources de la bibliothèque :",
        "es": "Esto es lo que dicen las fuentes de la biblioteca:",
        "pt": "Eis o que dizem as fontes da biblioteca:",
        "de": "Das sagen die Quellen in der Bibliothek:",
    },
    "sources_other_language": {
        "en": "Quoted passages are shown in their original language.",
        "fr": "Les passages cités sont présentés dans leur langue d'origine.",
        "es": "Los fragmentos citados se muestran en su idioma original.",
        "pt": "Os excertos citados são apresentados na língua original.",
        "de": "Zitierte Passagen werden in ihrer Originalsprache angezeigt.",
    },
    "evidence_strength": {
        "en": "Overall strength of evidence: {label} ({grade}).",
        "fr": "Niveau de preuve global : {label} ({grade}).",
        "es": "Solidez global de la evidencia: {label} ({grade}).",
        "pt": "Força global da evidência: {label} ({grade}).",
        "de": "Gesamtstärke der Evidenz: {label} ({grade}).",
    },
    "next_step": {
        "en": "Talk with your doctor or care team before making major changes, especially during treatment.",
        "fr": "Parlez-en à votre médecin ou à votre équipe soignante avant tout changement important, surtout pendant un traitement.",
        "es": "Hable con su médico o equipo de salud antes de hacer cambios importantes, especialmente durante el tratamiento.",
        "pt": "Fale com o seu médico ou equipa de saúde antes de fazer mudanças importantes, sobretudo durante o tratamento.",
        "de": "Sprechen Sie vor größeren Veränderungen – besonders während einer Behandlung – mit Ihrem Behandlungsteam.",
    },
    # ── evidence rationale ──
    "r_sources": {
        "en": "Based on {n} independent source(s).",
        "fr": "Fondé sur {n} source(s) indépendante(s).",
        "es": "Basado en {n} fuente(s) independiente(s).",
        "pt": "Baseado em {n} fonte(s) independente(s).",
        "de": "Basierend auf {n} unabhängigen Quelle(n).",
    },
    "r_designs": {
        "en": "Study designs: {designs}.",
        "fr": "Types d'études : {designs}.",
        "es": "Diseños de estudio: {designs}.",
        "pt": "Desenhos de estudo: {designs}.",
        "de": "Studiendesigns: {designs}.",
    },
    "r_strongest": {
        "en": "Strongest source: {design}{year}.",
        "fr": "Source la plus solide : {design}{year}.",
        "es": "Fuente más sólida: {design}{year}.",
        "pt": "Fonte mais sólida: {design}{year}.",
        "de": "Stärkste Quelle: {design}{year}.",
    },
    "r_authoritative": {
        "en": "Includes guidance from an authoritative health body.",
        "fr": "Inclut des recommandations d'un organisme de santé de référence.",
        "es": "Incluye recomendaciones de un organismo sanitario de referencia.",
        "pt": "Inclui orientações de uma entidade de saúde de referência.",
        "de": "Enthält Empfehlungen einer maßgeblichen Gesundheitsbehörde.",
    },
    "r_single_source": {
        "en": "Only one source — confirmation by other studies is needed.",
        "fr": "Une seule source — une confirmation par d'autres études est nécessaire.",
        "es": "Una sola fuente: se necesita confirmación por otros estudios.",
        "pt": "Apenas uma fonte — é necessária confirmação por outros estudos.",
        "de": "Nur eine Quelle – eine Bestätigung durch weitere Studien ist nötig.",
    },
    "r_observational": {
        "en": "Evidence is observational: it shows associations, which do not by themselves prove cause and effect.",
        "fr": "Les données sont observationnelles : elles montrent des associations, qui ne prouvent pas à elles seules un lien de cause à effet.",
        "es": "La evidencia es observacional: muestra asociaciones, que por sí solas no demuestran causa y efecto.",
        "pt": "A evidência é observacional: mostra associações, que por si só não provam causa e efeito.",
        "de": "Die Evidenz ist beobachtend: Sie zeigt Zusammenhänge, die für sich allein keine Ursache-Wirkung belegen.",
    },
    "r_old": {
        "en": "The newest source dates from {year}; more recent research could change this.",
        "fr": "La source la plus récente date de {year} ; des recherches plus récentes pourraient changer cette conclusion.",
        "es": "La fuente más reciente es de {year}; investigaciones más recientes podrían cambiar esto.",
        "pt": "A fonte mais recente é de {year}; investigação mais recente poderá alterar esta conclusão.",
        "de": "Die neueste Quelle stammt aus {year}; neuere Forschung könnte dies ändern.",
    },
    "r_recent": {
        "en": "Sources published between {start} and {end}.",
        "fr": "Sources publiées entre {start} et {end}.",
        "es": "Fuentes publicadas entre {start} y {end}.",
        "pt": "Fontes publicadas entre {start} e {end}.",
        "de": "Quellen veröffentlicht zwischen {start} und {end}.",
    },
    "r_consistent": {
        "en": "Sources point in the same direction.",
        "fr": "Les sources vont dans le même sens.",
        "es": "Las fuentes apuntan en la misma dirección.",
        "pt": "As fontes apontam no mesmo sentido.",
        "de": "Die Quellen weisen in dieselbe Richtung.",
    },
    "r_mixed": {
        "en": "Some sources report different or null findings.",
        "fr": "Certaines sources rapportent des résultats différents ou nuls.",
        "es": "Algunas fuentes informan resultados diferentes o nulos.",
        "pt": "Algumas fontes relatam resultados diferentes ou nulos.",
        "de": "Einige Quellen berichten abweichende oder keine Effekte.",
    },
    "r_partial_support": {
        "en": "Some statements are only partially supported by the quoted passages.",
        "fr": "Certaines affirmations ne sont que partiellement étayées par les passages cités.",
        "es": "Algunas afirmaciones solo están parcialmente respaldadas por los fragmentos citados.",
        "pt": "Algumas afirmações são apenas parcialmente suportadas pelos excertos citados.",
        "de": "Einige Aussagen werden von den zitierten Passagen nur teilweise gestützt.",
    },
    "r_cap_no_human": {
        "en": "No human studies among the sources — grade capped at Low.",
        "fr": "Aucune étude chez l'humain parmi les sources — niveau plafonné à Faible.",
        "es": "Ningún estudio en humanos entre las fuentes: grado limitado a Bajo.",
        "pt": "Nenhum estudo em humanos entre as fontes — grau limitado a Baixo.",
        "de": "Keine Humanstudien unter den Quellen – Bewertung auf Niedrig begrenzt.",
    },
    "r_cap_secondary_only": {
        "en": "Only blogs or news articles — grade capped at Very low.",
        "fr": "Uniquement des blogs ou articles de presse — niveau plafonné à Très faible.",
        "es": "Solo blogs o noticias: grado limitado a Muy bajo.",
        "pt": "Apenas blogues ou notícias — grau limitado a Muito baixo.",
        "de": "Nur Blogs oder Nachrichtenartikel – Bewertung auf Sehr niedrig begrenzt.",
    },
    "r_cap_observational": {
        "en": "No systematic review, trial or guideline — grade capped at Moderate.",
        "fr": "Ni revue systématique, ni essai, ni recommandation — niveau plafonné à Modéré.",
        "es": "Sin revisión sistemática, ensayo ni guía: grado limitado a Moderado.",
        "pt": "Sem revisão sistemática, ensaio ou diretriz — grau limitado a Moderado.",
        "de": "Keine systematische Übersicht, Studie oder Leitlinie – Bewertung auf Mittel begrenzt.",
    },
    "r_none": {
        "en": "No supporting source was found in the library.",
        "fr": "Aucune source à l'appui n'a été trouvée dans la bibliothèque.",
        "es": "No se encontró ninguna fuente de apoyo en la biblioteca.",
        "pt": "Não foi encontrada nenhuma fonte de suporte na biblioteca.",
        "de": "In der Bibliothek wurde keine stützende Quelle gefunden.",
    },
}

LEVEL_LABELS = {
    "high": {"en": "High", "fr": "Élevé", "es": "Alto", "pt": "Alto", "de": "Hoch"},
    "moderate": {"en": "Moderate", "fr": "Modéré", "es": "Moderado", "pt": "Moderado", "de": "Mittel"},
    "low": {"en": "Low", "fr": "Faible", "es": "Bajo", "pt": "Baixo", "de": "Niedrig"},
    "very_low": {"en": "Very low", "fr": "Très faible", "es": "Muy bajo", "pt": "Muito baixo", "de": "Sehr niedrig"},
    "insufficient": {"en": "Insufficient", "fr": "Insuffisant", "es": "Insuficiente", "pt": "Insuficiente",
                     "de": "Unzureichend"},
}

DESIGN_LABELS = {
    "umbrella_review": {"en": "umbrella review", "fr": "revue parapluie", "es": "revisión paraguas",
                        "pt": "revisão guarda-chuva", "de": "Umbrella-Review"},
    "meta_analysis": {"en": "meta-analysis", "fr": "méta-analyse", "es": "metaanálisis", "pt": "meta-análise",
                      "de": "Metaanalyse"},
    "systematic_review": {"en": "systematic review", "fr": "revue systématique", "es": "revisión sistemática",
                          "pt": "revisão sistemática", "de": "systematische Übersicht"},
    "guideline": {"en": "guideline", "fr": "recommandation", "es": "guía", "pt": "diretriz", "de": "Leitlinie"},
    "rct": {"en": "randomised trial", "fr": "essai randomisé", "es": "ensayo aleatorizado",
            "pt": "ensaio randomizado", "de": "randomisierte Studie"},
    "cohort": {"en": "cohort study", "fr": "étude de cohorte", "es": "estudio de cohorte", "pt": "estudo de coorte",
               "de": "Kohortenstudie"},
    "case_control": {"en": "case-control study", "fr": "étude cas-témoins", "es": "estudio de casos y controles",
                     "pt": "estudo caso-controlo", "de": "Fall-Kontroll-Studie"},
    "cross_sectional": {"en": "cross-sectional study", "fr": "étude transversale", "es": "estudio transversal",
                        "pt": "estudo transversal", "de": "Querschnittstudie"},
    "narrative_review": {"en": "narrative review", "fr": "revue narrative", "es": "revisión narrativa",
                         "pt": "revisão narrativa", "de": "narrative Übersicht"},
    "case_series": {"en": "case report", "fr": "série de cas", "es": "serie de casos", "pt": "série de casos",
                    "de": "Fallserie"},
    "expert_opinion": {"en": "expert opinion", "fr": "avis d'expert", "es": "opinión de expertos",
                       "pt": "opinião de especialistas", "de": "Expertenmeinung"},
    "institutional_web": {"en": "institutional information", "fr": "information institutionnelle",
                          "es": "información institucional", "pt": "informação institucional",
                          "de": "institutionelle Information"},
    "preclinical": {"en": "lab/animal study", "fr": "étude préclinique", "es": "estudio preclínico",
                    "pt": "estudo pré-clínico", "de": "präklinische Studie"},
    "news": {"en": "news article", "fr": "article de presse", "es": "noticia", "pt": "notícia",
             "de": "Nachrichtenartikel"},
    "blog": {"en": "blog", "fr": "blog", "es": "blog", "pt": "blogue", "de": "Blog"},
    "unknown": {"en": "unclassified source", "fr": "source non classée", "es": "fuente sin clasificar",
                "pt": "fonte não classificada", "de": "nicht klassifizierte Quelle"},
}


def t(key: str, lang: str, **params: object) -> str:
    table = MESSAGES.get(key, {})
    template = table.get(lang) or table.get("en") or key
    return template.format(**params) if params else template


def level_label(level: str, lang: str) -> str:
    return LEVEL_LABELS.get(level, {}).get(lang) or LEVEL_LABELS.get(level, {}).get("en", level)


def design_label(source_type: str, lang: str) -> str:
    labels = DESIGN_LABELS.get(source_type) or DESIGN_LABELS["unknown"]
    return labels.get(lang) or labels["en"]
