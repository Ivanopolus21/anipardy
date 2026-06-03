import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import "../../index.css";

function buildEmptyCell(index) {
  return {
    id: crypto.randomUUID(),
    text: "",
    openText: "",
    isRevealed: false,
    claimedByPlayerId: "",
    order: index,
  };
}

function BingoEditorPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [selectedCellIndex, setSelectedCellIndex] = useState(null);
  const [cellTextInput, setCellTextInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      const bingoPage = (savedGame.gameConfig?.pages || []).find(
        (page) =>
          page.id === pageId &&
          page.type === "supergame" &&
          page.supergameType === "bingo"
      );

      if (!bingoPage) {
        navigate(`/game/${id}`);
        return;
      }

      if (!bingoPage.isConfigured) {
        navigate(`/game/${id}/supergame/${pageId}/setup`);
        return;
      }

      setGame(savedGame);
    }

    loadGame();
  }, [id, pageId, navigate]);

  const bingoPage = useMemo(() => {
    return (
      (game?.gameConfig?.pages || []).find(
        (page) =>
          page.id === pageId &&
          page.type === "supergame" &&
          page.supergameType === "bingo"
      ) || null
    );
  }, [game, pageId]);

  const bingoConfig = bingoPage?.bingoConfig || {};
  const size = Number(bingoConfig.size) || 4;
  const totalCells = size * size;

  const cells = useMemo(() => {
    return Array.from({ length: totalCells }, (_, index) => {
      return bingoConfig.cells?.[index] || buildEmptyCell(index);
    });
  }, [bingoConfig.cells, totalCells]);

  const selectedCell =
    selectedCellIndex !== null ? cells[selectedCellIndex] || null : null;

  useEffect(() => {
    if (!selectedCell) {
      setCellTextInput("");
      return;
    }

    setCellTextInput(selectedCell.openText || selectedCell.text || "");
  }, [selectedCell]);

  function openCellEditor(index) {
    setSelectedCellIndex(index);
  }

  function closeCellEditor() {
    setSelectedCellIndex(null);
    setCellTextInput("");
    setIsSaving(false);
  }

  async function saveSelectedCellDraft() {
    if (!game || !bingoPage || selectedCellIndex === null || isSaving) {
      return false;
    }

    setIsSaving(true);

    try {
      const nextCells = Array.from({ length: totalCells }, (_, index) => {
        const existingCell = bingoConfig.cells?.[index] || buildEmptyCell(index);

        if (index !== selectedCellIndex) {
          return existingCell;
        }

        return {
          ...existingCell,
          text: cellTextInput.trim(),
          openText: cellTextInput.trim(),
        };
      });

      const updatedPages = (game.gameConfig?.pages || []).map((page) => {
        if (page.id !== bingoPage.id) return page;

        return {
          ...page,
          bingoConfig: {
            ...page.bingoConfig,
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
      return true;
    } catch (error) {
      console.error("Failed to save Bingo cell:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSelectedCell(e) {
    e.preventDefault();
    await saveSelectedCellDraft();
  }

  async function handlePreviewGameView() {
    if (!game || !bingoPage || isSaving) return;

    if (selectedCellIndex !== null) {
      const didSave = await saveSelectedCellDraft();

      if (!didSave) return;
    }

    navigate(`/play/${id}/supergame/${pageId}`, {
      state: {
        fromEditor: true,
        returnTo: `/game/${id}/supergame/${pageId}`,
      },
    });
  }

  if (!game || !bingoPage) return <p>Loading...</p>;

  const themeText = bingoConfig.themeText || "";
  const rewards = bingoConfig.rewards || {};
  const filledCount = cells.filter(
    (cell) => (cell.openText || cell.text || "").trim()
  ).length;

  return (
    <section
      className="board-editor-page"
      style={
        bingoConfig.background
          ? { backgroundImage: `url(${bingoConfig.background})` }
          : undefined
      }
    >
      <div className="board-editor-overlay">
        <div className="board-editor-header">
          <div>
            <h1>{game.name}</h1>
            <p>
              {bingoPage.name ? `Editing Bingo: ${bingoPage.name}. ` : ""}
              Click a cell to define the text that players will see after that cell is revealed.
            </p>
          </div>

          <div className="board-editor-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to game manager
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={handlePreviewGameView}
              disabled={isSaving}
            >
              Preview game view
            </button>
          </div>
        </div>

        <div
          className={`board-editor-layout ${
            selectedCell ? "board-editor-layout--with-panel" : ""
          }`}
        >
          <div className="board-main-column">
            {themeText ? (
              <div className="manager-card" style={{ marginBottom: "20px" }}>
                <h3>Theme shown to players</h3>
                <p>{themeText}</p>
              </div>
            ) : null}

            <div
              className="board-grid"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {cells.map((cell, index) => {
                const revealedText = (cell.openText || cell.text || "").trim();
                const hasRevealText = Boolean(revealedText);
                const cellStatus = hasRevealText ? "linked" : "unconfigured";

                return (
                  <button
                    key={cell.id || index}
                    type="button"
                    className={`board-cell board-cell--${cellStatus}`}
                    onClick={() => openCellEditor(index)}
                  >
                    <span className="board-cell__main">
                      {hasRevealText ? revealedText : String(index + 1)}
                    </span>

                                  <span className="board-cell__sub">
                      {hasRevealText ? "Revealed text set" : "Revealed text missing"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCell && (
            <aside className="board-side-panel">
              <div className="board-side-panel__header">
                <div>
                  <h2>Edit cell</h2>
                  <p>
                    Cell {selectedCellIndex + 1} of {totalCells}
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

              <form className="board-side-panel__form" onSubmit={saveSelectedCell}>
                <label className="board-setup-field">
                  <span>Revealed text</span>
                  <textarea
                    value={cellTextInput}
                    placeholder={`What should players see when Cell ${selectedCellIndex + 1} is revealed?`}
                    onChange={(e) => setCellTextInput(e.target.value)}
                  />
                </label>

                <div className="board-side-panel__info">
                  <p>
                    Closed cells always show their cell number. This text is shown after the cell is revealed.
                  </p>
                </div>

                <div className="board-side-panel__info">
                  <p>
                    Filled cells: {filledCount} / {totalCells}
                  </p>
                </div>

                <div className="board-side-panel__info">
                  <p>Points per cell: {rewards.cellPoints ?? 0}</p>
                  <p>Bingo bonus: {rewards.bingoPoints ?? 0}</p>
                  <p>Most cells bonus: {rewards.mostCellsPoints ?? 0}</p>
                </div>

                <div className="board-side-panel__actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={closeCellEditor}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

export default BingoEditorPage;