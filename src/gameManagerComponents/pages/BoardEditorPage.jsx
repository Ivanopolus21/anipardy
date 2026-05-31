import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame, saveMedia } from "../../db.js";
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
  const location = useLocation();

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

  async function createStoredMediaRecord(file) {
    const mediaRecord = {
      id: crypto.randomUUID(),
      blob: file,
      name: file.name,
      mimeType: file.type || "",
      size: file.size || 0,
      createdAt: Date.now(),
    };

    await saveMedia(mediaRecord);

    return {
      mediaId: mediaRecord.id,
      name: mediaRecord.name,
      mimeType: mediaRecord.mimeType,
    };
  }

  const boardPage = useMemo(() => {
    return (game?.gameConfig?.pages || []).find((page) => page.id === pageId);
  }, [game, pageId]);

  const selectedCategory = useMemo(() => {
    if (!boardPage || !selectedCell) return null;
    return boardPage.categories.find((item) => item.id === selectedCell.categoryId) || null;
  }, [boardPage, selectedCell]);

  const hasColumnBackground = Boolean(
    selectedCategory?.columnBackgroundMediaId || selectedCategory?.columnBackgroundName?.trim()
  );

  const columnBackgroundInputRef = useRef(null);

  async function handleColumnBackgroundFileChange(file) {
    if (!file || !selectedCell || !game || !boardPage) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return;

    try {
      const storedMedia = await createStoredMediaRecord(file);

      const updatedPages = game.gameConfig.pages.map((page) => {
        if (page.id !== boardPage.id) return page;

        return {
          ...page,
          categories: page.categories.map((category) =>
            category.id === selectedCell.categoryId
              ? {
                ...category,
                columnBackgroundMediaId: storedMedia.mediaId,
                columnBackgroundName: storedMedia.name,
              }
              : category
          ),
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
    } catch (error) {
      console.error("Failed to save column background:", error);
    }
  }

  async function removeColumnBackground() {
    if (!selectedCell || !game || !boardPage) return;

    if (columnBackgroundInputRef.current) {
      columnBackgroundInputRef.current.value = "";
    }

    const updatedPages = game.gameConfig.pages.map((page) => {
      if (page.id !== boardPage.id) return page;

      return {
        ...page,
        categories: page.categories.map((category) =>
          category.id === selectedCell.categoryId
            ? {
              ...category,
              columnBackgroundMediaId: "",
              columnBackgroundName: "",
            }
            : category
        ),
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
  }

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

  async function persistCellPoints() {
    if (!game || !boardPage || !selectedCell || isSavingCell) return null;

    setIsSavingCell(true);

    try {
      const parsedPoints =
        pointsInput.trim() === "" ? null : Math.max(0, Number(pointsInput));

      const nextPoints = Number.isFinite(parsedPoints) ? parsedPoints : null;

      const category = boardPage.categories.find(
        (item) => item.id === selectedCell.categoryId
      );

      const nextCategoryName = category?.name || selectedCell.categoryName || "Category";

      const question = category?.questions?.[selectedCell.rowIndex];
      const linkedFlowId = question?.flowId || selectedCell.flowId || null;

      const updatedPages = game.gameConfig.pages.map((page) => {
        if (page.id === boardPage.id) {
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
                    points: nextPoints,
                  };
                }),
              };
            }),
          };
        }

        if (linkedFlowId && page.flowId === linkedFlowId && page.boardLink) {
          return {
            ...page,
            boardLink: {
              ...page.boardLink,
              categoryName: nextCategoryName,
              clueValue: nextPoints,
            },
          };
        }

        return page;
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

      return {
        updatedGame,
        nextPoints,
        category,
      };
    } finally {
      setIsSavingCell(false);
    }
  }

  async function saveCellPoints(e) {
    e.preventDefault();
    await persistCellPoints();
  }

  const selectedQuestion = useMemo(() => {
    if (!boardPage || !selectedCell) return null;

    const category = boardPage.categories.find(
      (item) => item.id === selectedCell.categoryId
    );

    return category?.questions?.[selectedCell.rowIndex] || null;
  }, [boardPage, selectedCell]);

  const boardPages = useMemo(() => {
    return (game?.gameConfig?.pages || []).filter((page) => page.type === "board");
  }, [game]);

  useEffect(() => {
    const selectedFromState = location.state?.selectedCell;
    if (!boardPage || !selectedFromState) return;

    openCellEditor(selectedFromState.categoryId, selectedFromState.rowIndex);
  }, [boardPage, location.state]);

  const currentBoardIndex = useMemo(() => {
    return boardPages.findIndex((page) => page.id === pageId);
  }, [boardPages, pageId]);

  const previousBoard = currentBoardIndex > 0 ? boardPages[currentBoardIndex - 1] : null;
  const nextBoard =
    currentBoardIndex >= 0 && currentBoardIndex < boardPages.length - 1
      ? boardPages[currentBoardIndex + 1]
      : null;

  const linkedFlowPages =
    selectedQuestion?.flowId ? flowMap.get(selectedQuestion.flowId) || [] : [];

  const hasExistingFlow = linkedFlowPages.length > 0;

  const typedPoints =
    pointsInput.trim() === "" ? null : Number(pointsInput);

  const hasTypedPoints =
    Number.isFinite(typedPoints) && typedPoints >= 0;

  const canCreateFlow = Boolean(hasExistingFlow || hasTypedPoints);

  async function openOrCreateFlow() {
    if (!game || !boardPage || !selectedCell || isCreatingFlow) return;

    const category = boardPage.categories.find((item) => item.id === selectedCell.categoryId);
    const question = category?.questions?.[selectedCell.rowIndex];
    const saveResult = await persistCellPoints();
    const latestGame = saveResult?.updatedGame || game;
    const latestPoints = saveResult?.nextPoints ?? question.points;

    if (!category || !question || latestPoints === null || latestPoints === undefined) return;

    const refreshedBoardPage = (latestGame.gameConfig?.pages || []).find(
      (page) => page.id === boardPage.id
    );

    const refreshedCategory = refreshedBoardPage?.categories.find(
      (item) => item.id === selectedCell.categoryId
    );

    const refreshedQuestion = refreshedCategory?.questions?.[selectedCell.rowIndex];

    const existingFlowPages = refreshedQuestion?.flowId
      ? flowMap.get(refreshedQuestion.flowId) || []
      : [];

    if (existingFlowPages.length > 0) {
      navigate(`/game/${id}/flow/${refreshedQuestion.flowId}`, {
        state: {
          returnTo: `/game/${id}/board/${pageId}`,
          selectedCell: {
            categoryId: selectedCell.categoryId,
            rowIndex: selectedCell.rowIndex,
          },
        },
      });
      return;
    }

    setIsCreatingFlow(true);

    const flowId = crypto.randomUUID();
    const clueValue = latestPoints;

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

    const updatedPages = latestGame.gameConfig.pages.map((page) => {
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
      ...latestGame,
      gameConfig: {
        ...latestGame.gameConfig,
        pages: [...updatedPages, questionPage, answerPage],
      },
      updatedAt: Date.now(),
    };

    await updateGame(updatedGame);
    setGame(updatedGame);
    navigate(`/game/${id}/flow/${flowId}`, {
      state: {
        returnTo: `/game/${id}/board/${pageId}`,
        selectedCell: {
          categoryId: selectedCell.categoryId,
          rowIndex: selectedCell.rowIndex,
        },
      },
    });
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
            <h1>{game.name}</h1>
            <p>
              {boardPage.name ? `Editing board: ${boardPage.name}. ` : ""}
              Click a question cell to edit its points or open its linked flow.
            </p>
          </div>

          <div className="manager-page__actions">
            {boardPages.length > 1 && (
              <>
                <button
                  className="secondary-btn"
                  onClick={() => previousBoard && navigate(`/game/${id}/board/${previousBoard.id}`)}
                  disabled={!previousBoard}
                >
                  Previous board
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => nextBoard && navigate(`/game/${id}/board/${nextBoard.id}`)}
                  disabled={!nextBoard}
                >
                  Next board
                </button>
              </>
            )}

            <button
              className="secondary-btn"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to manager
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
                  const hasFlow = flowPages.length > 0;

                  const flowTitle = hasFlow
                    ? getFlowAutoTitle(flowPages, currency)
                    : "No flow yet";

                  const hasPoints =
                    question?.points !== null && question?.points !== undefined;

                  const hasLinkedFlow = flowPages.length > 0;

                  const cellStatus = hasLinkedFlow
                    ? "linked"
                    : hasPoints
                      ? "partial"
                      : "unconfigured";

                  return (
                    <button
                      key={question?.id || `${category.id}-${rowIndex}`}
                      className={`board-cell board-cell--${cellStatus}`}
                      type="button"
                      onClick={() => openCellEditor(category.id, rowIndex)}
                    >
                      <span className="board-cell__main">
                        {hasPoints ? `${question.points} ${currency}` : `Question ${rowIndex + 1}`}
                      </span>

                      <span className="board-cell__sub">
                        {cellStatus === "linked"
                          ? "Linked"
                          : cellStatus === "partial"
                            ? "Points set, flow missing"
                            : "Not configured"}
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
                    Type the points, then create the flow. The value will be saved automatically.
                  </p>
                </div>

                <div className="board-side-panel__info">
                  <p>
                    Column background applies to all flow pages in this category unless a page has its own background override.
                  </p>
                </div>

                <div className="board-side-panel__section">
                  <label className="board-setup-field">
                    <span>Column background</span>
                    <input
                      ref={columnBackgroundInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => handleColumnBackgroundFileChange(e.target.files?.[0])}
                    />
                  </label>

                  {hasColumnBackground ? (
                    <div className="board-side-panel__info">
                      <p>Current column background: {selectedCategory.columnBackgroundName}</p>
                      <button
                        type="button"
                        className="secondary-btn board-side-panel__remove-bg-btn"
                        onClick={removeColumnBackground}
                        disabled={isSavingCell || isCreatingFlow}
                      >
                        Remove column background
                      </button>
                    </div>
                  ) : (
                    <div className="board-side-panel__info">
                      <p>No column background selected.</p>
                    </div>
                  )}
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
                    {isSavingCell ? "Saving..." : "Save"}
                  </button>

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={openOrCreateFlow}
                    disabled={isSavingCell || isCreatingFlow || !canCreateFlow}
                  >
                    {hasExistingFlow
                      ? "Open flow"
                      : isCreatingFlow
                        ? "Creating..."
                        : "Create flow"}
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