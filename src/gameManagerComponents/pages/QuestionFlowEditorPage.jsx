import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import "../../index.css";

function getStepLabel(page, index) {
  if (page.type === "answer") return "Answer";
  return `Question ${index + 1}`;
}

function getAutoTitle(flowPages, game) {
  const linkedPage = flowPages.find(
    (page) =>
      page.boardLink?.categoryName &&
      page.boardLink?.clueValue !== null &&
      page.boardLink?.clueValue !== undefined
  );

  if (!linkedPage) {
    return "Unlinked flow";
  }

  const categoryName = linkedPage.boardLink.categoryName || "Category";
  const clueValue = linkedPage.boardLink.clueValue ?? "?";
  const currency = game?.currency || "Points";

  return `${categoryName} - ${clueValue} ${currency}`;
}

function QuestionFlowEditorPage() {
  const { id, flowId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [activePageId, setActivePageId] = useState("");
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

      const flowPages = (savedGame.gameConfig?.pages || [])
        .filter((page) => page.flowId === flowId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (flowPages.length === 0) {
        navigate(`/game/${id}`);
        return;
      }

      setGame(savedGame);
      setActivePageId(flowPages[0].id);
    }

    loadGame();
  }, [id, flowId, navigate]);

  const flowPages = useMemo(() => {
    return (game?.gameConfig?.pages || [])
      .filter((page) => page.flowId === flowId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [game, flowId]);

  const activePage = useMemo(() => {
    return flowPages.find((page) => page.id === activePageId) || null;
  }, [flowPages, activePageId]);

  const autoTitle = useMemo(() => {
    return getAutoTitle(flowPages, game);
  }, [flowPages, game]);

  const effectiveTitle =
    draft.titleMode === "custom" && draft.customTitle.trim()
      ? draft.customTitle.trim()
      : autoTitle;

  useEffect(() => {
    if (!activePage) return;

    setDraft({
      titleMode: activePage.titleMode || "auto",
      customTitle: activePage.customTitle || "",
      text: activePage.text || "",
      answer: activePage.answer || "",
      explanation: activePage.explanation || "",
    });
  }, [activePage]);

  function updateDraftField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!game || !activePage || isSaving) return;

    setIsSaving(true);

    const updatedPages = game.gameConfig.pages.map((page) => {
      if (page.id !== activePage.id) return page;

      const commonFields = {
        ...page,
        titleMode: draft.titleMode,
        customTitle: draft.titleMode === "custom" ? draft.customTitle : "",
      };

      if (page.type === "answer") {
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
    setGame(updatedGame);
    setIsSaving(false);
  }

  if (!game || !activePage) return <p>Loading...</p>;

  const questionPagesCount = flowPages.filter(
    (page) => page.type === "question-step"
  ).length;

  const isLinked =
    flowPages.some(
      (page) =>
        page.boardLink?.categoryName &&
        page.boardLink?.clueValue !== null &&
        page.boardLink?.clueValue !== undefined
    );

  return (
    <section className="flow-editor-page">
      <div className="flow-editor-shell">
        <div className="flow-editor-header">
          <div>
            <h1>Question flow editor</h1>
            <p>
              Editing a flow with {questionPagesCount} question page
              {questionPagesCount !== 1 ? "s" : ""} and 1 answer page in{" "}
              {game.name}.
            </p>
          </div>

          <div className="flow-editor-actions">
            <button
              className="secondary-btn"
              type="button"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to game
            </button>
          </div>
        </div>

        <div className="flow-editor-tabs">
          {flowPages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              className={`flow-editor-tab ${
                page.id === activePageId ? "flow-editor-tab--active" : ""
              }`}
              onClick={() => setActivePageId(page.id)}
            >
              {getStepLabel(page, index)}
            </button>
          ))}
        </div>

        <form className="flow-editor-card" onSubmit={handleSave}>
          <div className="flow-editor-card__header">
            <div>
              <h2>{activePage.type === "answer" ? "Answer page" : "Question page"}</h2>
              <p>
                {activePage.type === "answer"
                  ? "Add the final answer and optional explanation."
                  : "Write the clue or prompt shown on this step."}
              </p>
            </div>
          </div>

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
            <label className="flow-editor-field">
              <span>Custom title</span>
              <input
                type="text"
                value={draft.customTitle}
                onChange={(e) => updateDraftField("customTitle", e.target.value)}
                placeholder={autoTitle}
              />
            </label>
          )}

          <div className="flow-editor-fields">
            {activePage.type === "answer" ? (
              <>
                <label className="flow-editor-field">
                  <span>Answer</span>
                  <textarea
                    value={draft.answer}
                    onChange={(e) => updateDraftField("answer", e.target.value)}
                    placeholder="Write the correct answer here"
                  />
                </label>

                <label className="flow-editor-field">
                  <span>Explanation</span>
                  <textarea
                    value={draft.explanation}
                    onChange={(e) =>
                      updateDraftField("explanation", e.target.value)
                    }
                    placeholder="Add extra context, explanation, or fun facts"
                  />
                </label>
              </>
            ) : (
              <label className="flow-editor-field">
                <span>Question text</span>
                <textarea
                  value={draft.text}
                  onChange={(e) => updateDraftField("text", e.target.value)}
                  placeholder="Write the question, clue, or prompt shown to players"
                />
              </label>
            )}
          </div>

          <div className="flow-editor-footer">
            <button className="primary-btn" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default QuestionFlowEditorPage;