from .types import Example


def E(base, answer, affix, english, spanish, prefix=False):
    return Example(base, answer, affix, {"english": english, "spanish": spanish}, prefix)

QUESTION = 'How would you say "{meaning}"?'
MEANING_QUESTION = 'What does "{word}" mean?'
PATTERN_LABEL = 'Word-building pattern'

PATTERNS = {
    "english_prefix_un": [
        E("happy", "unhappy", "un", ("happy", "not happy"), ("feliz", "infeliz"), True),
        E("fair", "unfair", "un", ("fair", "not fair"), ("justo", "injusto"), True),
        E("kind", "unkind", "un", ("kind", "not kind"), ("amable", "poco amable"), True),
        E("safe", "unsafe", "un", ("safe", "not safe"), ("seguro", "inseguro"), True),
        E("lucky", "unlucky", "un", ("lucky", "having bad luck"), ("afortunado", "desafortunado"), True),
        E("healthy", "unhealthy", "un", ("healthy", "not healthy"), ("saludable", "poco saludable"), True),
    ],
    "english_prefix_re": [
        E("write", "rewrite", "re", ("to write", "to write again"), ("escribir", "volver a escribir"), True),
        E("read", "reread", "re", ("to read", "to read again"), ("leer", "volver a leer"), True),
        E("build", "rebuild", "re", ("to build", "to build again"), ("construir", "volver a construir"), True),
        E("use", "reuse", "re", ("to use", "to use again"), ("usar", "volver a usar"), True),
        E("open", "reopen", "re", ("to open", "to open again"), ("abrir", "volver a abrir"), True),
        E("paint", "repaint", "re", ("to paint", "to paint again"), ("pintar", "volver a pintar"), True),
    ],
    "english_prefix_dis": [
        E("agree", "disagree", "dis", ("to agree", "to not agree"), ("estar de acuerdo", "no estar de acuerdo"), True),
        E("appear", "disappear", "dis", ("to appear", "to stop being visible"), ("aparecer", "desaparecer"), True),
        E("like", "dislike", "dis", ("to like", "to not like"), ("gustar", "no gustar"), True),
        E("connect", "disconnect", "dis", ("to connect", "to break a connection"), ("conectar", "desconectar"), True),
        E("obey", "disobey", "dis", ("to obey", "to not obey"), ("obedecer", "desobedecer"), True),
        E("trust", "distrust", "dis", ("to trust", "to not trust"), ("confiar", "desconfiar"), True),
    ],
    "english_prefix_mis": [
        E("understand", "misunderstand", "mis", ("to understand", "to understand incorrectly"), ("entender", "entender mal"), True),
        E("read", "misread", "mis", ("to read", "to read incorrectly"), ("leer", "leer mal"), True),
        E("spell", "misspell", "mis", ("to spell", "to spell incorrectly"), ("escribir con las letras correctas", "escribir con un error de ortografía"), True),
        E("pronounce", "mispronounce", "mis", ("to pronounce", "to pronounce incorrectly"), ("pronunciar", "pronunciar mal"), True),
        E("use", "misuse", "mis", ("to use", "to use incorrectly"), ("usar", "usar mal"), True),
        E("behave", "misbehave", "mis", ("to behave", "to behave badly"), ("comportarse", "comportarse mal"), True),
    ],
    "english_suffix_less": [
        E("hope", "hopeless", "less", ("hope", "without hope"), ("esperanza", "sin esperanza")),
        E("home", "homeless", "less", ("home", "without a home"), ("hogar", "sin hogar")),
        E("care", "careless", "less", ("care", "not taking care"), ("cuidado", "descuidado")),
        E("use", "useless", "less", ("use", "of no use"), ("uso", "inútil")),
        E("fear", "fearless", "less", ("fear", "without fear"), ("miedo", "sin miedo")),
        E("end", "endless", "less", ("end", "without an end"), ("fin", "sin fin")),
    ],
    "english_suffix_ful": [
        E("help", "helpful", "ful", ("help", "willing to help"), ("ayuda", "servicial")),
        E("care", "careful", "ful", ("care", "taking care"), ("cuidado", "cuidadoso")),
        E("hope", "hopeful", "ful", ("hope", "full of hope"), ("esperanza", "esperanzado")),
        E("colour", "colourful", "ful", ("colour", "full of colour"), ("color", "colorido")),
        E("pain", "painful", "ful", ("pain", "causing pain"), ("dolor", "doloroso")),
        E("peace", "peaceful", "ful", ("peace", "calm and without conflict"), ("paz", "pacífico")),
    ],
    "english_suffix_able": [
        E("wash", "washable", "able", ("to wash", "able to be washed"), ("lavar", "lavable")),
        E("access", "accessible", "ible", ("access", "easy to reach or use"), ("acceso", "accesible")),
        E("read", "readable", "able", ("to read", "easy to read"), ("leer", "legible")),
        E("drink", "drinkable", "able", ("to drink", "safe to drink"), ("beber", "apto para beber")),
        E("reverse", "reversible", "ible", ("to reverse", "able to be reversed"), ("revertir", "reversible")),
        E("convert", "convertible", "ible", ("to convert", "able to be converted"), ("convertir", "convertible")),
    ],
    "english_suffix_er": [
        E("teach", "teacher", "er", ("to teach", "a person who teaches"), ("enseñar", "profesor o profesora")),
        E("sing", "singer", "er", ("to sing", "a person who sings"), ("cantar", "cantante")),
        E("work", "worker", "er", ("to work", "a person who works"), ("trabajar", "trabajador o trabajadora")),
        E("drive", "driver", "er", ("to drive", "a person who drives"), ("conducir", "conductor o conductora")),
        E("bake", "baker", "er", ("to bake", "a person who makes bread as a job"), ("hornear", "panadero o panadera")),
        E("swim", "swimmer", "er", ("to swim", "a person who swims"), ("nadar", "nadador o nadadora")),
    ],
    "english_suffix_ness": [
        E("happy", "happiness", "ness", ("happy", "the feeling of being happy"), ("feliz", "felicidad")),
        E("kind", "kindness", "ness", ("kind", "the quality of being kind"), ("amable", "amabilidad")),
        E("dark", "darkness", "ness", ("dark", "the absence of light"), ("oscuro", "oscuridad")),
        E("weak", "weakness", "ness", ("weak", "the state of being weak"), ("débil", "debilidad")),
        E("sad", "sadness", "ness", ("sad", "the feeling of being sad"), ("triste", "tristeza")),
        E("sick", "sickness", "ness", ("sick", "the state of being sick"), ("enfermo", "enfermedad")),
    ],
    "english_suffix_ly": [
        E("slow", "slowly", "ly", ("slow", "in a slow way"), ("lento", "lentamente")),
        E("quick", "quickly", "ly", ("quick", "in a quick way"), ("rápido", "rápidamente")),
        E("careful", "carefully", "ly", ("careful", "with care"), ("cuidadoso", "cuidadosamente")),
        E("quiet", "quietly", "ly", ("quiet", "without making much noise"), ("silencioso", "silenciosamente")),
        E("bad", "badly", "ly", ("bad", "in a bad way"), ("malo", "mal")),
        E("clear", "clearly", "ly", ("clear", "in a clear way"), ("claro", "claramente")),
    ],
    "english_suffix_ment": [
        E("develop", "development", "ment", ("to develop", "the process of developing"), ("desarrollar", "desarrollo")),
        E("move", "movement", "ment", ("to move", "the act of moving"), ("mover", "movimiento")),
        E("employ", "employment", "ment", ("to employ", "paid work"), ("emplear", "empleo")),
        E("enjoy", "enjoyment", "ment", ("to enjoy", "the pleasure of enjoying something"), ("disfrutar", "disfrute")),
        E("improve", "improvement", "ment", ("to improve", "a change for the better"), ("mejorar", "mejora")),
        E("agree", "agreement", "ment", ("to agree", "a shared decision or opinion"), ("estar de acuerdo", "acuerdo")),
    ],
    "english_suffix_tion_sion": [
        E("inform", "information", "tion", ("to inform", "facts that tell you about something"), ("informar", "información")),
        E("decide", "decision", "sion", ("to decide", "a choice you have made"), ("decidir", "decisión")),
        E("collect", "collection", "tion", ("to collect", "a group of things collected together"), ("coleccionar", "colección")),
        E("educate", "education", "tion", ("to educate", "the process of teaching and learning"), ("educar", "educación")),
        E("discuss", "discussion", "sion", ("to discuss", "a conversation about a topic"), ("conversar sobre un tema", "conversación sobre un tema")),
        E("explode", "explosion", "sion", ("to explode", "the act of exploding"), ("explotar", "explosión")),
    ],
    "english_suffix_ist": [
        E("art", "artist", "ist", ("art", "a person who creates art"), ("arte", "artista")),
        E("piano", "pianist", "ist", ("piano", "a person who plays the piano"), ("piano", "pianista")),
        E("guitar", "guitarist", "ist", ("guitar", "a person who plays the guitar"), ("guitarra", "guitarrista")),
        E("cycle", "cyclist", "ist", ("to cycle", "a person who rides a bicycle"), ("ir en bicicleta", "ciclista")),
        E("science", "scientist", "ist", ("science", "a person who works in science"), ("ciencia", "científico o científica")),
        E("violin", "violinist", "ist", ("violin", "a person who plays the violin"), ("violín", "violinista")),
    ],
    "english_suffix_ize_ise": [
        E("modern", "modernize", "ize", ("modern", "to make modern"), ("moderno", "modernizar")),
        E("final", "finalize", "ize", ("final", "to put into final form"), ("final", "finalizar")),
        E("memory", "memorize", "ize", ("memory", "to learn something so you can remember it"), ("memoria", "memorizar")),
        E("legal", "legalize", "ize", ("legal", "to make legal"), ("legal", "legalizar")),
        E("apology", "apologise", "ise", ("apology", "to say you are sorry"), ("disculpa", "disculparse")),
        E("normal", "normalise", "ise", ("normal", "to make normal"), ("normal", "normalizar")),
    ],
}
