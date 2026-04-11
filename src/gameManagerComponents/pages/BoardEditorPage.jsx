import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import "../../index.css";

function getFlowAutoTitle(flowPages, currency = "Points") {
  const linkedPage = flowPages.find(
    (item) =>
      item.boardLink?.categoryName &&
      item.boardLink?.clueValue !== null &&
      item.boardLink?.clueValue !== undefined
  );

  if (!linkedPage) return "Unlinked flow";

  return `${linkedPage.boardLink.categoryName} - ${linkedPage.boardLink.clueValue} ${currency}`;
}

function BoardEditorPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [pointsInput, setPointsInput] = useState("");
  const [isSavingCell, setIsSavingCell] = useState(false);
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      const boardPage = (savedGame.gameConfig?.pages || []).find((page) => page.id === pageId);

      if (!boardPage) {
        navigate(`/game/${id}`);
        return;
      }

      if (!boardPage.isConfigured) {
        navigate(`/game/${id}/board/${pageId}/setup`);
        return;
      }

      setGame(savedGame);
    }

    loadGame();
  }, [id, pageId, navigate]);

  const boardPage = useMemo(() => {
    return (game?.gameConfig?.pages || []).find((page) => page.id === pageId);
  }, [game, pageId]);

  const flowMap = useMemo(() => {
    const pages = game?.gameConfig?.pages || [];
    const grouped = new Map();

    pages.forEach((page) => {
      if (!page.flowId) return;
      if (!grouped.has(page.flowId)) grouped.set(page.flowId, []);
      grouped.get(page.flowId).push(page);
    });

    return grouped;
  }, [game]);

  function openCellEditor(categoryId, rowIndex) {
    if (!boardPage) return;

    const category = boardPage.categories.find((item) => item.id === categoryId);
    const question = category?.questions?.[rowIndex];

    if (!category || !question) return;

    setSelectedCell({
      categoryId,
      rowIndex,
      categoryName: category.name,
      questionId: question.id,
      flowId: question.flowId || null,
    });

    setPointsInput(
      question.points !== null && question.points !== undefined
        ? String(question.points)
        : ""
    );
  }

  function closeCellEditor() {
    setSelectedCell(null);
    setPointsInput("");
    setIsSavingCell(false);
    setIsCreatingFlow(false);
  }

  async function saveCellPoints(e) {
    e.preventDefault();

    if (!game || !boardPage || !selectedCell || isSavingCell) return;

    setIsSavingCell(true);

    const parsedPoints =
      pointsInput.trim() === "" ? null : Math.max(0, Number(pointsInput));

    const updatedPages = game.gameConfig.pages.map((page) => {
      if (page.id !== boardPage.id) return page;

      return {
        ...page,
        categories: page.categories.map((category) => {
          if (category.id !== selectedCell.categoryId) return category;

          return {
            ...category,
            questions: category.questions.map((question, index) => {
              if (index !== selectedCell.rowIndex) return question;

              return {
                ...question,
                points: Number.isFinite(parsedPoints) ? parsedPoints : null,
              };
            }),
          };
        }),
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
    setIsSavingCell(false);
    closeCellEditor();
  }

  async function openOrCreateFlow() {
    if (!game || !boardPage || !selectedCell || isCreatingFlow) return;

    const category = boardPage.categories.find((item) => item.id === selectedCell.categoryId);
    const question = category?.questions?.[selectedCell.rowIndex];

    if (!category || !question) return;

    if (question.flowId) {
      navigate(`/game/${id}/flow/${question.flowId}`);
      return;
    }

    setIsCreatingFlow(true);

    const flowId = crypto.randomUUID();
    const clueValue =
      question.points !== null && question.points !== undefined
        ? question.points
        : (selectedCell.rowIndex + 1) * 100;

    const questionPage = {
      id: crypto.randomUUID(),
      flowId,
      type: "question-step",
      order: 1,
      layout: null,
      titleMode: "auto",
      customTitle: "",
      boardLink: {
        boardPageId: boardPage.id,
        categoryId: category.id,
        categoryName: category.name,
        clueValue,
      },
      text: "",
      media: [],
      hints: [],
    };

    const answerPage = {
      id: crypto.randomUUID(),
      flowId,
      type: "answer",
      order: 2,
      layout: null,
      titleMode: "auto",
      customTitle: "",
      boardLink: {
        boardPageId: boardPage.id,
        categoryId: category.id,
        categoryName: category.name,
        clueValue,
      },
      answer: "",
      explanation: "",
      media: [],
    };

    const updatedPages = game.gameConfig.pages.map((page) => {
      if (page.id !== boardPage.id) return page;

      return {
        ...page,
        categories: page.categories.map((cat) => {
          if (cat.id !== category.id) return cat;

          return {
            ...cat,
            questions: cat.questions.map((item, index) => {
              if (index !== selectedCell.rowIndex) return item;

              return {
                ...item,
                points: clueValue,
                flowId,
              };
            }),
          };
        }),
      };
    });

    const updatedGame = {
      ...game,
      gameConfig: {
        ...game.gameConfig,
        pages: [...updatedPages, questionPage, answerPage],
      },
      updatedAt: Date.now(),
    };

    await updateGame(updatedGame);
    setGame(updatedGame);
    navigate(`/game/${id}/flow/${flowId}`);
  }

  if (!game || !boardPage) return <p>Loading...</p>;

  const currency = game.currency || "Points";
  const players = game.gameConfig?.players || [];
  const rowCount = boardPage.questionCount || 0;
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  return (
    <section
      className="board-editor-page"
      style={
        boardPage.background
          ? { backgroundImage: `url(${boardPage.background})` }
          : undefined
      }
    >
      <div className="board-editor-overlay">
        <div className="board-editor-header">
          <div>
            <h1>{boardPage.name || "Board"}</h1>
            <p>Click a question cell to edit its points or open its linked flow.</p>
          </div>

          <div className="manager-page__actions">
            <button
              className="secondary-btn"
              onClick={() => navigate(`/game/${id}/board/${pageId}/setup`)}
            >
              Reconfigure board
            </button>
            <button
              className="secondary-btn"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to game
            </button>
          </div>
        </div>

        <div className={`board-editor-layout ${selectedCell ? "board-editor-layout--with-panel" : ""}`}>
          <div className="board-main-column">
            <div
              className="board-grid"
              style={{ gridTemplateColumns: `repeat(${boardPage.categories.length}, minmax(0, 1fr))` }}
            >
              {boardPage.categories.map((category) => (
                <div key={category.id} className="board-category-header">
                  {category.name}
                </div>
              ))}

              {rows.flatMap((rowIndex) =>
                boardPage.categories.map((category) => {
                  const question = category.questions?.[rowIndex];
                  const flowPages = question?.flowId ? flowMap.get(question.flowId) || [] : [];
                  const flowTitle = question?.flowId
                    ? getFlowAutoTitle(flowPages, currency)
                    : "No flow yet";

                  const isConfigured =
                    question?.points !== null ||
                    question?.flowId;

                  return (
                    <button
                      key={question?.id || `${category.id}-${rowIndex}`}
                      className={`board-cell ${isConfigured ? "board-cell--configured" : ""}`}
                      type="button"
                      onClick={() => openCellEditor(category.id, rowIndex)}
                    >
                      <span className="board-cell__main">
                        {question?.points !== null && question?.points !== undefined
                          ? `${question.points} ${currency}`
                          : `Question ${rowIndex + 1}`}
                      </span>

                      <span className="board-cell__sub">
                        {flowTitle}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selectedCell && (
            <aside className="board-side-panel">
              <div className="board-side-panel__header">
                <div>
                  <h2>Edit cell</h2>
                  <p>
                    {selectedCell.categoryName}, question {selectedCell.rowIndex + 1}
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeCellEditor}
                >
                  Close
                </button>
              </div>

              <form className="board-side-panel__form" onSubmit={saveCellPoints}>
                <label className="board-setup-field">
                  <span>Points</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pointsInput}
                    placeholder={`e.g. 100 ${currency}`}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d+$/.test(value)) {
                        setPointsInput(value);
                      }
                    }}
                  />
                </label>

                <div className="board-side-panel__info">
                  <p>
                    Save points here. Then open the linked flow to edit question and answer content.
                  </p>
                </div>

                <div className="board-side-panel__actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={closeCellEditor}
                    disabled={isSavingCell || isCreatingFlow}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="secondary-btn"
                    disabled={isSavingCell || isCreatingFlow}
                  >
                    {isSavingCell ? "Saving..." : "Save points"}
                  </button>

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={openOrCreateFlow}
                    disabled={isSavingCell || isCreatingFlow}
                  >
                    {selectedCell.flowId ? "Open flow" : isCreatingFlow ? "Creating..." : "Create flow"}
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>

        {players.length > 0 && (
          <div className="board-score-strip">
            {players.map((player, index) => {
              const name =
                typeof player === "string"
                  ? player
                  : player.playerName || `Player ${index + 1}`;

              const score =
                typeof player === "string"
                  ? 0
                  : Number(player.score || 0);

              return (
                <div
                  key={typeof player === "string" ? `${name}-${index}` : player.id}
                  className="board-score-card"
                >
                  <div className="board-score-card__name">{name}</div>
                  <div className="board-score-card__score">
                    {score} {currency}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default BoardEditorPage;