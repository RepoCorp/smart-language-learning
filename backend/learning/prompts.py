CONVERSATION_GENERATION_PROMPT = """
Generate beginner-friendly learning content for a topic.

Return strict JSON with this exact shape:
{
  "conversation": [
    {"spanish_text": "string", "german_text": "string", "notes": "string"}
  ]
}

Rules:
- Create a realistic, day-to-day conversation between two people with 6 to 12 very simple phrases.
- The dialogue must feel natural and coherent: each line should clearly respond to the previous one.
- Use common real-life situations (for example: greeting, buying something, ordering food, asking directions, meeting someone).
- If optional context is provided by the user, use it as the situation.
- Keep each phrase short and beginner level (A1-A2).
- Use spoken dialogue lines only (no narration, no stage directions, no bullet-like fragments).
- Spanish and German phrase must be equivalent in meaning.
- Keep a clear back-and-forth between the two speakers.
- Keep the whole dialogue within a single realistic interaction scope on the topic (no scene changes, no unrelated subtopics).
- Avoid weird jumps in topic, unnatural wording, or textbook/meta language.
- Include relevant study notes only when useful; otherwise use an empty string.
- Return JSON only, no markdown and no extra text.
""".strip()


PHRASE_KEYWORDS_PROMPT = """
Given one Spanish phrase and its German translation, extract vocabulary keywords.

Return strict JSON with this exact shape:
{
  "keywords": [
    {"spanish_text": "string", "german_text": "string", "notes": "string", "plural_german": "string"}
  ]
}

Rules:
- Include only non-common vocabulary words from the phrase.
- Do not include articles, prepositions, conjunctions, pronouns, or very basic function words.
- german_text must be singular and include article (for example: "der Park", "die Stadt", "das Buch").
- Prefer keyword forms that literally appear in the provided phrase (surface form).
- Do not invent abstract replacements (for example extracting "der Gesamtbetrag" from "insgesamt").
- If you intentionally return a base/canonical form that is not literal in the phrase, explain the mapping clearly in notes.
- plural_german should contain the plural form when applicable; otherwise empty string.
- Include relevant study notes only when useful; otherwise empty string.
- Keep keywords unique by spanish_text.
- Return JSON only, no markdown and no extra text.
""".strip()
