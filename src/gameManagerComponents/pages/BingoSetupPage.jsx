import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import "../../index.css";

const MIN_SIZE = 4;
const MAX_SIZE = 8;

function clampCount(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function buildEmptyCells(count, previous = []) {
  return Array.from({ length: count }, (_, index) => ({
    id: previous[index]?.id || crypto.randomUUID(),
    text: previous[index]?.text || "",
    isRevealed: previous[index]?.isRevealed || false,
    claimedByPlayerId: previous[index]?.claimedByPlayerId || "",
  }));
}

function BingoSetupPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [sizeInput, setSizeInput] = useState("4");
  const [sizeCommitted, setSizeCommitted] = useState(4);
  const [themeText, setThemeText] = useState("");
  const [cellPointsInput, setCellPointsInput] = useState("100");
  const [bingoPointsInput, setBingoPointsInput] = useState("500");
  const [mostCellsPointsInput, setMostCellsPointsInput] = useState("300");
  const [cells, setCells] = useState(buildEmptyCells(16));
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      setGame(savedGame);

      const bingoPage = (savedGame.gameConfig?.pages || []).find((page) => page.id === pageId);

      if (!bingoPage) {
        navigate(`/game/${id}`);
        return;
      }

      if (bingoPage.isConfigured) {
        navigate(`/game/${id}/supergame/${pageId}`);
        return;
      }

      const bingoConfig = bingoPage.bingoConfig || {};
      const savedSize = clampCount(bingoConfig.size ?? 4, MIN_SIZE, MAX_SIZE, 4);

      setSizeInput(String(savedSize));
      setSizeCommitted(savedSize);
      setThemeText(bingoConfig.themeText || "");
      setCellPointsInput(String(bingoConfig.rewards?.cellPoints ?? 100));
      setBingoPointsInput(String(bingoConfig.rewards?.bingoPoints ?? 500));
      setMostCellsPointsInput(String(bingoConfig.rewards?.mostCellsPoints ?? 300));
      setCells(buildEmptyCells(savedSize * savedSize, bingoConfig.cells || []));
    }

    loadGame();
  }, [id, pageId, navigate]);

  useEffect(() => {
    setCells((prev) => buildEmptyCells(sizeCommitted * sizeCommitted, prev));
  }, [sizeCommitted]);

  useEffect(() => {
    return () => {
      if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    };
  }, [backgroundPreview]);

  const bingoPage = useMemo(() => {
    return (game?.gameConfig?.pages || []).find((page) => page.id === pageId);
  }, [game, pageId]);

  function normalizeSize() {
    const normalized = clampCount(sizeInput, MIN_SIZE, MAX_SIZE, 4);
    setSizeInput(String(normalized));
    setSizeCommitted(normalized);
  }

  function handleSizeChange(value) {
    if (value === "") {
      setSizeInput("");
      return;
    }
    if (/^\d+$/.test(value)) {
      setSizeInput(value);
    }
  }

  function updateCellText(index, value) {
    setCells((prev) =>
      prev.map((cell, i) => (i === index ? { ...cell, text: value } : cell))
    );
  }

  function handleBackgroundChange(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);

    const previewUrl = URL.createObjectURL(file);
    setBackgroundFile(file);
    setBackgroundPreview(previewUrl);
  }

  function onFileInputChange(e) {
    handleBackgroundChange(e.target.files?.[0]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!game || !bingoPage || isSaving) return;

    const finalSize = clampCount(sizeInput, MIN_SIZE, MAX_SIZE, sizeCommitted);
    const finalCellPoints = Number(cellPointsInput) || 0;
    const finalBingoPoints = Number(bingoPointsInput) || 0;
    const finalMostCellsPoints = Number(mostCellsPointsInput) || 0;

    setIsSaving(true);

    let backgroundData = null;
    if (backgroundFile) {
      backgroundData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(backgroundFile);
      });
    }

    const cleanedCells = cells
      .slice(0, finalSize * finalSize)
      .map((cell) => ({
        id: cell.id || crypto.randomUUID(),
        text: cell.text.trim(),
        isRevealed: Boolean(cell.isRevealed),
        claimedByPlayerId: cell.claimedByPlayerId || "",
      }));

    const updatedPages = (game.gameConfig?.pages || []).map((page) => {
      if (page.id !== bingoPage.id) return page;

      return {
        ...page,
        isConfigured: true,
        bingoConfig: {
          size: finalSize,
          themeText: themeText.trim(),
          rewards: {
            cellPoints: finalCellPoints,
            bingoPoints: finalBingoPoints,
            mostCellsPoints: finalMostCellsPoints,
          },
          cells: cleanedCells,
          background: backgroundData,
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
    navigate(`/game/${id}/supergame/${pageId}`);
  }

  if (!game || !bingoPage) return <p>Loading...</p>;

  const cellCount = sizeCommitted * sizeCommitted;

  return (
    <section className="board-setup-page">
      <form className="board-setup-card" onSubmit={handleSubmit}>
        <h1>{bingoPage.name || "Bingo setup"}</h1>
        <p>Configure the bingo theme, board size, reward values, and cell text before play.</p>

        <div className="board-setup-grid">
          <label className="board-setup-field">
            <span>Board size (4-8)</span>
            <input
              type="text"
              inputMode="numeric"
              value={sizeInput}
              onChange={(e) => handleSizeChange(e.target.value)}
              onBlur={normalizeSize}
            />
          </label>

          <label className="board-setup-field">
            <span>Bingo theme</span>
            <input
              type="text"
              value={themeText}
              onChange={(e) => setThemeText(e.target.value)}
              placeholder="Example: Anime openings"
            />
          </label>

          <label className="board-setup-field">
            <span>Points per cell</span>
            <input
              type="text"
              inputMode="numeric"
              value={cellPointsInput}
              onChange={(e) => setCellPointsInput(e.target.value)}
            />
          </label>

          <label className="board-setup-field">
            <span>Bingo bonus points</span>
            <input
              type="text"
              inputMode="numeric"
              value={bingoPointsInput}
              onChange={(e) => setBingoPointsInput(e.target.value)}
            />
          </label>

          <label className="board-setup-field">
            <span>Most cells bonus points</span>
            <input
              type="text"
              inputMode="numeric"
              value={mostCellsPointsInput}
              onChange={(e) => setMostCellsPointsInput(e.target.value)}
            />
          </label>
        </div>

        <div className="board-setup-categories">
          <h2>Cell (revealed) names </h2>
          <p>Configure which names each cell will have upon revealing. Hidden cells will just be enumerated, you cannot change this.</p>
          <br></br>
          <div className="board-setup-categories-grid">
            {cells.slice(0, cellCount).map((cell, index) => (
              <label key={cell.id} className="board-setup-field">
                <span>Cell {index + 1}</span>
                <input
                  type="text"
                  value={cell.text}
                  placeholder={`Cell ${index + 1}`}
                  onChange={(e) => updateCellText(index, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="board-upload-section">
          <h2>Background image</h2>
          <div className="board-upload-dropzone">
            <p>Choose an optional background image.</p>
            <input type="file" accept="image/*" onChange={onFileInputChange} />
          </div>

          {backgroundPreview ? (
            <div className="board-upload-preview">
              <img src={backgroundPreview} alt="Bingo background preview" />
            </div>
          ) : null}
        </div>

        <div className="board-setup-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate(`/game/${id}`)}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={isSaving}>
            Create bingo
          </button>
        </div>
      </form>
    </section>
  );
}

export default BingoSetupPage;