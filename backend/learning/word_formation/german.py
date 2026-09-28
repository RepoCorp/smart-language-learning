from .types import Example


def E(base, answer, affix, english, spanish, prefix=False):
    return Example(base, answer, affix, {"english": english, "spanish": spanish}, prefix)

PATTERNS = {
    "german_prefix_un": [
        E("glücklich", "unglücklich", "un", ("happy", "unhappy"), ("feliz", "infeliz"), True),
        E("bekannt", "unbekannt", "un", ("known", "unknown"), ("conocido", "desconocido"), True),
        E("freundlich", "unfreundlich", "un", ("friendly", "unfriendly"), ("amable", "poco amable"), True),
        E("möglich", "unmöglich", "un", ("possible", "impossible"), ("posible", "imposible"), True),
        E("sicher", "unsicher", "un", ("safe", "unsafe"), ("seguro", "inseguro"), True),
        E("gesund", "ungesund", "un", ("healthy", "unhealthy"), ("saludable", "poco saludable"), True),
    ],
    "german_suffix_los": [
        E("Arbeit", "arbeitslos", "los", ("work", "unemployed"), ("trabajo", "sin trabajo")),
        E("Wort", "wortlos", "los", ("word", "without words"), ("palabra", "sin palabras")),
        E("Kosten", "kostenlos", "los", ("costs", "free of charge"), ("costos", "gratuito")),
        E("Ende", "endlos", "los", ("end", "endless"), ("fin", "sin fin")),
        E("Hilfe", "hilflos", "los", ("help", "helpless"), ("ayuda", "incapaz de valerse por sí mismo")),
        E("Sinn", "sinnlos", "los", ("meaning", "meaningless"), ("sentido", "sin sentido")),
    ],
    "german_suffix_bar": [
        E("essen", "essbar", "bar", ("to eat", "edible"), ("comer", "comestible")),
        E("lesen", "lesbar", "bar", ("to read", "readable"), ("leer", "legible")),
        E("trinken", "trinkbar", "bar", ("to drink", "safe to drink"), ("beber", "apto para beber")),
        E("waschen", "waschbar", "bar", ("to wash", "washable"), ("lavar", "lavable")),
        E("bezahlen", "bezahlbar", "bar", ("to pay", "affordable"), ("pagar", "asequible")),
        E("hören", "hörbar", "bar", ("to hear", "audible"), ("oír", "audible")),
    ],
    "german_suffix_lich": [
        E("Freund", "freundlich", "lich", ("friend", "friendly"), ("amigo", "amable")),
        E("Tag", "täglich", "lich", ("day", "daily"), ("día", "diario")),
        E("Mensch", "menschlich", "lich", ("a human being", "human"), ("ser humano", "humano")),
        E("Natur", "natürlich", "lich", ("nature", "natural"), ("naturaleza", "natural")),
        E("Herz", "herzlich", "lich", ("heart", "warm and sincere"), ("corazón", "cordial")),
        E("Sport", "sportlich", "lich", ("sport", "athletic"), ("deporte", "deportivo")),
    ],
    "german_suffix_heit": [
        E("frei", "Freiheit", "heit", ("free", "freedom"), ("libre", "libertad")),
        E("sicher", "Sicherheit", "heit", ("safe", "safety"), ("seguro", "seguridad")),
        E("krank", "Krankheit", "heit", ("ill", "illness"), ("enfermo", "enfermedad")),
        E("gesund", "Gesundheit", "heit", ("healthy", "health"), ("sano", "salud")),
        E("schön", "Schönheit", "heit", ("beautiful", "beauty"), ("bello", "belleza")),
        E("wahr", "Wahrheit", "heit", ("true", "truth"), ("verdadero", "verdad")),
    ],
    "german_suffix_keit": [
        E("möglich", "Möglichkeit", "keit", ("possible", "possibility"), ("posible", "posibilidad")),
        E("sauber", "Sauberkeit", "keit", ("clean", "cleanliness"), ("limpio", "limpieza")),
        E("freundlich", "Freundlichkeit", "keit", ("friendly", "friendliness"), ("amable", "amabilidad")),
        E("traurig", "Traurigkeit", "keit", ("sad", "sadness"), ("triste", "tristeza")),
        E("höflich", "Höflichkeit", "keit", ("polite", "politeness"), ("cortés", "cortesía")),
        E("einsam", "Einsamkeit", "keit", ("lonely", "loneliness"), ("solitario", "soledad")),
    ],
    "german_suffix_ung": [
        E("entwickeln", "Entwicklung", "ung", ("to develop", "development"), ("desarrollar", "desarrollo")),
        E("wohnen", "Wohnung", "ung", ("to live / reside", "an apartment"), ("vivir / residir", "apartamento")),
        E("bestellen", "Bestellung", "ung", ("to order", "an order"), ("pedir", "pedido")),
        E("bezahlen", "Bezahlung", "ung", ("to pay", "payment"), ("pagar", "pago")),
        E("erklären", "Erklärung", "ung", ("to explain", "explanation"), ("explicar", "explicación")),
        E("hoffen", "Hoffnung", "ung", ("to hope", "hope"), ("tener esperanza", "esperanza")),
    ],
    "german_suffix_er": [
        E("lehren", "Lehrer", "er", ("to teach", "a male teacher"), ("enseñar", "profesor")),
        E("spielen", "Spieler", "er", ("to play", "a male player"), ("jugar", "jugador")),
        E("fahren", "Fahrer", "er", ("to drive", "a male driver"), ("conducir", "conductor")),
        E("backen", "Bäcker", "er", ("to bake", "a male baker"), ("hornear", "panadero")),
        E("arbeiten", "Arbeiter", "er", ("to work", "a male worker"), ("trabajar", "trabajador")),
        E("malen", "Maler", "er", ("to paint", "a male painter"), ("pintar", "pintor")),
    ],
    "german_suffix_in": [
        E("Lehrer", "Lehrerin", "in", ("a male teacher", "a female teacher"), ("profesor", "profesora")),
        E("Arzt", "Ärztin", "in", ("a male doctor", "a female doctor"), ("médico", "médica")),
        E("Spieler", "Spielerin", "in", ("a male player", "a female player"), ("jugador", "jugadora")),
        E("Fahrer", "Fahrerin", "in", ("a male driver", "a female driver"), ("conductor", "conductora")),
        E("Sänger", "Sängerin", "in", ("a male singer", "a female singer"), ("cantante masculino", "cantante femenina")),
        E("Verkäufer", "Verkäuferin", "in", ("a male salesperson", "a female salesperson"), ("vendedor", "vendedora")),
    ],
    "german_suffix_chen": [
        E("Hund", "Hündchen", "chen", ("dog", "little dog"), ("perro", "perrito")),
        E("Haus", "Häuschen", "chen", ("house", "little house"), ("casa", "casita")),
        E("Katze", "Kätzchen", "chen", ("cat", "kitten"), ("gato", "gatito")),
        E("Buch", "Büchchen", "chen", ("book", "little book"), ("libro", "librito")),
        E("Maus", "Mäuschen", "chen", ("mouse", "little mouse"), ("ratón", "ratoncito")),
        E("Blume", "Blümchen", "chen", ("flower", "little flower"), ("flor", "florecita")),
    ],
}
