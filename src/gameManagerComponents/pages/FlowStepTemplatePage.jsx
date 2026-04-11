import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import '../../index.css'

const QUESTION_LAYOUTS = [
  {
    value: "text-only",
    title: "Text only",
    description: "A simple text question.",
  },
  {
    value: "image-text",
    title: "Image + text",
    description: "One image with question text.",
  },
  {
    value: "two-images",
    title: "2 images",
    description: "Two image clues on one page.",
  },
  {
    value: "four-images",
    title: "4 images",
    description: "Four image clue layout.",
  },
  {
    value: "audio",
    title: "Audio",
    description: "Audio clue with optional text.",
  },
  {
    value: "video",
    title: "Video",
    description: "Video clue with optional text.",
  },
];

const ANSWER_LAYOUTS = [
  {
    value: "text-answer",
    title: "Text answer",
    description: "Show the answer in text form.",
  },
  {
    value: "image-answer",
    title: "Image answer",
    description: "Show an image as part of the answer.",
  },
  {
    value: "audio-answer",
    title: "Audio answer",
    description: "Reveal with audio.",
  },
  {
    value: "video-answer",
    title: "Video answer",
    description: "Reveal with video.",
  },
];

function FlowStepTemplatePage() {
  const { id, flowId, pageId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const page = useMemo(() => {
    return (game?.gameConfig?.pages || []).find((item) => item.id === pageId);
  }, [game, pageId]);

  const availableLayouts = page?.type === "answer" ? ANSWER_LAYOUTS : QUESTION_LAYOUTS;

  async function chooseLayout(layout) {
    if (!game || !page || isSaving) return;

    setIsSaving(true);

    const updatedPages = game.gameConfig.pages.map((item) => {
      if (item.id !== page.id) return item;
      return {
        ...item,
        layout,
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
    navigate(`/game/${id}/flow/${flowId}/step/${pageId}/edit`);
  }

  if (!game || !page) return <p>Loading...</p>;

  return (
    <section className="page-adding-page">
      <div className="page-adding-card">
        <h1>Choose step layout</h1>
        <h2>
          Select how this {page.type === "answer" ? "answer" : "question"} page should look.
        </h2>

        <div className="page-type-grid">
          {availableLayouts.map((layout) => (
            <button
              key={layout.value}
              className="page-type-card"
              onClick={() => chooseLayout(layout.value)}
              disabled={isSaving}
            >
              <h2>{layout.title}</h2>
              <p>{layout.description}</p>
            </button>
          ))}
        </div>

        <button
          className="back-btn"
          onClick={() => navigate(`/game/${id}/flow/${flowId}`)}
          disabled={isSaving}
        >
          Back
        </button>
      </div>
    </section>
  );
}

export default FlowStepTemplatePage;