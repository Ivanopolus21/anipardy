import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById } from "../db.js";
import "../index.css";

function WinnerPage() {
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

  function getNormalizedPlayers(game) {
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
        ...player,
        id: player.id || `player-${index}`,
        name:
          player.playerName ||
          player.name ||
          player.title ||
          `Player ${index + 1}`,
        score: Number(player.score || 0),
      };
    });
  }

  const players = useMemo(() => {
    return getNormalizedPlayers(game).sort((a, b) => b.score - a.score);
  }, [game]);

  const topScore = players.length > 0 ? players[0].score : 0;

  const winners = useMemo(() => {
    return players.filter((player) => player.score === topScore);
  }, [players, topScore]);

  const boardPages = useMemo(() => {
    return (game?.gameConfig?.pages || []).filter(
      (page) => page.type === "board" && page.isConfigured
    );
  }, [game]);

  const firstBoard = boardPages[0] || null;
  const currency = game?.currency || "Points";

  if (!game) {
    return <p>Loading...</p>;
  }

  return (
    <section className="winner-page">
      <div className="winner-page__shell">
        <div className="winner-page__hero">
          <p className="winner-page__eyebrow">
            {game.name || "Game results"}
          </p>

          <h1 className="winner-page__title">
            {winners.length === 0
              ? "No winner yet"
              : winners.length === 1
                ? `${winners[0].name} wins!`
                : "It’s a tie!"}
          </h1>

          <p className="winner-page__subtitle">
            {winners.length === 0
              ? "No players have been scored yet."
              : winners.length === 1
                ? `${winners[0].name} finished in 1st place with ${topScore} ${currency}.`
                : `${winners.map((player) => player.name).join(", ")} share 1st place with ${topScore} ${currency}.`}
          </p>

          <div className="winner-page__actions">
            <button
              className="primary-btn"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to manager
            </button>

            {firstBoard ? (
              <button
                className="secondary-btn"
                onClick={() => navigate(`/play/${id}/board/${firstBoard.id}`)}
              >
                Back to board
              </button>
            ) : null}
          </div>
        </div>

        <div className="winner-page__content">
          {players.length > 0 ? (
            <div className="winner-page__leaderboard">
              {players.map((player, index) => {
                const isWinner = player.score === topScore;

                return (
                  <article
                    key={player.id}
                    className={`winner-card ${
                      isWinner ? "winner-card--top" : ""
                    }`}
                  >
                    <div className="winner-card__rank">
                      #{index + 1}
                    </div>

                    <div className="winner-card__main">
                      <h2>{player.name}</h2>
                      <p>
                        {isWinner
                          ? "Top score"
                          : `${topScore - player.score} ${currency} behind`}
                      </p>
                    </div>

                    <div className="winner-card__score">
                      {player.score} {currency}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="winner-page__empty">
              No players found for this game.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default WinnerPage;