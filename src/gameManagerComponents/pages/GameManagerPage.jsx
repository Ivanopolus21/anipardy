import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById } from "../../db.js";
import '../../index.css'

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

    function openManagerItem(item) {
        if (!game) return;

        if (item.itemType === "question-flow") {
            navigate(`/game/${game.id}/flow/${item.id}`);
            return;
        }

        const page = item.pages[0];

        if (item.itemType === "board") {
            if (!page.isConfigured) {
                navigate(`/game/${game.id}/board/${page.id}/setup`);
                return;
            }

            navigate(`/game/${game.id}/board/${page.id}`);
            return;
        }

        navigate(`/game/${game.id}/page/${page.id}`);
    }

    if (!game) return <p>Loading...</p>;

    return (
      <section className="manager-page">
          <div className="manager-page__header">
              <div>
                  <h1>{game.name}</h1>
                  <p>Manage and build your game here</p>
              </div>

              <div className="manager-page__actions">
                  <button onClick={() => navigate(`/game/${game.id}/setup`)}>
                      Edit players
                  </button>
                  <button onClick={() => navigate(`/play/${game.id}`)}>
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
                          <li key={player.id || index}>
                              {typeof player === "string" ? player : player.playerName || "Unnamed player"}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p>No players configured yet.</p>
                  )}
              </div>

              <div className="manager-card">
                  <h2>Game pages</h2>
                  <p>Total items: {managerItems.length}</p>

                  <button
                    className="primary-btn"
                    onClick={() => navigate(`/game/${game.id}/pages/new`)}>
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
                                  <h3>{item.pages[0].name || "The Board"}</h3>
                                  <p>
                                      {item.pages[0].isConfigured
                                        ? "Board page with categories and question values."
                                        : "Board is not configured yet."}
                                  </p>
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
                                  <h3>{item.pages[0].name || "Supergame"}</h3>
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

                            return (
                              <div
                                key={item.id}
                                className="page-card page-card--flow"
                                onClick={() => openManagerItem(item)}
                              >
                                  <h3>{item.pages[0].flowName || "Question flow"}</h3>
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