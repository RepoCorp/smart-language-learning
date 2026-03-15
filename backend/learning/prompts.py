CONTENT_GENERATION_PROMPT = """
Generate beginner-friendly learning content for a topic.

Return strict JSON with this exact shape:
{
  "spanish_text": "string",
  "german_text": "string",
  "notes": "string",
  "keywords": [
    {"spanish_text": "string", "german_text": "string", "notes": "string", "plural_german": "string"}
  ]
}

Rules:
- Create exactly one simple Spanish sentence about the topic and its German translation.
- In "keywords", include only non-common vocabulary words from that sentence.
- Do not include articles, prepositions, conjunctions, pronouns, or very basic function words.
- For each keyword, german_text must be singular and include its article (for example: "der Park", "die Stadt", "das Buch").
- Add plural_german with the plural form when applicable (for example "die Parks"). If not applicable, return an empty string.
- Include relevant study notes only when useful (for example gender/plural/usage notes). If none, return an empty string.
- Keep only meaningful content words useful for study.
- Keep "keywords" unique by spanish_text.
- Return JSON only, no markdown and no extra text.
""".strip()
