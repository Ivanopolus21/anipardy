import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import '../../index.css'

function BoardEditorPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [pointsInput, setPointsInput] = useState("");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isSavingCell, setIsSavingCell] = useState(false);

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

  const availableFlows = useMemo(() => {
    if (!game) return [];

    const pages = game.gameConfig?.pages || [];
    const usedFlowIds = new Set();

    return pages
      .filter((page) => page.flowId)
      .filter((page) => {
        if (usedFlowIds.has(page.flowId)) return false;
        usedFlowIds.add(page.flowId);
        return true;
      })
      .map((page) => ({
        id: page.flowId,
        name: page.flowName || "Question flow",
      }));
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
    });

    setPointsInput(
      question.points !== null && question.points !== undefined
        ? String(question.points)
        : ""
    );

    setSelectedFlowId(question.flowId || "");
  }

  function closeCellEditor() {
    setSelectedCell(null);
    setPointsInput("");
    setSelectedFlowId("");
    setIsSavingCell(false);
  }

  async function saveCellChanges(e) {
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
                flowId: selectedFlowId || null,
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
    closeCellEditor();
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
            <p>Click a question cell to set points and connect a question flow.</p>
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
                const flow = availableFlows.find((item) => item.id === question?.flowId);
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
                      {flow ? flow.name : "No flow assigned"}
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

              <form className="board-side-panel__form" onSubmit={saveCellChanges}>
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

                <label className="board-setup-field">
                  <span>Question flow</span>
                  <select
                    value={selectedFlowId}
                    onChange={(e) => setSelectedFlowId(e.target.value)}
                  >
                    <option value="">No flow selected</option>
                    {availableFlows.map((flow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="board-side-panel__info">
                  <p>
                    Tip: you can save just points, just a flow, or both.
                  </p>
                </div>

                <div className="board-side-panel__actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={closeCellEditor}
                    disabled={isSavingCell}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={isSavingCell}
                  >
                    Save cell
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