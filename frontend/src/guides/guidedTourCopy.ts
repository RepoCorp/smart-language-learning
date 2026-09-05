export type GuideLanguage = "en" | "es";

export type GuidedTourStep = {
  id: string;
  target: string;
  route: string;
  title: string;
  body: string;
  completedBody?: string;
  moreInfoLabel?: string;
  moreInfo?: string;
  waitingBody?: string;
  nextLabel?: string;
  advanceWhenRoute?: string;
  highlightPadding?: number;
  minHighlightWidth?: number;
  minHighlightHeight?: number;
  hideNext?: boolean;
  requiredTargetAttribute?: string;
  advanceOnAction?: string;
  collapseOnAction?: string;
  expandOnAction?: string;
  showNextOnAction?: string;
  openSection?: string;
};

type GuidedTourCopy = {
  title: string;
  steps: GuidedTourStep[];
  next: string;
  finish: string;
  skip: string;
};

const COPY: Record<GuideLanguage, GuidedTourCopy> = {
  en: {
    title: "Set your languages",
    steps: [
      {
        id: "app-language",
        target: "app-language",
        route: "/configurations",
        title: "Choose the app language",
        body: "This changes the language of buttons, help, and explanations. You can change it whenever you like.",
      },
      {
        id: "source-language",
        target: "source-language",
        route: "/configurations",
        title: "Choose the language you know",
        body: "This is the language used for translations and instructions while you study.",
      },
      {
        id: "target-language",
        target: "target-language",
        route: "/configurations",
        title: "Choose the language you are learning",
        body: "Dialogs, words, phrases, and exercises will be created in this language.",
      },
      {
        id: "open-menu",
        target: "main-menu",
        route: "/configurations",
        title: "Open the menu",
        body: "Open the menu in the top-right corner.",
        advanceOnAction: "menu-opened",
        hideNext: true,
      },
      {
        id: "choose-create-content",
        target: "menu-create-content",
        route: "/configurations",
        title: "Choose Create Content",
        body: "Click Create Content. This is where you transform your own interests into dialogs to learn from.",
        advanceWhenRoute: "/content/create",
        hideNext: true,
      },
      {
        id: "personal-topic",
        target: "topic-selection",
        route: "/content/create",
        title: "Create a topic that matters to you",
        body: "Open Topic, choose Create new topic, and write a specific situation or interest that genuinely matters to you. When you are ready, press Enter or the keyboard's Done key. In the future, you can also leave the Random option selected when you do not have a topic in mind.",
        moreInfoLabel: "More information",
        moreInfo: "Useful topics make the language easier to remember because you can imagine using it. For example, paying at a supermarket is a useful topic when it is a regular situation but the cashier is hard to understand.",
        waitingBody: "Choose Create new topic and write your topic before continuing.",
        nextLabel: "I created my topic",
        hideNext: true,
        advanceOnAction: "topic-created",
        openSection: "topic",
      },
      {
        id: "create-dialog",
        target: "generate-dialog",
        route: "/content/create",
        title: "Create a dialog",
        body: "Your topic is ready. You can later adjust options such as the level or dialog length, but we will keep this first one simple. Click Generate preview to create your dialog.",
        nextLabel: "I created a preview",
        hideNext: true,
        advanceOnAction: "dialog-preview-created",
      },
      {
        id: "save-dialog",
        target: "save-dialog",
        route: "/content/create",
        title: "Save the dialog",
        body: "If the preview looks good, save it. Its dialog lines become a source of words and phrases you can add to your study bank.",
        waitingBody: "Generate a dialog preview first. Its Save dialog button will appear here.",
        nextLabel: "I saved the dialog",
        hideNext: true,
        advanceOnAction: "dialog-saved",
      },
      {
        id: "save-word",
        target: "saved-dialog",
        route: "/content/create",
        title: "Save a useful word",
        body: "Click a word in a dialog line to add it. Choose a word you would like to understand or use better; it will join your study bank.",
        completedBody: "Great. Add as many useful words as you want from this dialog. When you are ready to learn a complete expression too, continue to phrases.",
        moreInfoLabel: "More information",
        moreInfo: "Recognizing a word and knowing its meaning is different from being able to understand it quickly or use it yourself. Saving useful words gives the app a chance to bring them back in exercises until they become more natural.",
        waitingBody: "Save the dialog first. Its lines will appear here so you can add a word.",
        nextLabel: "Continue to phrases",
        collapseOnAction: "word-selected",
        expandOnAction: "word-saved",
        showNextOnAction: "word-saved",
      },
      {
        id: "save-phrase",
        target: "saved-dialog",
        route: "/content/create",
        title: "Save a useful phrase",
        body: "Below a dialog line, click Save a phrase. Choose Full line to save the entire line, or Short expression when only a few words belong together. For this first time, choose Full line.",
        completedBody: "Great. Add as many useful phrases as you want from this dialog. When you are ready, continue to your first learning session.",
        moreInfoLabel: "More information",
        moreInfo: "Phrases help you learn language as it is actually used. They can make a familiar word easier to recognize in real speech and give you a ready-made pattern to use.",
        waitingBody: "Save a word first. Then you can save a useful whole phrase.",
        nextLabel: "Continue to Session",
        collapseOnAction: "phrase-save-started",
        expandOnAction: "phrase-item-closed",
        showNextOnAction: "phrase-saved",
      },
      {
        id: "open-session",
        target: "main-menu",
        route: "/content/create",
        title: "Open the menu",
        body: "Open the menu in the top-right corner.",
        advanceOnAction: "menu-opened",
        hideNext: true,
      },
      {
        id: "choose-session",
        target: "menu-session",
        route: "/content/create",
        title: "Choose Session",
        body: "Click Session. This is where the actual learning practice happens.",
        advanceWhenRoute: "/session",
        hideNext: true,
      },
      {
        id: "start-session",
        target: "session-start",
        route: "/session",
        title: "Start a learning session",
        body: "Choose how long you want to study. Sessions are where most of the learning happens: the app brings back new items and the ones ready for review.",
        moreInfoLabel: "More information",
        moreInfo: "Sessions use spaced repetition. When an item feels right, the app waits longer before showing it again. When it feels difficult, it returns sooner. This lets you spend time on what needs practice instead of repeating everything every day.",
        nextLabel: "I started my session",
        hideNext: true,
        advanceOnAction: "session-started",
      },
      {
        id: "first-item",
        target: "session-current-item",
        route: "/session",
        title: "Your first session is ready",
        body: "Go through the session at your own pace. First, you will see each new item and its meaning. If the session is long enough, you may also see a test. You do not need to master everything today: use this first session to discover how learning here feels. More short guides will be available whenever you want to explore further.",
        waitingBody: "Start a session first. Your first items will appear here.",
        nextLabel: "Start exploring",
      },
    ],
    next: "Next",
    finish: "Finish for now",
    skip: "Continue later",
  },
  es: {
    title: "Configura tus idiomas",
    steps: [
      {
        id: "app-language",
        target: "app-language",
        route: "/configurations",
        title: "Elige el idioma de la aplicación",
        body: "Cambia el idioma de los botones, las ayudas y las explicaciones. Puedes cambiarlo cuando quieras.",
      },
      {
        id: "source-language",
        target: "source-language",
        route: "/configurations",
        title: "Elige el idioma que conoces",
        body: "Este idioma se usará para las traducciones y las instrucciones mientras estudias.",
      },
      {
        id: "target-language",
        target: "target-language",
        route: "/configurations",
        title: "Elige el idioma que quieres aprender",
        body: "Los diálogos, las palabras, las frases y los ejercicios se crearán en este idioma.",
      },
      {
        id: "open-menu",
        target: "main-menu",
        route: "/configurations",
        title: "Abre el menú",
        body: "Abre el menú en la esquina superior derecha.",
        advanceOnAction: "menu-opened",
        hideNext: true,
      },
      {
        id: "choose-create-content",
        target: "menu-create-content",
        route: "/configurations",
        title: "Elige Crear contenido",
        body: "Haz clic en Crear contenido. Ahí conviertes tus propios intereses en diálogos para aprender.",
        advanceWhenRoute: "/content/create",
        hideNext: true,
      },
      {
        id: "personal-topic",
        target: "topic-selection",
        route: "/content/create",
        title: "Crea un tema que te importe",
        body: "Abre Tema, elige Crear tema nuevo y escribe una situación o un interés concreto que realmente te importe. Cuando estés lista, pulsa Enter o el botón Listo del teclado. En el futuro, también puedes dejar seleccionada la opción Aleatorio cuando no tengas un tema en mente.",
        moreInfoLabel: "Más información",
        moreInfo: "Los temas útiles hacen que sea más fácil recordar el idioma porque puedes imaginarte usándolo. Por ejemplo, pagar en un supermercado es un tema útil cuando es una situación frecuente pero cuesta entender lo que dice la cajera.",
        waitingBody: "Elige Crear tema nuevo y escribe tu tema antes de continuar.",
        nextLabel: "Ya creé mi tema",
        hideNext: true,
        advanceOnAction: "topic-created",
        openSection: "topic",
      },
      {
        id: "create-dialog",
        target: "generate-dialog",
        route: "/content/create",
        title: "Crea un diálogo",
        body: "Tu tema ya está listo. Más adelante podrás ajustar opciones como el nivel o la longitud del diálogo, pero esta primera vez lo haremos simple. Haz clic en Generar vista previa para crear tu diálogo.",
        nextLabel: "Ya creé una vista previa",
        hideNext: true,
        advanceOnAction: "dialog-preview-created",
      },
      {
        id: "save-dialog",
        target: "save-dialog",
        route: "/content/create",
        title: "Guarda el diálogo",
        body: "Si te gusta la vista previa, guarda el diálogo. Sus líneas serán una fuente de palabras y frases que puedes añadir a tu banco de estudio.",
        waitingBody: "Primero genera una vista previa. El botón para guardar el diálogo aparecerá aquí.",
        nextLabel: "Ya guardé el diálogo",
        hideNext: true,
        advanceOnAction: "dialog-saved",
      },
      {
        id: "save-word",
        target: "saved-dialog",
        route: "/content/create",
        title: "Guarda una palabra útil",
        body: "Haz clic en una palabra de una línea del diálogo para añadirla. Elige una palabra que te gustaría entender o usar mejor; irá a tu banco de estudio.",
        completedBody: "Muy bien. Añade tantas palabras útiles como quieras de este diálogo. Cuando estés lista para aprender también una expresión completa, continúa con las frases.",
        moreInfoLabel: "Más información",
        moreInfo: "Reconocer una palabra y saber qué significa no es lo mismo que poder entenderla rápidamente o usarla tú misma. Guardar palabras útiles permite que la aplicación las traiga de vuelta en ejercicios hasta que resulten más naturales.",
        waitingBody: "Primero guarda el diálogo. Sus líneas aparecerán aquí para que puedas añadir una palabra.",
        nextLabel: "Continuar con las frases",
        collapseOnAction: "word-selected",
        expandOnAction: "word-saved",
        showNextOnAction: "word-saved",
      },
      {
        id: "save-phrase",
        target: "saved-dialog",
        route: "/content/create",
        title: "Guarda una frase útil",
        body: "Debajo de una línea del diálogo, pulsa Guardar una frase. Elige Línea completa para guardar toda la línea, o Expresión corta cuando solo unas pocas palabras van juntas. Esta primera vez, elige Línea completa.",
        completedBody: "Muy bien. Añade tantas frases útiles como quieras de este diálogo. Cuando estés lista, continúa con tu primera sesión de aprendizaje.",
        moreInfoLabel: "Más información",
        moreInfo: "Las frases ayudan a aprender el idioma tal como se usa de verdad. Pueden hacer que sea más fácil reconocer una palabra conocida al escuchar y darte un patrón listo para usar.",
        waitingBody: "Primero guarda una palabra. Después puedes guardar una frase completa útil.",
        nextLabel: "Continuar a Sesión",
        collapseOnAction: "phrase-save-started",
        expandOnAction: "phrase-item-closed",
        showNextOnAction: "phrase-saved",
      },
      {
        id: "open-session",
        target: "main-menu",
        route: "/content/create",
        title: "Abre el menú",
        body: "Abre el menú en la esquina superior derecha.",
        advanceOnAction: "menu-opened",
        hideNext: true,
      },
      {
        id: "choose-session",
        target: "menu-session",
        route: "/content/create",
        title: "Elige Sesión",
        body: "Haz clic en Sesión. Ahí ocurre la práctica de aprendizaje de verdad.",
        advanceWhenRoute: "/session",
        hideNext: true,
      },
      {
        id: "start-session",
        target: "session-start",
        route: "/session",
        title: "Empieza una sesión de aprendizaje",
        body: "Elige cuánto tiempo quieres estudiar. En las sesiones ocurre la mayor parte del aprendizaje: la aplicación trae elementos nuevos y los que ya están listos para repasar.",
        moreInfoLabel: "Más información",
        moreInfo: "Las sesiones usan repetición espaciada. Cuando un elemento te resulta fácil, la aplicación espera más tiempo antes de mostrarlo otra vez. Cuando te cuesta, vuelve antes. Así puedes dedicar tiempo a lo que necesita práctica en vez de repetir todo cada día.",
        nextLabel: "Ya empecé mi sesión",
        hideNext: true,
        advanceOnAction: "session-started",
      },
      {
        id: "first-item",
        target: "session-current-item",
        route: "/session",
        title: "Tu primera sesión está lista",
        body: "Recorre la sesión a tu ritmo. Primero verás cada elemento nuevo junto con su significado. Si la sesión dura lo suficiente, también puede aparecer alguna prueba. No necesitas dominarlo todo hoy: usa esta primera sesión para descubrir cómo se siente aprender aquí. Habrá más guías cortas cuando quieras explorar más.",
        waitingBody: "Primero empieza una sesión. Aquí aparecerán tus primeros elementos.",
        nextLabel: "Empezar a explorar",
      },
    ],
    next: "Siguiente",
    finish: "Terminar por ahora",
    skip: "Continuar más tarde",
  },
};

export function guidedTourCopy(language: GuideLanguage): GuidedTourCopy {
  return COPY[language];
}
