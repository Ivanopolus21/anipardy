import { useState } from "react";
import { updateGame } from "../db.js";
import "../index.css";

function BingoPlayerPage({
                           game,
                           page,
                           players,
                           currency,
                           mode = "play",
                           onUpdateGame,
                         }) {
  const size = Number(page?.bingoConfig?.size) || 4;
  const cells = page?.bingoConfig?.cells || [];
  const themeText = page?.bingoConfig?.themeText || "";
  const rewards = page?.bingoConfig?.rewards || {};

  const [previewRevealedCellIds, setPreviewRevealedCellIds] = useState({});

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

  async function handleLiveCellClick(cell) {
    if (!game || !page || !cell?.id) return;

    const updatedPages = (game.gameConfig?.pages || []).map((entry) => {
      if (entry.id !== page.id) return entry;

      const existingCells = entry?.bingoConfig?.cells || [];
      const nextCells = existingCells.map((existingCell) => {
        if (existingCell.id !== cell.id) return existingCell;

        return {
          ...existingCell,
          isRevealed: true,
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
      onUpdateGame?.(updatedGame);
    } catch (error) {
      console.error("Failed to update Bingo cell:", error);
    }
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
              const canInteract = isPreview || (!isClaimed && !isRevealed);

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