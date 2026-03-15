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
- Keep grammar beginner-level (A1-A2) but vary tone and intent based on the provided style seed.
- Keep each phrase short and beginner level (A1-A2).
- Use spoken dialogue lines only (no narration, no stage directions, no bullet-like fragments).
- Spanish and German phrase must be equivalent in meaning.
- Keep a clear back-and-forth between the two speakers.
- Keep the whole dialogue within a single realistic interaction scope on the topic (no scene changes, no unrelated subtopics).
- Avoid weird jumps in topic, unnatural wording, or textbook/meta language.
- Avoid overused starters like "Hola, ¿cómo estás?" unless the topic/context is explicitly about greetings or reuniting.
- Do not reuse the same key verb or key noun in consecutive turns unless required by the scenario.
- Include relevant study notes only when useful; otherwise use an empty string.
- Return JSON only, no markdown and no extra text.

Few-shot style examples (short and valid):
1) casual
   ES: "Hola, ¿vienes al mercado?" / DE: "Hi, kommst du zum Markt?"
   ES: "Sí, necesito fruta." / DE: "Ja, ich brauche Obst."
2) polite
   ES: "Buenos días, ¿me ayuda con esto?" / DE: "Guten Tag, helfen Sie mir damit?"
   ES: "Claro, con mucho gusto." / DE: "Natürlich, sehr gern."
3) urgent
   ES: "Perdón, ¿sale ahora el autobús?" / DE: "Entschuldigung, fährt der Bus jetzt?"
   ES: "Sí, sube rápido." / DE: "Ja, steig schnell ein."
4) friendly
   ES: "¡Qué bueno verte aquí!" / DE: "Wie schön, dich hier zu sehen!"
   ES: "Igualmente, ¿tomamos un café?" / DE: "Gleichfalls, trinken wir einen Kaffee?"
5) problem-solving
   ES: "No funciona mi tarjeta." / DE: "Meine Karte funktioniert nicht."
   ES: "Prueba otra vez en esta máquina." / DE: "Versuch es noch einmal an diesem Gerät."
6) small-talk
   ES: "Hace sol hoy, ¿verdad?" / DE: "Heute ist es sonnig, oder?"
   ES: "Sí, perfecto para caminar." / DE: "Ja, perfekt zum Spazieren."
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
