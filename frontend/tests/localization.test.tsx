import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "../src/i18n";
import SingStrategyPanel from "../src/components/strategies/SingStrategyPanel";
import NounExerciseSelector from "../src/components/NounExerciseSelector";
import VerbExerciseSelector from "../src/components/VerbExerciseSelector";
import ConfigurationAdminAIUsageSection from "../src/features/admin/components/ConfigurationAdminAIUsageSection";
import { fetchAdminAIUsage, updateAdminAIUsageLimit } from "../src/adminUsageApi";
import { GERMAN_PHRASE_GRAMMAR_FEATURE_PRESENTATION as german } from "../src/components/strategies/germanPhraseGrammarFeaturePresentation";
import { ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION as english } from "../src/components/strategies/englishPhraseGrammarFeaturePresentation";
import { DebugToolsPanel, DebugToolsProvider } from "../src/debugTools";
import ItemAdminActionsModal from "../src/components/ItemAdminActionsModal";
import AIQuotaNotice from "../src/components/AIQuotaNotice";
import { getAIQuotaReachedEventName } from "../src/apiCore";
import LoopingAudioPlayer from "../src/components/LoopingAudioPlayer";
import AuthLanding from "../src/components/AuthLanding";
import { fetchAuthBootstrapStatus, loginWithPin } from "../src/authApi";
import ConversationReviewTurns from "../src/features/conversation/ConversationReviewTurns";
import { useSingStrategy } from "../src/components/strategies/useSingStrategy";
import { generateContentItemSongLyrics } from "../src/apiSingStrategy";
import { usePhraseGrammarFeatures } from "../src/components/strategies/usePhraseGrammarFeatures";
import { fetchContentItemPhraseGrammarFeatures } from "../src/apiStrategies";

vi.mock("../src/adminUsageApi", () => ({ fetchAdminAIUsage: vi.fn(), updateAdminAIUsageLimit: vi.fn() }));
vi.mock("../src/authApi", () => ({ fetchAuthBootstrapStatus: vi.fn(), loginWithPin: vi.fn(), deleteUserAccount: vi.fn(), submitRegistrationRequest: vi.fn() }));
vi.mock("../src/apiSingStrategy", () => ({ generateContentItemSongLyrics: vi.fn(), generateContentItemSong: vi.fn(), generateContentItemSongImage: vi.fn() }));
vi.mock("../src/apiStrategies", () => ({ fetchContentItemPhraseGrammarFeatures: vi.fn(), analyzeContentItemPhraseGrammarFeatures: vi.fn(), fetchContentItemPhraseGrammarExamples: vi.fn() }));

function LanguageSwitch() {
  const { language, setLanguage } = useI18n();
  return <button onClick={() => setLanguage(language === "es" ? "en" : "es")}>Switch language</button>;
}

const singProps = {
  song: null, history: [], itemType: "word" as const,
  isCreatingLyrics: false, isCreatingSong: false, isGeneratingImage: false, error: "",
  onCreateLyrics: vi.fn(), onCreateSong: vi.fn(), onGenerateImage: vi.fn(),
};
const song = { id: "1", target: "Ich singe!", source: "¡Canto!", audioUrl: "/song.mp3", imageUrl: "", durationSeconds: 8, canChangeLyrics: true, lyricFocus: "" as const };

