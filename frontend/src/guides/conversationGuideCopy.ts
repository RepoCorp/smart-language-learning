import type { GuideLanguage, GuidedTourStep } from "./guidedTourCopy";

type GuideCopy = {
  title: string;
  steps: GuidedTourStep[];
  next: string;
  finish: string;
  skip: string;
};

const COPY: Record<GuideLanguage, GuideCopy> = {
  en: {
    title: "Conversation practice",
    steps: [
      {
        id: "conversation-open-menu",
        target: "main-menu",
        route: "/configurations",
        title: "Open the menu",
        body: "Open the menu in the top-right corner.",
        advanceOnAction: "menu-opened",
        hideNext: true,
      },
      {
        id: "choose-conversation",
        target: "menu-conversation",
        route: "/configurations",
        title: "Choose Conversation",
        body: "Click Conversation. This is where you can practice speaking naturally about a topic that matters to you.",
        advanceWhenRoute: "/conversation",
        hideNext: true,
      },
      {
        id: "conversation-topic",
        target: "conversation-topic",
        route: "/conversation",
        title: "Choose a topic",
        body: "Choose something you would genuinely like to talk about. You can use a saved topic, create your own, or leave Random selected when you do not have one in mind.",
        openSection: "conversation-topic",
      },
      {
        id: "conversation-goal",
        target: "conversation-goal",
        route: "/conversation",
        title: "Generate a small goal",
        body: "The goal gives the conversation a simple direction. Generate one, and regenerate it if it does not feel useful for your topic. If it feels too difficult, you can change the difficulty before creating another one.",
        hideNext: true,
        advanceOnAction: "conversation-goal-generated",
      },
      {
        id: "conversation-ready",
        target: "conversation-start",
        route: "/conversation",
        title: "Your conversation is ready",
        body: "You now have a topic and a goal. The highlighted Start Conversation button below starts the conversation when you are ready. First, let’s quickly look at how the conversation flows.",
        nextLabel: "See how it works",
      },
      {
        id: "conversation-flow",
        target: "conversation-start",
        route: "/conversation",
        title: "See how the conversation works",
        body: "The conversation takes care of the rhythm, so you can focus on communicating. When this guide closes, you can start whenever you feel ready.",
        moreInfoLabel: "More information",
        moreInfo: "Think of it as talking with a kind, patient, knowledgeable person who speaks both languages. They are happy to repeat something, help you get unstuck, and understand a question in the language you know. Best of all, this conversation partner does not judge you: feel free to sound imperfect, experiment, and make mistakes. Nobody is judging you, and nobody else will know. Try to use the language you are learning as much as you can.",
        image: "conversation-panel",
        nextLabel: "I am ready to try it",
      },
    ],
    next: "Next",
    finish: "Finish",
    skip: "Continue later",
  },
  es: {
    title: "Práctica de conversación",
    steps: [
      {
        id: "conversation-open-menu",
        target: "main-menu",
        route: "/configurations",
        title: "Abre el menú",
        body: "Abre el menú en la esquina superior derecha.",
        advanceOnAction: "menu-opened",
        hideNext: true,
      },
      {
        id: "choose-conversation",
        target: "menu-conversation",
        route: "/configurations",
        title: "Elige Conversación",
        body: "Haz clic en Conversación. Ahí puedes practicar hablando de forma natural sobre un tema que te importe.",
        advanceWhenRoute: "/conversation",
        hideNext: true,
      },
      {
        id: "conversation-topic",
        target: "conversation-topic",
        route: "/conversation",
        title: "Elige un tema",
        body: "Elige algo de lo que realmente te gustaría hablar. Puedes usar un tema guardado, crear uno propio o dejar seleccionado Aleatorio cuando no tengas uno en mente.",
        openSection: "conversation-topic",
      },
      {
        id: "conversation-goal",
        target: "conversation-goal",
        route: "/conversation",
        title: "Genera un objetivo pequeño",
        body: "El objetivo le da una dirección sencilla a la conversación. Genera uno y regenéralo si no te parece útil para tu tema. Si te parece demasiado difícil, puedes cambiar la dificultad antes de generar otro.",
        hideNext: true,
        advanceOnAction: "conversation-goal-generated",
      },
      {
        id: "conversation-ready",
        target: "conversation-start",
        route: "/conversation",
        title: "Tu conversación está lista",
        body: "Ya tienes un tema y un objetivo. El botón resaltado Iniciar conversación que está debajo inicia la conversación cuando estés lista. Primero, veamos rápidamente cómo funciona.",
        nextLabel: "Ver cómo funciona",
      },
      {
        id: "conversation-flow",
        target: "conversation-start",
        route: "/conversation",
        title: "Mira cómo funciona la conversación",
        body: "La conversación se encarga del ritmo para que puedas concentrarte en comunicarte. Cuando se cierre esta guía, podrás empezar cuando te sientas lista.",
        moreInfoLabel: "Más información",
        moreInfo: "Piensa en esta conversación como hablar con una persona amable, paciente y con mucho conocimiento que habla ambos idiomas. Puede repetir algo, ayudarte si te quedas bloqueada y entender una pregunta en el idioma que conoces. Y lo mejor: esta persona no te juzga. Siéntete libre de sonar imperfecta, experimentar y equivocarte. Nadie te está juzgando y nadie más lo sabrá. Intenta usar todo lo posible el idioma que estás aprendiendo.",
        image: "conversation-panel",
        nextLabel: "Estoy lista para probarlo",
      },
    ],
    next: "Siguiente",
    finish: "Terminar",
    skip: "Continuar más tarde",
  },
};

export function conversationGuideCopy(language: GuideLanguage): GuideCopy {
  return COPY[language];
}
