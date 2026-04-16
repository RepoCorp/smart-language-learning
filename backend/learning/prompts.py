CONVERSATION_GENERATION_PROMPT = """
Generate beginner-friendly learning content for a topic.

Return strict JSON with this exact shape:
{
  "conversation": [
    {"speaker": "a", "source_text": "string", "target_text": "string", "notes": "string"}
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
- `speaker` must be either `"a"` or `"b"` on every turn.
- Keep speaker attribution coherent with the scenario. Consecutive turns by the same speaker are allowed when natural (for example, one person asks a two-part question).
- `source_text` and `target_text` must be equivalent in meaning according to the requested language mapping.
- Keep a clear back-and-forth between the two speakers.
- Keep the whole dialogue within a single realistic interaction scope on the topic (no scene changes, no unrelated subtopics).
- Avoid weird jumps in topic, unnatural wording, or textbook/meta language.
- Prefer common, practical situations and vocabulary; vary examples without becoming quirky or overly imaginative.
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
Given one source phrase in `source_text` and one target phrase in `target_text`, extract vocabulary keywords.

Return strict JSON with this exact shape:
{
  "keywords": [
    {"source_text": "string", "target_text": "string", "notes": "string", "plural_target": "string"}
  ]
}

Rules:
- Include useful beginner vocabulary from the phrase, including common content words (nouns, verbs, adjectives, adverbs) when they help learning.
- Exclude only pure function words (articles, prepositions, conjunctions, pronouns) unless they are part of a fixed expression worth learning.
- Use the language mapping provided in the user input.
- Prefer keyword forms that literally appear in the provided phrase (surface form).
- Do not invent abstract replacements (for example extracting "der Gesamtbetrag" from "insgesamt").
- If you intentionally return a base/canonical form that is not literal in the phrase, explain the mapping clearly in notes.
- plural_target should contain the plural form when applicable; otherwise empty string.
- Include relevant study notes only when useful; otherwise empty string.
- Keep keywords unique by source_text.
- Return JSON only, no markdown and no extra text.
""".strip()


WORD_EXERCISES_FIRST_SECTION_PROMPT = """
Generate the first section of exercise phrases for one vocabulary item.

Return strict JSON with this exact shape:
{
  "phrases": [
    {"source_text": "string", "target_text": "string"},
    {"source_text": "string", "target_text": "string"}
  ]
}

Rules:
- Return exactly 2 phrases.
- Keep both phrases very short (max 4 words), practical, and beginner-friendly (A1-A2).
- Besides the target word, use only very basic high-frequency words.
- Respect word type and grammar (verb/noun/adjective/etc.).
- Ensure tense, number (singular/plural), and word order are correct.
- The target word must appear in each target_text line exactly as presented in the input (no inflection, no article/case/ending change).
- Keep source_text and target_text equivalent in meaning.
- Use the language mapping provided by the user input.
- Return JSON only, no markdown and no extra text.
""".strip()


WORD_EXERCISES_SECOND_SECTION_PROMPT = """
Generate the second section of exercise phrases for one vocabulary item.

Return strict JSON with this exact shape:
{
  "phrases": [
    {"source_text": "string", "target_text": "string"},
    {"source_text": "string", "target_text": "string"}
  ]
}

Rules:
- Return exactly 2 phrases.
- Keep both phrases very short (max 4 words), practical, and beginner-friendly (A1-A2).
- Besides the target word, use only very basic high-frequency words.
- Phrase 1: use the target word in one grammatical function (for example, noun as direct subject).
- Phrase 2: use the same target word in a different grammatical function than phrase 1.
- Respect word type and grammar (verb/noun/adjective/etc.).
- Ensure tense, number (singular/plural), and word order are correct.
- The target word must appear in each target_text line (possibly inflected when grammar requires it).
- Keep source_text and target_text equivalent in meaning.
- Use the language mapping provided by the user input.
- Return JSON only, no markdown and no extra text.
""".strip()
