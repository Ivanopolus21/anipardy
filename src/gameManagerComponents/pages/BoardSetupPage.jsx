import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import '../../index.css'

const MIN_CATEGORIES = 1;
const MAX_CATEGORIES = 8;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 10;

function buildEmptyCategories(count, previous = []) {
  return Array.from({ length: count }, (_, index) => ({
    id: previous[index]?.id || crypto.randomUUID(),
    name: previous[index]?.name || "",
    questions: previous[index]?.questions || [],
  }));
}

function BoardSetupPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [categoryCountInput, setCategoryCountInput] = useState("5");
  const [questionCountInput, setQuestionCountInput] = useState("5");
  const [categoryCountCommitted, setCategoryCountCommitted] = useState(5);
  const [questionCountCommitted, setQuestionCountCommitted] = useState(5);
  const [categories, setCategories] = useState(buildEmptyCategories(5));
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

      const boardPage = (savedGame.gameConfig?.pages || []).find((page) => page.id === pageId);

      if (!boardPage) {
        navigate(`/game/${id}`);
        return;
      }

      if (boardPage.isConfigured) {
        navigate(`/game/${id}/board/${pageId}`);
        return;
      }
    }

    loadGame();
  }, [id, pageId, navigate]);

  useEffect(() => {
    setCategories((prev) => buildEmptyCategories(categoryCountCommitted, prev));
  }, [categoryCountCommitted]);

  useEffect(() => {
    return () => {
      if (backgroundPreview) {
        URL.revokeObjectURL(backgroundPreview);
      }
    };
  }, [backgroundPreview]);

  const boardPage = useMemo(() => {
    return (game?.gameConfig?.pages || []).find((page) => page.id === pageId);
  }, [game, pageId]);

  function clampCount(value, min, max, fallback) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return fallback;

    return Math.max(min, Math.min(max, parsed));
  }

  function normalizeCategoryCount() {
    const normalized = clampCount(categoryCountInput, MIN_CATEGORIES, MAX_CATEGORIES, 5);
    setCategoryCountInput(String(normalized));
    setCategoryCountCommitted(normalized);
  }

  function normalizeQuestionCount() {
    const normalized = clampCount(questionCountInput, MIN_QUESTIONS, MAX_QUESTIONS, 5);
    setQuestionCountInput(String(normalized));
    setQuestionCountCommitted(normalized);
  }

  function handleCategoryCountChange(value) {
    if (value === "") {
      setCategoryCountInput("");
      return;
    }

    if (/^\d+$/.test(value)) {
      setCategoryCountInput(value);
    }
  }

  function handleQuestionCountChange(value) {
    if (value === "") {
      setQuestionCountInput("");
      return;
    }

    if (/^\d+$/.test(value)) {
      setQuestionCountInput(value);
    }
  }

  function updateCategoryName(index, value) {
    setCategories((prev) =>
      prev.map((category, i) =>
        i === index ? { ...category, name: value } : category
      )
    );
  }

  function handleBackgroundChange(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    if (backgroundPreview) {
      URL.revokeObjectURL(backgroundPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setBackgroundFile(file);
    setBackgroundPreview(previewUrl);
  }

  function onFileInputChange(e) {
    const file = e.target.files?.[0];
    handleBackgroundChange(file);
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleBackgroundChange(file);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const finalCategoryCount = clampCount(
      categoryCountInput,
      MIN_CATEGORIES,
      MAX_CATEGORIES,
      categoryCountCommitted
    );

    const finalQuestionCount = clampCount(
      questionCountInput,
      MIN_QUESTIONS,
      MAX_QUESTIONS,
      questionCountCommitted
    );

    if (!game || !boardPage || isSaving) return;

    const cleanedCategories = categories
      .map((category, index) => ({
        ...category,
        name: category.name.trim() || `Category ${index + 1}`,
      }))
      .slice(0, finalCategoryCount)
      .map((category) => ({
        ...category,
        questions: Array.from({ length: finalQuestionCount }, (_, rowIndex) => {
          const existingQuestion = category.questions?.[rowIndex];

          return {
            id: existingQuestion?.id || crypto.randomUUID(),
            row: rowIndex,
            points: null,
            flowId: null,
          };
        }),
      }));

    setIsSaving(true);

    let backgroundData = null;

    if (backgroundFile) {
      backgroundData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(backgroundFile);
      });
    }

    const updatedPages = game.gameConfig.pages.map((page) => {
      if (page.id !== boardPage.id) return page;

      return {
        ...page,
        isConfigured: true,
        questionCount: finalQuestionCount,
        categories: cleanedCategories,
        background: backgroundData,
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
    navigate(`/game/${id}/board/${pageId}`);
  }

  if (!game || !boardPage) return <p>Loading...</p>;

  return (
    <section className="board-setup-page">
      <form className="board-setup-card" onSubmit={handleSubmit}>
        <h1>{boardPage.name || "Board setup"}</h1>
        <p>Configure the board structure before filling in point values and question links.</p>

        <div className="board-setup-grid">
          <label className="board-setup-field">
            <span>Number of categories (1-8)</span>
            <input
              type="text"
              inputMode="numeric"
              value={categoryCountInput}
              onChange={(e) => handleCategoryCountChange(e.target.value)}
              onBlur={normalizeCategoryCount}
            />
          </label>

          <label className="board-setup-field">
            <span>Questions per category (1-10)</span>
            <input
              type="text"
              inputMode="numeric"
              value={questionCountInput}
              onChange={(e) => handleQuestionCountChange(e.target.value)}
              onBlur={normalizeQuestionCount}
            />
          </label>
        </div>

        <div className="board-setup-categories">
          <h2>Category names</h2>

          <div className="board-setup-categories-grid">
            {categories.map((category, index) => (
              <label key={category.id} className="board-setup-field">
                <span>Category {index + 1}</span>
                <input
                  type="text"
                  value={category.name}
                  placeholder={`Category ${index + 1}`}
                  onChange={(e) => updateCategoryName(index, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="board-upload-section">
          <h2>Background image</h2>
          <div
            className="board-upload-dropzone"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <p>Drop an image here or choose a file.</p>
            <input type="file" accept="image/*" onChange={onFileInputChange} />
          </div>

          {backgroundPreview && (
            <div className="board-upload-preview">
              <img src={backgroundPreview} alt="Board background preview" />
            </div>
          )}
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
            Create board
          </button>
        </div>
      </form>
    </section>
  );
}

export default BoardSetupPage;