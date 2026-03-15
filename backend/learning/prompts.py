CONTENT_GENERATION_PROMPT = """
Generate beginner-friendly learning content for a topic.

Return strict JSON with this exact shape:
{
  "spanish_text": "string",
  "german_text": "string",
  "keywords": [
    {"spanish_text": "string", "german_text": "string"}
  ]
}

Rules:
- Create exactly one simple Spanish sentence about the topic and its German translation.
- In "keywords", include only non-common vocabulary words from that sentence.
- Do not include articles, prepositions, conjunctions, pronouns, or very basic function words.
- Keep only meaningful content words useful for study.
- Keep "keywords" unique by spanish_text.
- Return JSON only, no markdown and no extra text.
""".strip()
