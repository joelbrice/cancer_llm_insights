"""Multilingual text utilities: normalization, sentence spans, tokenization, stemming."""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

import snowballstemmer

_WS = re.compile(r"[ \t  -​]+")
_MULTI_NL = re.compile(r"\n{3,}")
_WORD = re.compile(r"[^\W_]+(?:[-'’][^\W_]+)*", re.UNICODE)
_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

STOPWORDS: dict[str, frozenset[str]] = {
    "en": frozenset(
        ["a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves", "also", "may", "might", "must", "shall", "than", "via", "per"]
    ),
    "fr": frozenset(
        ["au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "et", "eux", "il", "ils", "je", "la", "le", "les", "leur", "lui", "ma", "mais", "me", "même", "mes", "moi", "mon", "ne", "nos", "notre", "nous", "on", "ou", "où", "par", "pas", "pour", "qu", "que", "qui", "sa", "se", "ses", "son", "sur", "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre", "vous", "c", "d", "j", "l", "à", "m", "n", "s", "t", "y", "été", "être", "avoir", "ai", "as", "avons", "avez", "ont", "est", "sont", "était", "sera", "cette", "cet", "ceux", "celle", "celles", "plus", "moins", "très", "aussi", "comme", "si", "sans", "sous", "entre", "donc", "car", "ni", "leurs", "quel", "quelle", "quels", "quelles", "dont", "peut", "peuvent", "doit", "fait", "faire"]
    ),
    "es": frozenset(
        ["de", "la", "que", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un", "para", "con", "no", "una", "su", "al", "lo", "como", "más", "pero", "sus", "le", "ya", "o", "este", "sí", "porque", "esta", "entre", "cuando", "muy", "sin", "sobre", "también", "me", "hasta", "hay", "donde", "quien", "desde", "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", "e", "esto", "mí", "antes", "algunos", "qué", "unos", "yo", "otro", "otras", "otra", "él", "tanto", "esa", "estos", "mucho", "quienes", "nada", "muchos", "cual", "poco", "ella", "estar", "estas", "algunas", "algo", "nosotros", "mi", "mis", "tú", "te", "ti", "tu", "tus", "es", "son", "fue", "ser", "está", "están", "puede", "pueden"]
    ),
    "pt": frozenset(
        ["de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com", "não", "uma", "os", "no", "se", "na", "por", "mais", "as", "dos", "como", "mas", "foi", "ao", "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito", "há", "nos", "já", "está", "eu", "também", "só", "pelo", "pela", "até", "isso", "ela", "entre", "era", "depois", "sem", "mesmo", "aos", "ter", "seus", "quem", "nas", "me", "esse", "eles", "estão", "você", "tinha", "foram", "essa", "num", "nem", "suas", "meu", "às", "minha", "têm", "numa", "pelos", "elas", "havia", "seja", "qual", "será", "nós", "tenho", "lhe", "deles", "essas", "esses", "pelas", "este", "fosse", "dele", "são", "pode", "podem"]
    ),
    "de": frozenset(
        ["aber", "alle", "allem", "allen", "aller", "alles", "als", "also", "am", "an", "ander", "andere", "anderem", "anderen", "anderer", "anderes", "auch", "auf", "aus", "bei", "bin", "bis", "bist", "da", "damit", "dann", "das", "dass", "dein", "deine", "dem", "den", "der", "des", "dessen", "die", "dies", "diese", "diesem", "diesen", "dieser", "dieses", "doch", "dort", "du", "durch", "ein", "eine", "einem", "einen", "einer", "eines", "er", "es", "etwas", "euer", "eure", "für", "hatte", "hatten", "hier", "hin", "hinter", "ich", "ihr", "ihre", "im", "in", "indem", "ins", "ist", "jede", "jedem", "jeden", "jeder", "jedes", "jene", "jetzt", "kann", "kein", "keine", "können", "machen", "man", "manche", "mein", "meine", "mich", "mir", "mit", "muss", "nach", "nicht", "nichts", "noch", "nun", "nur", "ob", "oder", "ohne", "sehr", "sein", "seine", "sich", "sie", "sind", "so", "solche", "soll", "sondern", "sonst", "über", "um", "und", "uns", "unser", "unter", "viel", "vom", "von", "vor", "während", "war", "waren", "warst", "was", "weg", "weil", "weiter", "welche", "wenn", "werde", "werden", "wie", "wieder", "will", "wir", "wird", "wo", "wollen", "zu", "zum", "zur", "zwar", "zwischen"]
    ),
}

# Question words that carry no topical information (stemmed + folded forms, all supported languages).
QUERY_FILLERS = frozenset([
    # en
    "doe", "effect", "best", "good", "realli", "true", "help", "way", "much", "mani", "know", "tell", "explain",
    "pleas", "anyth", "someth", "thing", "what", "how", "whi", "which", "recommend", "advic", "tip", "question",
    "affect", "impact", "influenc", "caus",
    # fr / es / pt / de
    "vrai", "aid", "meilleur", "conseil", "quoi", "comment", "pourquoi", "quel", "effet", "provoqu",
    "bueno", "mejor", "verdad", "ayud", "consej", "como", "por", "que", "efecto", "provoc",
    "bom", "melhor", "ajud", "conselh", "efeito",
    "gut", "wahr", "hilf", "tipp", "wie", "warum", "welch", "wirk", "auswirk",
])

_STEMMER_LANG = {"en": "english", "fr": "french", "es": "spanish", "pt": "portuguese", "de": "german",
                 "it": "italian", "nl": "dutch", "ar": "arabic"}

# ── Languages added after 1.0 (Italian, Arabic) ──────────────────────────────────────────────────────────────
# Kept OUT of STOPWORDS / QUERY_FILLERS on purpose: those tables are shared by every language (the hashing
# embedder drops the union of all stopwords), so adding words there would change retrieval for the original
# five languages. These apply only when the text's language is "it" or "ar".
_AR_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
_AR_LETTERS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ؤ": "و", "ئ": "ي", "ة": "ه"})


def normalize_arabic(text: str) -> str:
    """Light Arabic normalisation for matching: drop diacritics and tatweel, unify alef/yaa/taa marbuta forms."""
    return _AR_DIACRITICS.sub("", text).translate(_AR_LETTERS)


EXTRA_STOPWORDS: dict[str, frozenset[str]] = {
    "it": frozenset(
        ["a", "ad", "al", "allo", "ai", "agli", "all", "alla", "alle", "con", "col", "coi", "da", "dal", "dallo", "dai", "dagli", "dall", "dalla", "dalle", "di", "del", "dello", "dei", "degli", "dell", "della", "delle", "in", "nel", "nello", "nei", "negli", "nell", "nella", "nelle", "su", "sul", "sullo", "sui", "sugli", "sull", "sulla", "sulle", "per", "tra", "fra", "il", "lo", "la", "i", "gli", "le", "l", "un", "uno", "una", "e", "ed", "o", "od", "ma", "che", "chi", "cui", "non", "più", "anche", "come", "se", "perché", "quando", "dove", "quale", "quali", "quanto", "quanta", "questo", "questa", "questi", "queste", "quello", "quella", "quelli", "quelle", "mi", "ti", "si", "ci", "vi", "ne", "io", "tu", "lui", "lei", "noi", "voi", "loro", "mio", "mia", "miei", "mie", "tuo", "tua", "tuoi", "tue", "suo", "sua", "suoi", "sue", "nostro", "nostra", "vostro", "vostra", "è", "sono", "sei", "siamo", "siete", "era", "erano", "essere", "stato", "stata", "stati", "ho", "hai", "ha", "abbiamo", "avete", "hanno", "avere", "può", "possono", "molto", "poco", "tutto", "tutti", "ogni", "già", "ancora", "solo", "sempre", "dopo", "prima", "senza", "sotto", "sopra", "cosa", "così", "quindi", "però", "nemmeno", "neanche"]
    ),
    "ar": frozenset(normalize_arabic(w) for w in [
        "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي", "الذين", "هو", "هي", "هم", "هن", "أنا", "أنت", "نحن", "كان", "كانت", "يكون", "تكون", "أن", "إن", "أو", "و", "ثم", "لا", "لم", "لن", "ما", "ماذا", "هل", "كيف", "لماذا", "متى", "أين", "كل", "بعض", "قد", "لقد", "عند", "بين", "حتى", "إذا", "لكن", "غير", "بعد", "قبل", "حول", "أي", "أيضا", "فقط", "جدا", "ذو", "ذات", "له", "لها", "لهم", "به", "بها", "فيه", "فيها", "منه", "منها", "عليه", "عليها", "هناك", "هنا", "يمكن", "هؤلاء", "أولئك", "كما", "لدى", "لدي", "عندي", "وهو", "وهي", "ولا", "وما", "فهل",
    ]),
}

# Stemmed question words with no topical content, per added language.
EXTRA_QUERY_FILLERS: dict[str, frozenset[str]] = {
    "it": frozenset(["come", "perch", "qual", "cos", "aiut", "consigl", "miglior", "buon", "ver", "effett", "influ", "caus",
                     "domand", "spieg", "dir", "sapere", "cosa", "fa"]),
    "ar": frozenset(normalize_arabic(w) for w in ["كيف", "لماذا", "ماذا", "هل", "ما", "افضل", "نصيحه", "نصائح", "تاثير", "يسبب", "يساعد"]),
}


def stopwords(lang: str) -> frozenset[str]:
    return STOPWORDS.get(lang) or EXTRA_STOPWORDS.get(lang) or STOPWORDS["en"]


def query_fillers(lang: str | None) -> frozenset[str]:
    extra = EXTRA_QUERY_FILLERS.get((lang or "")[:2])
    return QUERY_FILLERS | extra if extra else QUERY_FILLERS

_ABBREVIATIONS = frozenset([
    "e.g", "i.e", "et", "al", "etc", "vs", "fig", "figs", "no", "nos", "dr", "prof", "mr", "mrs", "ms", "approx",
    "ca", "cf", "resp", "p", "pp", "vol", "eds", "ed", "incl", "min", "max", "mg", "kg", "ml", "km", "jan", "feb",
    "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "st", "sr", "jr", "inc", "ltd", "co",
    "dept", "univ", "env", "mme", "mlle", "m", "ex", "sra", "dra",
])
_CITE = r"\s?\[\d+(?:\s*[,;–-]\s*\d+)*\]"
# group 2 keeps closing quotes/brackets AND citation markers ("… cancer. [1][2]") with the sentence they follow
_SENT_BOUNDARY = re.compile(
    r"([.!?…؟]+|[。！？])((?:[\"'”’)\]]|" + _CITE + r")*)(\s+)(?=(?!\[\d)[\"'“‘(\[¿¡]?[A-ZÀ-ÖØ-Þ0-9•\-\u0621-\u064A])"
)
_BLOCK_START = re.compile(r"^\s*(?:[•\-*–·]\s|\d{1,2}[.)]\s|#{1,6}\s)")


def normalize_whitespace(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = _CONTROL.sub(" ", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _HYPHEN_BREAK.sub(r"\1\2", text)
    lines = [_WS.sub(" ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    return _MULTI_NL.sub("\n\n", text).strip()


_LIGATURES = str.maketrans({"œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE", "ß": "ss", "ẞ": "SS"})


def fold_accents(text: str) -> str:
    """Strip diacritics and expand ligatures (lymphœdème → lymphoedeme, Größe → Grosse) for matching."""
    decomposed = unicodedata.normalize("NFKD", text.translate(_LIGATURES))
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def content_fingerprint(text: str) -> str:
    """Fingerprint robust to whitespace/case changes (used for de-duplication)."""
    return sha256_text(fold_accents(re.sub(r"\s+", " ", text).strip().lower()))


def words(text: str) -> list[str]:
    return _WORD.findall(text)


def estimate_tokens(text: str) -> int:
    """Approximate LLM token count (multilingual BPE averages ~1.35 tokens/word, ~4 chars/token)."""
    if not text:
        return 0
    return max(int(len(words(text)) * 1.35), len(text) // 4)


@lru_cache(maxsize=16)
def _stemmer(lang: str) -> snowballstemmer.stemmer | None:
    name = _STEMMER_LANG.get(lang)
    return snowballstemmer.stemmer(name) if name else None


@lru_cache(maxsize=200_000)
def _stem(token: str, lang: str) -> str:
    stemmer = _stemmer(lang)
    return stemmer.stemWord(token) if stemmer else token


def analyze(text: str, lang: str | None = None, *, keep_stopwords: bool = False) -> list[str]:
    """Tokenize → lowercase → drop stopwords → stem → fold accents. Used by BM25 and verification."""
    lang = (lang or "en")[:2]
    stop = stopwords(lang)
    if lang == "ar":
        text = normalize_arabic(text)
    out: list[str] = []
    for raw in words(text.lower()):
        for token in raw.replace("’", "'").split("'"):
            if not token or (not keep_stopwords and token in stop):
                continue
            if len(token) == 1 and not token.isdigit():
                continue
            out.append(fold_accents(_stem(token, lang)))
    return out


def idf_weights(term_sets: list[set[str]]) -> dict[str, float]:
    """Inverse document frequency over a small local collection (a candidate pool or sentence set)."""
    n = len(term_sets)
    df: dict[str, int] = {}
    for terms in term_sets:
        for term in terms:
            df[term] = df.get(term, 0) + 1
    return {term: max(0.05, math.log((n + 1) / (count + 0.5))) for term, count in df.items()}


def weighted_coverage(query_terms: set[str], text_terms: set[str], idf: dict[str, float],
                      language: str | None = None) -> float:
    """Share of the query's information (IDF mass) present in the text: generic words count less, and query
    terms found nowhere in the collection (e.g. "radon" in a corpus without radon) count the most."""
    query_terms = query_terms - query_fillers(language)
    if not query_terms:
        return 0.0
    unseen = max(idf.values(), default=1.0)
    total = sum(idf.get(t, unseen) for t in query_terms)
    return sum(idf.get(t, unseen) for t in query_terms & text_terms) / total if total else 0.0


@dataclass(frozen=True, slots=True)
class Span:
    start: int
    end: int
    text: str


def _paragraphs(text: str) -> list[tuple[int, int]]:
    """Paragraph spans: blank lines, bullet/numbered/heading lines and lines after a colon start a new block;
    other line breaks are soft wraps (PDF extraction) and stay inside the paragraph."""
    paras: list[tuple[int, int]] = []
    pos, cur_start, cur_end, prev_line = 0, None, 0, ""
    for line in text.split("\n"):
        line_start, line_end = pos, pos + len(line)
        pos = line_end + 1
        if not line.strip():
            if cur_start is not None:
                paras.append((cur_start, cur_end))
                cur_start = None
            continue
        if cur_start is not None and (_BLOCK_START.match(line) or prev_line.rstrip().endswith(":")):
            paras.append((cur_start, cur_end))
            cur_start = None
        if cur_start is None:
            cur_start = line_start
        cur_end, prev_line = line_end, line
    if cur_start is not None:
        paras.append((cur_start, cur_end))
    return paras


def sentence_spans(text: str) -> list[Span]:
    """Split text into sentences, returning character offsets into `text`.

    Handles abbreviations (e.g., et al., Fig.), decimals (3.5), trailing citation markers ("… [1][2]"),
    bullet lines and paragraph breaks.
    """
    spans: list[Span] = []
    for p_start, p_end in _paragraphs(text):
        para, base = text[p_start:p_end], p_start
        cursor = 0
        for match in _SENT_BOUNDARY.finditer(para):
            if match.group(1) == ".":
                tail = re.search(r"([\w.]+)\.+$", para[cursor: match.end(1)])
                if tail:
                    last = tail.group(1).lower().rstrip(".")
                    if last in _ABBREVIATIONS or (len(last) == 1 and last.isalpha()):
                        continue
            _push(spans, para, base, cursor, match.end(2))
            cursor = match.end(3)
        _push(spans, para, base, cursor, len(para))
    return spans


def _push(spans: list[Span], para: str, base: int, start: int, end: int) -> None:
    segment = para[start:end]
    stripped = segment.strip()
    if not stripped:
        return
    offset = start + (len(segment) - len(segment.lstrip()))
    spans.append(Span(base + offset, base + offset + len(stripped), stripped))


def split_sentences(text: str) -> list[str]:
    return [s.text for s in sentence_spans(text)]


_NUMBER = re.compile(r"(?<![\w.])(\d+(?:[.,]\d+)?)\s*(%|percent|pour ?cent|por ?ciento|por ?cento|prozent)?", re.I)


def extract_numbers(text: str) -> set[str]:
    """Numbers (normalized decimal separator) — used to catch hallucinated statistics."""
    found = set()
    for match in _NUMBER.finditer(text):
        value = match.group(1).replace(",", ".")
        if re.fullmatch(r"(19|20)\d\d", value):
            continue  # years are checked separately (citations carry them)
        found.add(value.rstrip("0").rstrip(".") if "." in value else value)
    return found


def truncate(text: str, limit: int, ellipsis: str = "…") -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - len(ellipsis)]
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,;:") + ellipsis


def slugify(value: str, max_len: int = 80) -> str:
    value = fold_accents(value).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:max_len].strip("-") or "item"
