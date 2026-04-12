import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getGameById, getMediaById, updateGame } from "../db.js";
import FlowPageRenderer from "../FlowPageRenderer.jsx";
import "../index.css";

function normalizePlayers(game) {
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
}

function SupergamePlayerPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [game, setGame] = useState(null);
  const [mediaPreviewMap, setMediaPreviewMap] = useState({});
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [scoreAmount, setScoreAmount] = useState("");
  const [shouldSubtract, setShouldSubtract] = useState(false);
  const [isApplyingScore, setIsApplyingScore] = useState(false);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      const supergamePage = (savedGame.gameConfig?.pages || []).find(
        (page) => page.id === pageId && page.type === "supergame"
      );

      if (!supergamePage) {
        navigate(`/game/${id}`);
        return;
      }

      setGame(savedGame);
    }

    loadGame();
  }, [id, pageId, navigate]);

  const page = useMemo(() => {
    return (
      (game?.gameConfig?.pages || []).find(
        (entry) => entry.id === pageId && entry.type === "supergame"
      ) || null
    );
  }, [game, pageId]);

  const players = useMemo(() => {
    return normalizePlayers(game);
  }, [game]);

  const currency = game?.currency || "Points";

  const pageTitle =
    page?.titleMode === "custom" && page?.customTitle?.trim()
      ? page.customTitle.trim()
      : page?.name || "Supergame";

  useEffect(() => {
    if (!selectedPlayerId && players.length > 0) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls = [];

    async function loadMediaPreviews() {
      if (!page?.mediaItems?.length) {
        setMediaPreviewMap({});
        return;
      }

      const nextPreviews = {};

      for (const item of page.mediaItems) {
        if (!item?.mediaId) continue;

        const mediaRecord = await getMediaById(item.mediaId);
        if (!mediaRecord?.blob) continue;

        const previewUrl = URL.createObjectURL(mediaRecord.blob);
        objectUrls.push(previewUrl);
        nextPreviews[item.id] = previewUrl;
      }

      if (!isCancelled) {
        setMediaPreviewMap(nextPreviews);
      }
    }

    loadMediaPreviews();

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [page]);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl = "";

    async function loadBackgroundPreview() {
      if (!page?.useCustomBackground || !page?.backgroundMediaId) {
        setBackgroundPreviewUrl("");
        return;
      }

      const mediaRecord = await getMediaById(page.backgroundMediaId);
      if (!mediaRecord?.blob) {
        setBackgroundPreviewUrl("");
        return;
      }

      objectUrl = URL.createObjectURL(mediaRecord.blob);

      if (!isCancelled) {
        setBackgroundPreviewUrl(objectUrl);
      }
    }

    loadBackgroundPreview();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [page]);

  async function applyScoreToPlayer(playerId) {
    if (!game || !playerId || isApplyingScore) return;

    const numericAmount = Number(scoreAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;

    setIsApplyingScore(true);

    const nextPlayers = normalizePlayers(game).map((player) => {
      if (player.id !== playerId) return player;

      return {
        ...player,
        score: player.score + (shouldSubtract ? -numericAmount : numericAmount),
      };
    });

    const updatedGame = {
      ...game,
      players: nextPlayers,
      gameConfig: {
        ...game.gameConfig,
        players: nextPlayers,
      },
      updatedAt: Date.now(),
    };

    try {
      await updateGame(updatedGame);
      setGame(updatedGame);
      setSelectedPlayerId(playerId);
    } finally {
      setIsApplyingScore(false);
    }
  }

  if (!game || !page) {
    return <p>Loading...</p>;
  }

  const returnTo =
    location.state?.returnTo ||
    (location.state?.fromEditor ? `/game/${id}/supergame/${pageId}` : `/game/${id}`);

  return (
    <section className="game-flow-player-page">
      <div className="game-flow-player-toolbar">
        <div className="game-flow-player-toolbar__left">
          <button
            type="button"
            className="game-flow-player-btn"
            onClick={() => navigate(returnTo)}
          >
            Back
          </button>
        </div>
      </div>

      <div className="game-flow-player-stage">
        <FlowPageRenderer
          page={{
            ...page,
            type: "supergame",
          }}
          pageTitle={pageTitle}
          mediaPreviewMap={mediaPreviewMap}
          backgroundPreviewUrl={backgroundPreviewUrl}
          mode="gameplay"
        />
      </div>

      {players.length > 0 && (
        <div className="game-flow-player-scoring-dock">
          <div className="game-flow-player-scoring-simple">
            <div className="game-flow-player-amount-row">
              <span className="game-flow-player-amount-label">
                Amount ({currency})
              </span>

              <input
                type="number"
                min="1"
                step="1"
                className="game-flow-player-amount-input"
                value={scoreAmount}
                onChange={(e) => setScoreAmount(e.target.value)}
                placeholder="Enter points"
              />

              <label className="game-flow-player-subtract-toggle">
                <input
                  type="checkbox"
                  checked={shouldSubtract}
                  onChange={(e) => setShouldSubtract(e.target.checked)}
                />
                Subtract
              </label>
            </div>

            <div className="game-flow-player-player-buttons">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={`game-flow-player-player-btn ${
                    player.id === selectedPlayerId
                      ? "game-flow-player-player-btn--active"
                      : ""
                  }`}
                  onClick={() => applyScoreToPlayer(player.id)}
                  disabled={
                    isApplyingScore ||
                    !Number.isFinite(Number(scoreAmount)) ||
                    Number(scoreAmount) <= 0
                  }
                >
                  <span>{player.name}</span>
                  <span className="game-flow-player-player-score">
        {player.score}
      </span>
                </button>
              ))}
            </div>
            <button
              className="secondary-btn"
              onClick={() => navigate(`/game/${id}/winner`)}
            >
              Show winner
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default SupergamePlayerPage;