import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import "../../index.css";

function getAutoTitle(flowPages, game) {
  const linkedPage = flowPages.find(
    (item) =>
      item.boardLink?.categoryName &&
      item.boardLink?.clueValue !== null &&
      item.boardLink?.clueValue !== undefined
  );

  if (!linkedPage) {
    return "Unlinked flow";
  }

  const categoryName = linkedPage.boardLink.categoryName || "Category";
  const clueValue = linkedPage.boardLink.clueValue ?? "?";
  const currency = game?.currency || "Points";

  return `${categoryName} - ${clueValue} ${currency}`;
}

function FlowStepEditorPage() {
  const { id, flowId, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [draft, setDraft] = useState({
    titleMode: "auto",
    customTitle: "",
    text: "",
    answer: "",
    explanation: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      setGame(savedGame);
    }

    loadGame();
  }, [id, navigate]);

  const flowPages = useMemo(() => {
    return (game?.gameConfig?.pages || [])
      .filter((item) => item.flowId === flowId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [game, flowId]);

  const page = useMemo(() => {
    return flowPages.find((item) => item.id === pageId);
  }, [flowPages, pageId]);

  const autoTitle = useMemo(() => {
    return getAutoTitle(flowPages, game);
  }, [flowPages, game]);

  const effectiveTitle =
    draft.titleMode === "custom" && draft.customTitle.trim()
      ? draft.customTitle.trim()
      : autoTitle;

  useEffect(() => {
    if (!page) return;

    setDraft({
      titleMode: page.titleMode || "auto",
      customTitle: page.customTitle || "",
      text: page.text || "",
      answer: page.answer || "",
      explanation: page.explanation || "",
    });
  }, [page]);

  function updateDraftField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!game || !page || isSaving) return;

    setIsSaving(true);

    const updatedPages = game.gameConfig.pages.map((item) => {
      if (item.id !== page.id) return item;

      const commonFields = {
        ...item,
        titleMode: draft.titleMode,
        customTitle: draft.titleMode === "custom" ? draft.customTitle : "",
      };

      if (item.type === "answer") {
        return {
          ...commonFields,
          answer: draft.answer,
          explanation: draft.explanation,
        };
      }

      return {
        ...commonFields,
        text: draft.text,
      };
    });

    const updatedGame = {
      ...game,
      gameConfig: {
        ...game.gameConfig,
        pages: updatedPages,
      },
      updatedAt: Date.now(),
    };

    await updateGame(updatedGame);
    navigate(`/game/${id}/flow/${flowId}`);
  }

  if (!game || !page) return <p>Loading...</p>;

  const isLinked = flowPages.some(
    (item) =>
      item.boardLink?.categoryName &&
      item.boardLink?.clueValue !== null &&
      item.boardLink?.clueValue !== undefined
  );

  return (
    <section className="player-setup">
      <form className="player-setup__card" onSubmit={handleSave}>
        <h1>{page.type === "answer" ? "Edit answer page" : "Edit question page"}</h1>
        <p>Layout: {page.layout || "Not selected"}</p>

        <div className="flow-editor-title-box">
          <span className="flow-editor-title-box__label">Internal title</span>
          <div className="flow-editor-title-preview">{effectiveTitle}</div>
          <p className="flow-editor-title-help">
            {isLinked
              ? "This title is generated from the linked board category and points."
              : "This flow is not linked to a board cell yet. The title will update automatically after linking."}
          </p>
        </div>

        <label className="flow-editor-checkbox">
          <input
            type="checkbox"
            checked={draft.titleMode === "custom"}
            onChange={(e) =>
              updateDraftField("titleMode", e.target.checked ? "custom" : "auto")
            }
          />
          <span>Use custom title</span>
        </label>

        {draft.titleMode === "custom" && (
          <input
            type="text"
            placeholder={autoTitle}
            value={draft.customTitle}
            onChange={(e) => updateDraftField("customTitle", e.target.value)}
          />
        )}

        {page.type === "answer" ? (
          <>
            <textarea
              rows="4"
              placeholder="Answer"
              value={draft.answer}
              onChange={(e) => updateDraftField("answer", e.target.value)}
            />
            <textarea
              rows="5"
              placeholder="Explanation or extra notes"
              value={draft.explanation}
              onChange={(e) => updateDraftField("explanation", e.target.value)}
            />
          </>
        ) : (
          <textarea
            rows="6"
            placeholder="Question text"
            value={draft.text}
            onChange={(e) => updateDraftField("text", e.target.value)}
          />
        )}

        <div className="player-setup__actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate(`/game/${id}/flow/${flowId}`)}
            disabled={isSaving}
          >
            Back
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate(`/game/${id}/flow/${flowId}/step/${pageId}/template`)}
            disabled={isSaving}
          >
            Change layout
          </button>

          <button type="submit" className="primary-btn" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save step"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default FlowStepEditorPage;