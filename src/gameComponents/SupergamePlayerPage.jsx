import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../db.js";
import BingoPlayerPage from "./BingoPlayerPage.jsx";
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
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [scoreAmount, setScoreAmount] = useState("");
  const [shouldSubtract, setShouldSubtract] = useState(false);
  const [isApplyingScore, setIsApplyingScore] = useState(false);
  const [selectedBingoPlayerId, setSelectedBingoPlayerId] = useState("");
  const isPreviewMode = Boolean(location.state?.fromEditor);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      const supergamePage = (savedGame.gameConfig?.pages || []).find(
        (entry) => entry.id === pageId && entry.type === "supergame"
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

  const supergameType = page?.supergameType || "default";

  const players = useMemo(() => {
    return normalizePlayers(game);
  }, [game]);

  useEffect(() => {
    if (supergameType !== "bingo") return;

    if (!selectedBingoPlayerId && players.length > 0) {
      setSelectedBingoPlayerId(players[0].id);
    }
  }, [players, selectedBingoPlayerId, supergameType]);

  const currency = game?.currency || "Points";
  const usesIntegratedScoreLayout = supergameType === "bingo";
  const returnTo =
    location.state?.returnTo ||
    (location.state?.fromEditor
      ? `/game/${id}/supergame/${pageId}`
      : `/game/${id}`);

  useEffect(() => {
    if (!selectedPlayerId && players.length > 0) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId]);

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

  async function handleRevealAllBingoCells() {
    if (!game || !page || supergameType !== "bingo") return;

    const updatedPages = (game.gameConfig?.pages || []).map((entry) => {
      if (entry.id !== page.id) return entry;

      const existingCells = entry?.bingoConfig?.cells || [];
      const nextCells = existingCells.map((cell) => {
        if (cell.isRevealed) return cell;

        return {
          ...cell,
          isRevealed: true,
          claimedByPlayerId: cell.claimedByPlayerId || "",
        };
      });

      return {
        ...entry,
        bingoConfig: {
          ...entry.bingoConfig,
          cells: nextCells,
        },
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

    try {
      await updateGame(updatedGame);
      setGame(updatedGame);
    } catch (error) {
      console.error("Failed to reveal all Bingo cells:", error);
    }
  }

  async function handleAwardBingoBonus() {
    if (!game || !selectedBingoPlayerId || supergameType !== "bingo") return;

    const bingoPoints = Number(page?.bingoConfig?.rewards?.bingoPoints) || 0;
    if (!bingoPoints) return;

    const nextPlayers = (game.gameConfig?.players || game.players || []).map((player, index) => {
      const normalizedId =
        typeof player === "string" ? `player-${index}` : player.id || `player-${index}`;

      if (normalizedId !== selectedBingoPlayerId) {
        return typeof player === "string"
          ? { id: normalizedId, name: player, score: 0 }
          : { ...player, score: Number(player.score || 0) };
      }

      return typeof player === "string"
        ? { id: normalizedId, name: player, score: bingoPoints }
        : { ...player, score: Number(player.score || 0) + bingoPoints };
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

    await updateGame(updatedGame);
    setGame(updatedGame);
  }

  async function handleAwardMostCellsBonus() {
    if (!game || !selectedBingoPlayerId || supergameType !== "bingo") return;

    const mostCellsPoints = Number(page?.bingoConfig?.rewards?.mostCellsPoints) || 0;
    if (!mostCellsPoints) return;

    const nextPlayers = (game.gameConfig?.players || game.players || []).map((player, index) => {
      const normalizedId =
        typeof player === "string" ? `player-${index}` : player.id || `player-${index}`;

      if (normalizedId !== selectedBingoPlayerId) {
        return typeof player === "string"
          ? { id: normalizedId, name: player, score: 0 }
          : { ...player, score: Number(player.score || 0) };
      }

      return typeof player === "string"
        ? { id: normalizedId, name: player, score: mostCellsPoints }
        : { ...player, score: Number(player.score || 0) + mostCellsPoints };
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

    await updateGame(updatedGame);
    setGame(updatedGame);
  }

  async function handleResetBingoGrid() {
    if (!game || !page || supergameType !== "bingo") return;

    const updatedPages = (game.gameConfig?.pages || []).map((entry) => {
      if (entry.id !== page.id) return entry;

      const existingCells = entry?.bingoConfig?.cells || [];
      const nextCells = existingCells.map((cell) => ({
        ...cell,
        isRevealed: false,
        claimedByPlayerId: "",
      }));

      return {
        ...entry,
        bingoConfig: {
          ...entry.bingoConfig,
          cells: nextCells,
        },
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

  if (!game || !page) {
    return <p>Loading...</p>;
  }

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
        {supergameType === "bingo" ? (
          <BingoPlayerPage
            game={game}
            page={page}
            players={players}
            currency={currency}
            mode={isPreviewMode ? "preview" : "play"}
            onUpdateGame={setGame}
            selectedPlayerId={selectedBingoPlayerId}
            onSelectPlayer={setSelectedBingoPlayerId}
            onRevealAll={handleRevealAllBingoCells}
            onAwardBingoBonus={handleAwardBingoBonus}
            onAwardMostCellsBonus={handleAwardMostCellsBonus}
            onResetGrid={handleResetBingoGrid}
          />
        ) : (
          <div className="supergame-player-fallback">
            <h1>{page.name || "Supergame"}</h1>
            <p>This supergame type is not supported yet.</p>
          </div>
        )}
      </div>

      {players.length > 0 && !usesIntegratedScoreLayout && (
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
              type="button"
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