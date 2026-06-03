import { useState } from "react";
import { updateGame } from "../db.js";
import { useNavigate } from "react-router-dom";
import "../index.css";

function BingoPlayerPage({
                           game,
                           page,
                           players,
                           currency,
                           mode = "play",
                           onUpdateGame,
                           selectedPlayerId,
                           onSelectPlayer,
                           onRevealAll,
                           onAwardBingoBonus,
                           onAwardMostCellsBonus,
                           onResetGrid,
                         }) {
  const navigate = useNavigate();
  const size = Number(page?.bingoConfig?.size) || 4;
  const cells = page?.bingoConfig?.cells || [];
  const themeText = page?.bingoConfig?.themeText || "";
  const rewards = page?.bingoConfig?.rewards || {};

  const [previewRevealedCellIds, setPreviewRevealedCellIds] = useState({});
  const [bingoNoticeLine1, setBingoNoticeLine1] = useState("");
  const [bingoNoticeLine2, setBingoNoticeLine2] = useState("");
  const [hasGameEnded, setHasGameEnded] = useState(false);

  const isPreview = mode === "preview";

  function handleCellClick(cell) {
    if (!cell?.id) return;

    if (isPreview) {
      setPreviewRevealedCellIds((current) => ({
        ...current,
        [cell.id]: !current[cell.id],
      }));
      return;
    }

    handleLiveCellClick(cell);
  }

  function handleResetClick() {
    setBingoNoticeLine1("");
    setBingoNoticeLine2("");
    setHasGameEnded(false);
    onResetGrid?.();
  }

  async function handleLiveCellClick(cell) {
    if (!game || !page || !cell?.id || !selectedPlayerId || hasGameEnded) return;

    const rewards = page?.bingoConfig?.rewards || {};
    const cellPoints = Number(rewards.cellPoints) || 0;
    const bingoPoints = Number(rewards.bingoPoints) || 0;
    const mostCellsPoints = Number(rewards.mostCellsPoints) || 0;
    const size = Number(page?.bingoConfig?.size) || 4;

    const basePages = (game.gameConfig?.pages || []).map((entry) => {
      if (entry.id !== page.id) return entry;

      const existingCells = entry?.bingoConfig?.cells || [];
      const nextCells = existingCells.map((existingCell) => {
        if (existingCell.id !== cell.id) return existingCell;

        return {
          ...existingCell,
          isRevealed: true,
          claimedByPlayerId: selectedPlayerId,
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

    const updatedPage = basePages.find((entry) => entry.id === page.id);
    const updatedCells = updatedPage?.bingoConfig?.cells || [];
    const bingoHit = hasAnyBingoByRevealStatus(updatedCells, size);

    // If there is a bingo, figure out who has the most cells
    const mostCellsWinner = bingoHit ? getMostCellsWinner(updatedCells) : null;

    const nextPlayers = (game.gameConfig?.players || game.players || []).map((player, index) => {
      const normalizedId =
        typeof player === "string" ? `player-${index}` : player.id || `player-${index}`;

      const baseScore = typeof player === "string" ? 0 : Number(player.score || 0);

      let extra = 0;

      if (normalizedId === selectedPlayerId && bingoHit && bingoPoints > 0) {
        extra += bingoPoints;
      }

      if (
        mostCellsWinner &&
        mostCellsWinner.playerId === normalizedId &&
        mostCellsPoints > 0
      ) {
        extra += mostCellsPoints;
      }

      const nextScore = baseScore + cellPoints + extra;

      if (typeof player === "string") {
        return { id: normalizedId, name: player, score: nextScore };
      }

      return { ...player, id: normalizedId, score: nextScore };
    });

    const finalPages = basePages.map((entry) => {
      if (entry.id !== page.id) return entry;
      if (!bingoHit) return entry;

      return {
        ...entry,
        bingoConfig: {
          ...entry.bingoConfig,
          cells: updatedCells.map((existingCell) =>
            existingCell.isRevealed
              ? existingCell
              : {
                ...existingCell,
                isRevealed: true,
                claimedByPlayerId: existingCell.claimedByPlayerId || "",
              }
          ),
        },
      };
    });

    const updatedGame = {
      ...game,
      players: nextPlayers,
      gameConfig: {
        ...game.gameConfig,
        pages: finalPages,
        players: nextPlayers,
      },
      updatedAt: Date.now(),
    };

    try {
      await updateGame(updatedGame);
      onUpdateGame?.(updatedGame);

      if (bingoHit) {
        const closerName =
          nextPlayers.find((player) => player.id === selectedPlayerId)?.name ||
          "Player";

        const line1 = `${closerName} got Bingo! +${bingoPoints}${currency}`;

        let line2 = "";
        if (mostCellsWinner) {
          const mostCellsPlayer =
            nextPlayers.find((p) => p.id === mostCellsWinner.playerId) || null;
          const mostName = mostCellsPlayer?.name || "Player";
          line2 = `${mostName} got the most revealed cells! +${mostCellsPoints}${currency}`;
        }

        setBingoNoticeLine1(line1);
        setBingoNoticeLine2(line2);
        setHasGameEnded(true);
      }
    } catch (error) {
      console.error("Failed to update Bingo cell:", error);
    }
  }

  function hasPlayerBingo(cells, size, playerId) {
    if (!playerId) return false;

    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => false)
    );

    // Mark positions claimed by this player
    cells.forEach((cell, index) => {
      const row = Math.floor(index / size);
      const col = index % size;

      if (cell && cell.claimedByPlayerId === playerId) {
        grid[row][col] = true;
      }
    });

    // Check rows
    for (let r = 0; r < size; r++) {
      let all = true;
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) {
          all = false;
          break;
        }
      }
      if (all) return true;
    }

    // Check columns
    for (let c = 0; c < size; c++) {
      let all = true;
      for (let r = 0; r < size; r++) {
        if (!grid[r][c]) {
          all = false;
          break;
        }
      }
      if (all) return true;
    }

    // Main diagonal
    {
      let all = true;
      for (let i = 0; i < size; i++) {
        if (!grid[i][i]) {
          all = false;
          break;
        }
      }
      if (all) return true;
    }

    // Anti-diagonal
    {
      let all = true;
      for (let i = 0; i < size; i++) {
        if (!grid[i][size - 1 - i]) {
          all = false;
          break;
        }
      }
      if (all) return true;
    }

    return false;
  }

  function hasAnyBingoByRevealStatus(cells, size) {
    const revealed = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => false)
    );

    cells.forEach((cell, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      if (cell?.isRevealed) {
        revealed[row][col] = true;
      }
    });

    // Rows
    for (let row = 0; row < size; row += 1) {
      if (revealed[row].every(Boolean)) return true;
    }

    // Columns
    for (let col = 0; col < size; col += 1) {
      let all = true;
      for (let row = 0; row < size; row += 1) {
        if (!revealed[row][col]) {
          all = false;
          break;
        }
      }
      if (all) return true;
    }

    // Main diagonal
    let mainDiagonal = true;
    for (let i = 0; i < size; i += 1) {
      if (!revealed[i][i]) {
        mainDiagonal = false;
        break;
      }
    }
    if (mainDiagonal) return true;

    // Anti-diagonal
    let antiDiagonal = true;
    for (let i = 0; i < size; i += 1) {
      if (!revealed[i][size - 1 - i]) {
        antiDiagonal = false;
        break;
      }
    }
    return antiDiagonal;
  }

  function getMostCellsWinner(cells) {
    const counts = new Map();

    cells.forEach((cell) => {
      if (!cell?.isRevealed) return;

      const ownerId = cell.claimedByPlayerId || null;
      if (!ownerId) return;

      counts.set(ownerId, (counts.get(ownerId) || 0) + 1);
    });

    let bestId = null;
    let bestCount = 0;
    let isTie = false;

    for (const [playerId, count] of counts.entries()) {
      if (count > bestCount) {
        bestId = playerId;
        bestCount = count;
        isTie = false;
      } else if (count === bestCount && bestCount > 0) {
        isTie = true;
      }
    }

    if (!bestId || bestCount <= 0 || isTie) {
      return null;
    }

    return { playerId: bestId, count: bestCount };
  }

  return (
    <section
      className="board-editor-page game-bingo-player-page"
      style={
        page?.bingoConfig?.background
          ? {
            backgroundImage: `linear-gradient(rgba(8, 15, 30, 0.34), rgba(8, 15, 30, 0.34)), url(${page.bingoConfig.background})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
          : undefined
      }
    >
      <div className="board-editor-overlay">
        <div className="board-editor-header">
          <div>
            <h1>{page?.name || "Bingo"}</h1>

            {(rewards.cellPoints || rewards.bingoPoints || rewards.mostCellsPoints) ? (
              <p className="bingo-player-rewards-inline">
                Cell: {rewards.cellPoints ?? 0} {currency} · Bingo: {rewards.bingoPoints ?? 0} {currency} · Most cells: {rewards.mostCellsPoints ?? 0} {currency}
              </p>
            ) : null}
          </div>
        </div>

        <div className="board-main-column">
          {themeText ? (
            <div className="manager-card bingo-player-theme-card">
              <p>{themeText}</p>
            </div>
          ) : null}

          <div
            className="board-grid bingo-player-grid"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: size * size }, (_, index) => {
              const cell = cells[index] || null;

              if (!cell) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="bingo-player-cell bingo-player-cell--disabled"
                    aria-hidden="true"
                  />
                );
              }

              const claimedByPlayer = players?.find(
                (player) => player.id === cell.claimedByPlayerId
              );

              const isRevealed = isPreview
                ? Boolean(previewRevealedCellIds[cell.id])
                : Boolean(cell.isRevealed);

              const isClaimed = Boolean(cell.claimedByPlayerId);
              const canInteract = isPreview || (!isClaimed && !isRevealed && Boolean(selectedPlayerId));

              const mainText = isRevealed
                ? cell.openText || cell.text || ""
                : String(index + 1);

              const subText = isRevealed
                ? claimedByPlayer
                  ? claimedByPlayer.name
                  : cell.reward
                    ? String(cell.reward)
                    : ""
                : "";

              return (
                <button
                  key={cell.id}
                  type="button"
                  className={[
                    "bingo-player-cell",
                    canInteract ? "bingo-player-cell--interactive" : "",
                    isRevealed ? "bingo-player-cell--revealed" : "",
                    isClaimed ? "bingo-player-cell--claimed" : "",
                    !canInteract ? "bingo-player-cell--disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleCellClick(cell)}
                  disabled={!canInteract}
                >
                  <span className="board-cell__main">{mainText}</span>
                  {subText ? (
                    <span className="board-cell__sub">{subText}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {!isPreview && players?.length > 0 ? (
          <div className="bingo-host-bar">
            <div className="bingo-host-bar__row">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={
                    player.id === selectedPlayerId
                      ? "bingo-host-player bingo-host-player--active"
                      : "bingo-host-player"
                  }
                  onClick={() => onSelectPlayer?.(player.id)}
                >
                  <span className="bingo-host-player__name">{player.name}</span>
                </button>
              ))}

              <div className="bingo-host-bar__divider" aria-hidden="true" />

              <button type="button" className="secondary-btn" onClick={onAwardBingoBonus}>
                Award Bingo
              </button>

              <button type="button" className="secondary-btn" onClick={onAwardMostCellsBonus}>
                Award most cells
              </button>

              <button type="button" className="secondary-btn" onClick={onRevealAll}>
                Reveal all
              </button>

              <button type="button" className="secondary-btn" onClick={handleResetClick}>
                Reset grid
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate(`/game/${game.id}/winner`)}
              >
                Show winner
              </button>
            </div>
          </div>
        ) : null}

        {bingoNoticeLine1 || bingoNoticeLine2 ? (
          <div
            className="bingo-player-theme-card manager-card"
            style={{ marginTop: "16px" }}
          >
            {bingoNoticeLine1 && <p>{bingoNoticeLine1}</p>}
            {bingoNoticeLine2 && <p>{bingoNoticeLine2}</p>}
          </div>
        ) : null}

        {players?.length > 0 && (
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

export default BingoPlayerPage;