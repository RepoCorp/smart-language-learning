import { useI18n } from "../i18n";

export default function GuideLibraryModal({
  open,
  onClose,
  onStartBasics,
  onStartConversation,
}: {
  open: boolean;
  onClose: () => void;
  onStartBasics: () => void;
  onStartConversation: () => void;
}): JSX.Element | null {
  const { language } = useI18n();
  const spanish = language === "es";

  if (!open) return null;

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-library-title">
      <section className="blocking-modal guide-library-modal">
        <button type="button" className="modal-corner-close" aria-label={spanish ? "Cerrar guías" : "Close guides"} onClick={onClose}>×</button>
        <h2 id="guide-library-title">{spanish ? "Guías" : "Guides"}</h2>
        <p>{spanish ? "Elige una guía corta para conocer una parte de la aplicación." : "Choose a short guide to get to know one part of the app."}</p>
        <div className="guide-library-options">
          <button type="button" onClick={onStartBasics}>
            <strong>{spanish ? "Primeros pasos" : "Learning basics"}</strong>
            <span>{spanish ? "Crea contenido, guarda elementos y prueba una sesión." : "Create content, save useful items, and try a session."}</span>
          </button>
          <button type="button" onClick={onStartConversation}>
            <strong>{spanish ? "Práctica de conversación" : "Conversation practice"}</strong>
            <span>{spanish ? "Elige un tema, genera un objetivo y empieza a hablar." : "Choose a topic, generate a goal, and start speaking."}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