describe("interface localization", () => {
  beforeEach(() => {
    window.localStorage.setItem("app_language", "es");
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("translates Sing and switches language without changing the lyrics option", () => {
    render(<I18nProvider><LanguageSwitch /><SingStrategyPanel {...singProps} /></I18nProvider>);
    fireEvent.click(screen.getByRole("checkbox", { name: "Letra más larga" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear letra" }));
    expect(singProps.onCreateLyrics).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    expect(screen.getByRole("checkbox", { name: "Longer lyrics" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Create lyrics" })).toBeVisible();
  });

  it("translates existing song controls and history without translating study content", () => {
    render(<I18nProvider><SingStrategyPanel {...singProps} song={song} history={[{ ...song, id: "2" }]} /></I18nProvider>);
    expect(screen.getByRole("button", { name: "Crear otra canción" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Probar otra letra" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear imagen" })).toBeVisible();
    expect(screen.getByText("Canciones anteriores (1)")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Reproducir en bucle", hidden: true })).toHaveLength(2);
    expect(screen.getAllByText("Ich singe!")).toHaveLength(2);
  });

  it("translates pending song generation states", () => {
    render(<I18nProvider><SingStrategyPanel {...singProps} song={song} isCreatingLyrics isCreatingSong isGeneratingImage /></I18nProvider>);
    for (const name of ["Creando letra...", "Creando canción...", "Creando imagen..."]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("translates Forms row and column labels", () => {
    render(<I18nProvider>
      <NounExerciseSelector sections={[]} selectedExerciseKeys={[]} exerciseRunning={false} exerciseEntryKey={e => e.target} onToggleEntry={vi.fn()} onSelectKeys={vi.fn()} onGenerateCase={vi.fn()} />
      <VerbExerciseSelector ariaLabel="Verbs" gridEntries={[]} selectedExerciseKeys={[]} exerciseRunning={false} exerciseEntryKey={e => e.target} onToggleEntry={vi.fn()} onSelectPerson={vi.fn()} onSelectTense={vi.fn()} />
    </I18nProvider>);
    expect(screen.getByRole("button", { name: "Negativo (kein)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasado simple" })).toBeInTheDocument();
  });

  it("translates explanatory grammar labels while retaining the original examples", () => {
    render(<I18nProvider>{german.adjective_ending_gender.example}{english.english_subject_verb_object.example}</I18nProvider>);
    expect(screen.getByText(/Masculino:/)).toHaveTextContent("guter Hund");
    expect(screen.getByText("Quién → Verbo → Qué o a quién")).toBeVisible();
    expect(screen.getByText("coffee")).toBeVisible();
  });

  it("translates item actions", () => {
    render(<I18nProvider><ItemAdminActionsModal open isWord isLearned={false} activeAction={null} message="" error="" onClose={vi.fn()} onRegenerateItem={vi.fn()} onRescanDialogs={vi.fn()} onRegenerateAudio={vi.fn()} onToggleLearned={vi.fn()} onDelete={vi.fn()} /></I18nProvider>);
    expect(screen.getByRole("heading", { name: "Acciones del elemento" })).toBeVisible();
  });

  it("translates debug controls and status", () => {
    window.localStorage.setItem("debugToolsEnabled", "1");
    render(<I18nProvider><DebugToolsProvider><DebugToolsPanel /></DebugToolsProvider></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar registro" }));
    expect(screen.getByText(/Registro de depuración borrado/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Probar voz" })).toBeVisible();
  });

  it("translates quota summaries and editable limits without changing submitted values", async () => {
    const limits = { weekly_generation_credits: 200, weekly_elevenlabs_characters: 10000, weekly_elevenlabs_music_seconds: 60, weekly_realtime_minutes: 45 };
    vi.mocked(fetchAdminAIUsage).mockResolvedValue({ week_start: "2026-09-21", defaults: limits, users: [{ id: 1, username: "learner", email: "learner@example.com", is_superuser: false, is_blocked: false, ...limits, week_generation_credits: 12, week_elevenlabs_characters: 500, week_elevenlabs_music_seconds: 8, week_realtime_minutes: 2 }] });
    render(<I18nProvider><ConfigurationAdminAIUsageSection canManage /></I18nProvider>);
    await screen.findByText("learner");
    expect(screen.getByText(/Presupuesto semanal predeterminado:/)).toHaveTextContent("200 créditos de OpenAI");
    expect(screen.getByText(/Esta semana:/)).toHaveTextContent("12 créditos de OpenAI");
    fireEvent.click(screen.getByText("learner"));
    fireEvent.change(screen.getByLabelText("Créditos de generación"), { target: { value: "250" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar límites" })));
    expect(updateAdminAIUsageLimit).toHaveBeenCalledWith(expect.objectContaining({ weekly_generation_credits: 250 }));
  });

  it("translates quota load failures", async () => {
    vi.mocked(fetchAdminAIUsage).mockRejectedValue(new Error("Failed to load AI usage"));
    render(<I18nProvider><ConfigurationAdminAIUsageSection canManage /></I18nProvider>);
    expect(await screen.findByText("No se pudo cargar el uso de IA")).toBeVisible();
  });

  it.each([
    ["Your weekly live conversation minute limit has been reached. Please try again next week.", "minutos de conversación en vivo"],
    ["Your weekly Eleven Music limit has been reached. Please try again next week.", "Eleven Music"],
    ["Your weekly ElevenLabs character limit has been reached. Please try again next week.", "caracteres de ElevenLabs"],
    ["Your weekly AI usage limit has been reached. Please try again next week.", "uso de IA"],
    ["AI generation is disabled for this account.", "desactivada para esta cuenta"],
    ["", "límite de uso de IA"],
  ])("localizes quota notices without losing the reason: %s", (detail, reason) => {
    render(<I18nProvider><LanguageSwitch /><AIQuotaNotice /></I18nProvider>);
    act(() => window.dispatchEvent(new CustomEvent(getAIQuotaReachedEventName(), { detail })));
    expect(screen.getByRole("alert")).toHaveTextContent(reason);
    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    expect(screen.getByRole("alert")).toHaveTextContent(detail || "Your AI allowance has been reached.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss quota notice" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("localizes audio errors instead of displaying browser diagnostics", async () => {
    vi.stubGlobal("AudioContext", class { async resume() { throw new Error("AudioContext failed"); } });
    render(<I18nProvider><LoopingAudioPlayer src="/song.mp3" /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir en bucle" }));
    expect(await screen.findByText("No se pudo reproducir el audio de la canción")).toBeVisible();
    expect(screen.queryByText("AudioContext failed")).not.toBeInTheDocument();
  });

  it("localizes invalid login feedback", async () => {
    vi.mocked(fetchAuthBootstrapStatus).mockResolvedValue(false);
    vi.mocked(loginWithPin).mockRejectedValue(new Error("Unauthorized"));
    render(<I18nProvider><AuthLanding onAuthenticated={vi.fn()} /></I18nProvider>);
    fireEvent.change(screen.getByPlaceholderText("Nombre de usuario o correo"), { target: { value: "learner" } });
    fireEvent.change(screen.getByPlaceholderText("PIN"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByText("Nombre de usuario, correo o PIN incorrecto.")).toBeVisible();
  });

  it.each([
    [false, false, "Añadir a ejercicios"],
    [true, false, "Añadiendo..."],
    [false, true, "Añadido a ejercicios"],
  ])("translates conversation review actions (%s, %s)", (addingExercises, exercisesAdded, label) => {
    render(<I18nProvider><ConversationReviewTurns
      dialog={{ dialog_id: 1, topic: "Work", context: "", proficiency_level: "A1", audio_url: "", created_at: "", turns: [{ target_text: "Ich arbeite.", source_text: "Trabajo.", speaker: "a" }] }}
      sourceLanguage="spanish" targetLanguage="german" wordActionStatus={{}} sentenceActionStatus={{}}
      requestAddWordFromConversation={vi.fn()} requestAddSentenceFromConversation={vi.fn()}
      originalUserTexts={{ 0: "Ich arbeiten." }} onRequestErrorInfo={vi.fn()} onAddErrorExercises={vi.fn()}
      errorInfoByTurn={{ 0: { loading: false, text: "El verbo concuerda con el sujeto.", error: "", analysis: null, addingExercises, exercisesAdded } }}
    /></I18nProvider>);
    const button = screen.getByRole("button", { name: label });
    expect(button).toBeVisible();
    if (addingExercises || exercisesAdded) expect(button).toBeDisabled();
    else expect(button).toBeEnabled();
  });

  it("localizes the actual Sing API failure and retains specific server details", async () => {
    const { result } = renderHook(() => {
      const { t } = useI18n();
      return useSingStrategy({ itemId: 1, exercisePhrases: {}, sourceLanguage: "spanish", targetLanguage: "german", setExercisePhrases: vi.fn(), errorMessage: t("sing.generationFailed") });
    }, { wrapper: I18nProvider });
    vi.mocked(generateContentItemSongLyrics).mockRejectedValueOnce(new Error("Failed to create song lyrics"));
    await act(() => result.current.createLyrics());
    expect(result.current.error).toBe("No se pudo crear la canción");
    vi.mocked(generateContentItemSongLyrics).mockRejectedValueOnce(new Error("Specific server reason"));
    await act(() => result.current.createLyrics());
    expect(result.current.error).toBe("Specific server reason");
  });

  it("localizes phrase grammar request failures", async () => {
    vi.mocked(fetchContentItemPhraseGrammarFeatures).mockRejectedValue(new Error("Failed to load phrase grammar features"));
    const { result } = renderHook(() => usePhraseGrammarFeatures({ itemId: 4321, sourceLanguage: "spanish", targetLanguage: "german", enabled: true }), { wrapper: I18nProvider });
    await waitFor(() => expect(result.current.error).toBe("No se pudo analizar la gramática de la frase"));
  });
});
