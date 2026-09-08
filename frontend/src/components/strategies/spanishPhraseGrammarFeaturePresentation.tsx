import type { PhraseGrammarFeaturePresentationMap } from "./phraseGrammarFeaturePresentationTypes";

export const SPANISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION = {
  spanish_subject_verb_agreement: {
    title: "strategies.grammar.spanishSubjectVerbAgreement",
    present: "strategies.grammar.spanishSubjectVerbAgreementNote",
    example: <><span>Yo <strong>trabajo</strong> aquí.</span> · <span>Ellos <strong>trabajan</strong> aquí.</span></>,
  },
  spanish_omitted_subject: {
    title: "strategies.grammar.spanishOmittedSubject",
    present: "strategies.grammar.spanishOmittedSubjectNote",
    example: <><strong>Tengo</strong> hambre.</>,
  },
  spanish_adjective_gender_agreement: {
    title: "strategies.grammar.spanishAdjectiveGenderAgreement",
    present: "strategies.grammar.spanishAdjectiveGenderAgreementNote",
    example: <><span>una casa bonit<strong>a</strong></span> · <span>un perro bonit<strong>o</strong></span></>,
  },
  spanish_adjective_number_agreement: {
    title: "strategies.grammar.spanishAdjectiveNumberAgreement",
    present: "strategies.grammar.spanishAdjectiveNumberAgreementNote",
    example: <>una casa bonita → dos casas bonita<strong>s</strong></>,
  },
  spanish_adjective_after_noun: {
    title: "strategies.grammar.spanishAdjectiveAfterNoun",
    present: "strategies.grammar.spanishAdjectiveAfterNounNote",
    example: <>una casa <strong>grande</strong></>,
  },
  spanish_ser_usage: {
    title: "strategies.grammar.spanishSerUsage",
    present: "strategies.grammar.spanishSerUsageNote",
    example: <>Ella <strong>es médica</strong>.</>,
  },
  spanish_estar_usage: {
    title: "strategies.grammar.spanishEstarUsage",
    present: "strategies.grammar.spanishEstarUsageNote",
    example: <><span>Ella <strong>está cansada</strong>.</span> · <span>Madrid <strong>está en España</strong>.</span></>,
  },
  spanish_hay_usage: {
    title: "strategies.grammar.spanishHayUsage",
    present: "strategies.grammar.spanishHayUsageNote",
    example: <><strong>Hay un restaurante</strong> aquí.</>,
  },
  spanish_direct_object_pronoun: {
    title: "strategies.grammar.spanishDirectObjectPronoun",
    present: "strategies.grammar.spanishDirectObjectPronounNote",
    example: <>Conozco a Juan. → <strong>Lo</strong> conozco.</>,
  },
  spanish_indirect_object_pronoun: {
    title: "strategies.grammar.spanishIndirectObjectPronoun",
    present: "strategies.grammar.spanishIndirectObjectPronounNote",
    example: <><strong>Le</strong> doy el libro a Ana.</>,
  },
  spanish_object_pronoun_before_verb: {
    title: "strategies.grammar.spanishObjectPronounBeforeVerb",
    present: "strategies.grammar.spanishObjectPronounBeforeVerbNote",
    example: <><strong>Lo quiero</strong>.</>,
  },
  spanish_reflexive_verb: {
    title: "strategies.grammar.spanishReflexiveVerb",
    present: "strategies.grammar.spanishReflexiveVerbNote",
    example: <><strong>Me levanto</strong> temprano.</>,
  },
  spanish_gustar_type_construction: {
    title: "strategies.grammar.spanishGustarTypeConstruction",
    present: "strategies.grammar.spanishGustarTypeConstructionNote",
    example: <><strong>Me gusta el café</strong>.</>,
  },
  spanish_negation_no: {
    title: "strategies.grammar.spanishNegationNo",
    present: "strategies.grammar.spanishNegationNoNote",
    example: <><strong>No quiero</strong> ir.</>,
  },
  spanish_personal_a: {
    title: "strategies.grammar.spanishPersonalA",
    present: "strategies.grammar.spanishPersonalANote",
    example: <>Veo <strong>a María</strong>.</>,
  },
  spanish_preposition_a_destination: {
    title: "strategies.grammar.spanishPrepositionADestination",
    present: "strategies.grammar.spanishPrepositionADestinationNote",
    example: <>Voy <strong>a Madrid</strong>.</>,
  },
  spanish_por_usage: {
    title: "strategies.grammar.spanishPorUsage",
    present: "strategies.grammar.spanishPorUsageNote",
    example: <>Gracias <strong>por tu ayuda</strong>.</>,
  },
  spanish_para_usage: {
    title: "strategies.grammar.spanishParaUsage",
    present: "strategies.grammar.spanishParaUsageNote",
    example: <>Este regalo es <strong>para ti</strong>.</>,
  },
  spanish_estar_with_gerund: {
    title: "strategies.grammar.spanishEstarWithGerund",
    present: "strategies.grammar.spanishEstarWithGerundNote",
    example: <>Estoy <strong>trabajando</strong>.</>,
  },
} satisfies PhraseGrammarFeaturePresentationMap;
