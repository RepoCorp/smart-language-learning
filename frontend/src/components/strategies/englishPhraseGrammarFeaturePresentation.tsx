import type { PhraseGrammarFeaturePresentationMap } from "./phraseGrammarFeaturePresentationTypes";

export const ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION = {
  english_subject_verb_object: {
    title: "strategies.grammar.subjectVerbObject",
    present: "strategies.grammar.subjectVerbObjectNote",
    example: <><strong>I</strong> <strong>like</strong> <strong>coffee</strong>. <span>Subject → Verb → Object</span></>,
  },
  english_third_person_s: {
    title: "strategies.grammar.thirdPersonS",
    present: "strategies.grammar.thirdPersonSNote",
    example: <><span>I work. → She work<strong>s</strong>.</span><br /><span>I watch. → He watch<strong>es</strong>.</span></>,
  },
  english_be_conjugation: {
    title: "strategies.grammar.beConjugation",
    present: "strategies.grammar.beConjugationNote",
    example: <><span>I <strong>am</strong></span><br /><span>you <strong>are</strong></span><br /><span>she <strong>is</strong></span></>,
  },
  english_do_question: {
    title: "strategies.grammar.doQuestion",
    present: "strategies.grammar.doQuestionNote",
    example: <><span>You work. → <strong>Do</strong> you work?</span><br /><span>She works. → <strong>Does</strong> she work?</span></>,
  },
  english_do_negation: {
    title: "strategies.grammar.doNegation",
    present: "strategies.grammar.doNegationNote",
    example: <><span>I know. → I <strong>do not know</strong>.</span><br /><span>She knows. → She <strong>does not know</strong>.</span></>,
  },
  english_wh_question: {
    title: "strategies.grammar.whQuestion",
    present: "strategies.grammar.whQuestionNote",
    example: <><span><strong>Where</strong> do you live?</span><br /><span><strong>What</strong> do you want?</span><br /><span><strong>Why</strong> are you here?</span></>,
  },
  english_modal_base_verb: {
    title: "strategies.grammar.modalBaseVerb",
    present: "strategies.grammar.modalBaseVerbNote",
    example: <><span>can + swim → I <strong>can swim</strong>.</span><br /><span>should + go → You <strong>should go</strong>.</span></>,
  },
  english_present_continuous: {
    title: "strategies.grammar.presentContinuous",
    present: "strategies.grammar.presentContinuousNote",
    example: <><span>work → I <strong>am working</strong>.</span><br /><span>sleep → She <strong>is sleeping</strong>.</span></>,
  },
  english_simple_past: {
    title: "strategies.grammar.simplePast",
    present: "strategies.grammar.simplePastNote",
    example: <><span>work → I <strong>worked</strong> yesterday.</span><br /><span>go → I <strong>went</strong> home.</span></>,
  },
  english_past_continuous: {
    title: "strategies.grammar.pastContinuous",
    present: "strategies.grammar.pastContinuousNote",
    example: <><span>work → I <strong>was working</strong>.</span><br /><span>sleep → They <strong>were sleeping</strong>.</span></>,
  },
  english_present_perfect: {
    title: "strategies.grammar.presentPerfect",
    present: "strategies.grammar.presentPerfectNote",
    example: <><span>see → I <strong>have seen</strong> it.</span><br /><span>finish → She <strong>has finished</strong>.</span></>,
  },
  english_future_will: {
    title: "strategies.grammar.futureWill",
    present: "strategies.grammar.futureWillNote",
    example: <><span>call → I <strong>will call</strong> you.</span><br /><span>come → She <strong>will come</strong> tomorrow.</span></>,
  },
  english_infinitive_with_to: {
    title: "strategies.grammar.infinitiveWithTo",
    present: "strategies.grammar.infinitiveWithToNote",
    example: <><span>go → I want <strong>to go</strong>.</span><br /><span>learn → I need <strong>to learn</strong>.</span></>,
  },
  english_gerund_after_verb: {
    title: "strategies.grammar.gerundAfterVerb",
    present: "strategies.grammar.gerundAfterVerbNote",
    example: <><span>enjoy + read → I enjoy <strong>reading</strong>.</span><br /><span>avoid + drive → I avoid <strong>driving</strong>.</span></>,
  },
  english_article_a_an: {
    title: "strategies.grammar.articleAAn",
    present: "strategies.grammar.articleAAnNote",
    example: <><span><strong>a</strong> dog</span><br /><span><strong>an</strong> apple</span></>,
  },
  english_subject_pronoun_required: {
    title: "strategies.grammar.subjectPronounRequired",
    present: "strategies.grammar.subjectPronounRequiredNote",
    example: <><span><strong>I</strong> work.</span><br /><span><strong>She</strong> lives here.</span><br /><span><strong>It</strong> is raining.</span></>,
  },
  english_countable_uncountable: {
    title: "strategies.grammar.countableUncountable",
    present: "strategies.grammar.countableUncountableNote",
    example: <><span><strong>a book</strong></span><br /><span><strong>two books</strong></span><br /><span><strong>some water</strong></span></>,
  },
  english_adjective_noun_order: {
    title: "strategies.grammar.adjectiveNounOrder",
    present: "strategies.grammar.adjectiveNounOrderNote",
    example: <><span>a <strong>red</strong> car</span><br /><span>a <strong>big</strong> house</span></>,
  },
  english_comparative: {
    title: "strategies.grammar.comparative",
    present: "strategies.grammar.comparativeNote",
    example: <><span>small → small<strong>er</strong></span><br /><span>interesting → <strong>more</strong> interesting</span><br /><span>good → <strong>better</strong></span></>,
  },
  english_superlative: {
    title: "strategies.grammar.superlative",
    present: "strategies.grammar.superlativeNote",
    example: <><span>small → <strong>the smallest</strong></span><br /><span>interesting → <strong>the most interesting</strong></span><br /><span>good → <strong>the best</strong></span></>,
  },
} satisfies PhraseGrammarFeaturePresentationMap;
