import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateGame, getGameById } from "../../db.js";

function buildManagerItems(pages = []) {
    const items = [];
    const usedFlowIds = new Set();

    for (const page of pages) {
        if (page.flowId) {
            if (usedFlowIds.has(page.flowId)) continue;

            const flowPages = pages
              .filter((p) => p.flowId === page.flowId)
              .sort((a, b) => (a.order || 0) - (b.order || 0));

            items.push({
                id: page.flowId,
                itemType: "question-flow",
                pages: flowPages,
            });

            usedFlowIds.add(page.flowId);
        } else {
            items.push({
                id: page.id,
                itemType: page.type,
                pages: [page],
            });
        }
    }

    return items;
}

function getFlowAutoTitle(flowPages, currency = "Points") {
    const linkedPage = flowPages.find(
      (page) =>
        page.boardLink?.categoryName &&
        page.boardLink?.clueValue !== null &&
        page.boardLink?.clueValue !== undefined
    );

    if (!linkedPage) return "Unlinked flow";

    return `${linkedPage.boardLink.categoryName} - ${linkedPage.boardLink.clueValue} ${currency}`;
}

function GameManagerPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [game, setGame] = useState(null);

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

    const managerItems = useMemo(() => {
        return buildManagerItems(game?.gameConfig?.pages || []);
    }, [game]);

    const configuredBoardPages = useMemo(() => {
        return (game?.gameConfig?.pages || []).filter(
          (page) => page.type === "board" && page.isConfigured
        );
    }, [game]);

    function openManagerItem(item) {
        if (!game) return;

        if (item.itemType === "question-flow") {
            navigate(`/game/${game.id}/flow/${item.id}`);
            return;
        }

        if (item.itemType === "board") {
            navigate(`/game/${game.id}/board/${item.pages[0].id}`);
            return;
        }

        navigate(`/game/${game.id}/page/${item.pages[0].id}`);
    }

    async function removeManagerItem(item, event) {
        event.stopPropagation();
        if (!game) return;

        const isBoard = item.itemType === "board";
        const boardPageId = item.pages[0]?.id;

        const confirmedMessage = isBoard
          ? "Do you really want to remove the board? All corresponding question and answer pages will be removed as well."
          : item.itemType === "question-flow"
            ? "Do you really want to remove this question flow? All corresponding question and answer pages will be removed."
            : "Do you really want to remove this page?";

        const confirmed = window.confirm(confirmedMessage);
        if (!confirmed) return;

        const remainingPages = (game.gameConfig?.pages || []).filter((page) => {
            if (isBoard) {
                if (page.id === boardPageId) return false;
                if (page.boardLink?.boardPageId === boardPageId) return false;
                return true;
            }

            if (item.itemType === "question-flow") {
                return page.flowId !== item.id;
            }

            return page.id !== item.id;
        });

        const updatedGame = {
            ...game,
            gameConfig: {
                ...game.gameConfig,
                pages: remainingPages,
            },
            updatedAt: Date.now(),
        };

        await updateGame(updatedGame);
        setGame(updatedGame);
    }

    if (!game) return <p>Loading...</p>;

    return (
      <section className="manager-page">
          <div className="manager-page__header">
              <div>
                  <h1>{game.name}</h1>
              </div>

              <div className="manager-page__actions ">
                  <button className={"primary-btn"} onClick={() => navigate(`/game/${game.id}/setup`)}>
                      Edit players
                  </button>
                  <button
                    className="play-btn"
                    onClick={() => {
                        const firstBoard = configuredBoardPages[0];
                        if (!firstBoard) return;
                        navigate(`/play/${game.id}/board/${firstBoard.id}`);
                    }}
                    disabled={configuredBoardPages.length === 0}
                  >
                      Play game
                  </button>
              </div>
          </div>

          <div className="manager-grid">
              <div className="manager-card">
                  <h2>Game info</h2>
                  <p><strong>Name:</strong> {game.name}</p>
                  <p><strong>Currency:</strong> {game.currency || "Points"}</p>
                  <p><strong>Created on:</strong> {new Date(game.createdAt).toLocaleDateString()}</p>
                  <p><strong>Updated on:</strong> {new Date(game.updatedAt).toLocaleDateString()}</p>
              </div>

              <div className="manager-card">
                  <h2>Players</h2>
                  {game.gameConfig?.players?.length > 0 ? (
                    <ul>
                        {game.gameConfig.players.map((player, index) => (
                          <li key={typeof player === "string" ? `${player}-${index}` : player.id || index}>
                              {typeof player === "string"
                                ? player
                                : player.playerName || player.name || `Player ${index + 1}`}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p>No players configured yet.</p>
                  )}
              </div>

              <div className="manager-card manager-card--pages">
                  <h2>Game pages</h2>
                  <p>Total items: {managerItems.length}</p>

                  <button
                    className="primary-btn"
                    onClick={() => navigate(`/game/${game.id}/pages/new`)}
                  >
                      Add new page
                  </button>
              </div>
          </div>

          <div className="manager-pages-section">
              <h2>Pages in this game</h2>

              {managerItems.length > 0 ? (
                <div className="pages-grid">
                    {managerItems.map((item) => {
                        if (item.itemType === "board") {
                            return (
                              <div
                                key={item.id}
                                className="page-card"
                                onClick={() => openManagerItem(item)}
                              >
                                  <div className="page-card__top">
                                      <h3>{"The Board"}</h3>
                                      <button
                                        type="button"
                                        className="page-card__delete-btn"
                                        onClick={(e) => removeManagerItem(item, e)}
                                      >
                                          Remove
                                      </button>
                                  </div>
                                  <p>Board page with categories, question values and players' scores.</p>
                              </div>
                            );
                        }

                        if (item.itemType === "supergame") {
                            return (
                              <div
                                key={item.id}
                                className="page-card"
                                onClick={() => openManagerItem(item)}
                              >
                                  <div className="page-card__top">
                                      <h3>Supergame</h3>
                                      <button
                                        type="button"
                                        className="page-card__delete-btn"
                                        onClick={(e) => removeManagerItem(item, e)}
                                      >
                                          Remove
                                      </button>
                                  </div>
                                  <p>Special final or bonus round page.</p>
                              </div>
                            );
                        }

                        if (item.itemType === "question-flow") {
                            const questionStepsCount = item.pages.filter(
                              (page) => page.type === "question-step"
                            ).length;

                            const answerPagesCount = item.pages.filter(
                              (page) => page.type === "answer"
                            ).length;

                            const flowTitle = getFlowAutoTitle(item.pages, game.currency || "Points");

                            return (
                              <div
                                key={item.id}
                                className="page-card page-card--flow"
                                onClick={() => openManagerItem(item)}
                              >
                                  <div className="page-card__top">
                                      <h3>{flowTitle}</h3>
                                      <button
                                        type="button"
                                        className="page-card__delete-btn"
                                        onClick={(e) => removeManagerItem(item, e)}
                                      >
                                          Remove
                                      </button>
                                  </div>
                                  <p>
                                      {questionStepsCount} question page{questionStepsCount !== 1 ? "s" : ""}
                                      {" + "}
                                      {answerPagesCount} answer page{answerPagesCount !== 1 ? "s" : ""}
                                  </p>
                              </div>
                            );
                        }

                        return null;
                    })}
                </div>
              ) : (
                <p>No pages added yet.</p>
              )}
          </div>
      </section>
    );
}

export default GameManagerPage;