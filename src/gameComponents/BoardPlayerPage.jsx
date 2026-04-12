import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../db.js";
import "../index.css";

function BoardPlayerPage() {
    const { id, pageId } = useParams();
    const navigate = useNavigate();

    const [game, setGame] = useState(null);

    useEffect(() => {
        async function loadGame() {
            const savedGame = await getGameById(id);

            if (!savedGame) {
                navigate("/");
                return;
            }

            const boardPage = (savedGame.gameConfig?.pages || []).find(
              (page) => page.id === pageId && page.type === "board"
            );

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
        return (game?.gameConfig?.pages || []).find(
          (page) => page.id === pageId && page.type === "board"
        );
    }, [game, pageId]);

    const boardPages = useMemo(() => {
        return (game?.gameConfig?.pages || []).filter(
          (page) => page.type === "board" && page.isConfigured
        );
    }, [game]);

    const hasCompletedQuestions = useMemo(() => {
        return (boardPage?.categories || []).some((category) =>
          (category.questions || []).some((question) => question?.isCompleted)
        );
    }, [boardPage]);

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

    const currentBoardIndex = useMemo(() => {
        return boardPages.findIndex((page) => page.id === pageId);
    }, [boardPages, pageId]);

    const previousBoard =
      currentBoardIndex > 0 ? boardPages[currentBoardIndex - 1] : null;

    const nextBoard =
      currentBoardIndex >= 0 && currentBoardIndex < boardPages.length - 1
        ? boardPages[currentBoardIndex + 1]
        : null;


    const players = useMemo(() => {
        const rawPlayers =
          Array.isArray(game?.gameConfig?.players) && game.gameConfig.players.length > 0
            ? game.gameConfig.players
            : Array.isArray(game?.players) && game.players.length > 0
              ? game.players
              : [];

        return rawPlayers.map((player, index) => {
            if (typeof player === "string") {
                return {
                    id: `player-${index}`,
                    name: player.trim() || `Player ${index + 1}`,
                    score: 0,
                };
            }

            return {
                id: player.id || `player-${index}`,
                name:
                  player.playerName ||
                  player.name ||
                  player.title ||
                  `Player ${index + 1}`,
                score: Number(player.score || 0),
            };
        });
    }, [game]);

    async function openCell(category, rowIndex) {
        if (!game || !boardPage) return;

        const question = category.questions?.[rowIndex];
        if (!question) return;

        const flowPages = question.flowId ? flowMap.get(question.flowId) || [] : [];
        const hasExistingFlow = flowPages.length > 0;
        const hasPoints =
          question.points !== null && question.points !== undefined;

        if (!(hasPoints && hasExistingFlow)) return;

        const updatedPages = (game.gameConfig?.pages || []).map((page) => {
            if (page.id !== boardPage.id) return page;

            return {
                ...page,
                categories: page.categories.map((item) => {
                    if (item.id !== category.id) return item;

                    return {
                        ...item,
                        questions: item.questions.map((entry, index) => {
                            if (index !== rowIndex) return entry;

                            return {
                                ...entry,
                                isCompleted: true,
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

        setGame(updatedGame);

        try {
            await updateGame(updatedGame);
        } finally {
            navigate(`/game/${id}/flow/${question.flowId}/play`);
        }
    }

    async function resetBoard() {
        if (!game || !boardPage) return;

        const confirmed = window.confirm(
          "Reset this board and make all its cells playable again?"
        );

        if (!confirmed) return;

        const updatedPages = (game.gameConfig?.pages || []).map((page) => {
            if (page.id !== boardPage.id) return page;

            return {
                ...page,
                categories: (page.categories || []).map((category) => ({
                    ...category,
                    questions: (category.questions || []).map((question) => ({
                        ...question,
                        isCompleted: false,
                    })),
                })),
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

        setGame(updatedGame);
        await updateGame(updatedGame);
    }

    if (!game || !boardPage) {
        return <p>Loading...</p>;
    }

    const currency = game.currency || "Points";
    const rowCount = boardPage.questionCount || 0;
    const rows = Array.from({ length: rowCount }, (_, index) => index);

    return (
      <section
        className="board-editor-page game-board-player-page"
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
                  </div>

                  <div className="manager-page__actions">
                      {boardPages.length > 1 && (
                        <>
                            <button
                              className="secondary-btn"
                              onClick={() =>
                                previousBoard && navigate(`/play/${id}/board/${previousBoard.id}`)
                              }
                              disabled={!previousBoard}
                            >
                                Previous
                            </button>

                            <button
                              className="secondary-btn"
                              onClick={() =>
                                nextBoard && navigate(`/play/${id}/board/${nextBoard.id}`)
                              }
                              disabled={!nextBoard}
                            >
                                Next
                            </button>
                        </>
                      )}

                      {boardPages.length > 1 && currentBoardIndex >= 0 ? (
                        <div className="game-board-player-position">
                            {currentBoardIndex + 1} of {boardPages.length}
                        </div>
                      ) : null}

                      {hasCompletedQuestions && (
                        <button className="secondary-btn" onClick={resetBoard}>
                            Reset board
                        </button>
                      )}

                      <button
                        className="secondary-btn"
                        onClick={() => navigate(`/game/${id}`)}
                      >
                          Back to manager
                      </button>
                  </div>
              </div>

              <div className="board-main-column">
                  <div
                    className="board-grid"
                    style={{
                        gridTemplateColumns: `repeat(${boardPage.categories.length}, minmax(0, 1fr))`,
                    }}
                  >
                      {boardPage.categories.map((category) => (
                        <div key={category.id} className="board-category-header">
                            {category.name}
                        </div>
                      ))}

                      {rows.flatMap((rowIndex) =>
                          boardPage.categories.map((category) => {
                              const question = category.questions?.[rowIndex];
                              const flowPages = question?.flowId
                                ? flowMap.get(question.flowId) || []
                                : [];

                              const hasExistingFlow = flowPages.length > 0;
                              const hasPoints =
                                question?.points !== null && question?.points !== undefined;
                              const isPlayable = hasPoints && hasExistingFlow;
                              const isCompleted = Boolean(question?.isCompleted);

                              return (
                                <button
                                  key={question?.id || `${category.id}-${rowIndex}`}
                                  className={`board-cell board-cell--play ${
                                    !isPlayable
                                      ? "board-cell--disabled"
                                      : isCompleted
                                        ? "board-cell--completed"
                                        : "board-cell--configured"
                                  }`}
                                  type="button"
                                  onClick={() => openCell(category, rowIndex)}
                                  disabled={!isPlayable}
                                >
                                <span className="board-cell__main">
                                  {hasPoints ? `${question.points} ${currency}` : "Not set"}
                                </span>
                                <span className="board-cell__sub">
                                  {!isPlayable ? "Not configured" : isCompleted ? "Completed" : ""}
                                </span>
                                </button>
                              );
                          })
                      )}
                  </div>
              </div>

              {players.length > 0 && (
                <div className="board-score-strip">
                    {players.map((player) => (
                      <div key={player.id} className="board-score-card">
                          <div className="board-score-card__name">{player.name}</div>
                          <div className="board-score-card__score">
                              {player.score} {currency}
                          </div>
                      </div>
                    ))}
                </div>
              )}
          </div>
      </section>
    );
}

export default BoardPlayerPage;