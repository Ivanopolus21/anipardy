import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import '../../index.css'

function QuestionFlowAddingPage() {
  const { id } = useParams();
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

  async function createFlow(questionStepsCount) {
    if (!game || isSaving) return;

    setIsSaving(true);

    const flowId = crypto.randomUUID();

    const questionPages = Array.from({ length: questionStepsCount }, (_, index) => ({
      id: crypto.randomUUID(),
      flowId,
      type: "question-step",
      order: index + 1,
      titleMode: "auto",
      customTitle: "",
      boardLink: {
        boardPageId: null,
        categoryId: null,
        categoryName: "",
        clueValue: null,
      },
      text: "",
      media: [],
      hints: [],
    }));

    const answerPage = {
      id: crypto.randomUUID(),
      flowId,
      type: "answer",
      order: questionStepsCount + 1,
      titleMode: "auto",
      customTitle: "",
      boardLink: {
        boardPageId: null,
        categoryId: null,
        categoryName: "",
        clueValue: null,
      },
      answer: "",
      explanation: "",
      media: [],
    };

    const newPages = [...questionPages, answerPage];

    const updatedGame = {
      ...game,
      gameConfig: {
        ...game.gameConfig,
        pages: [...(game.gameConfig?.pages || []), ...newPages],
      },
      updatedAt: Date.now(),
    };

    await updateGame(updatedGame);
    navigate(`/game/${game.id}`);
  }

  if (!game) {
    return <p>Loading...</p>;
  }

  return (
    <section className="flow-adding-page">
      <div className="flow-adding-card">
        <div className="flow-adding-header">
          <h1>Create question flow</h1>
          <p>
            Choose how many question pages should appear before the answer page
            in <strong> {game.name}</strong>.
          </p>
        </div>

        <div className="flow-options">
          <button
            className="flow-option-card"
            onClick={() => createFlow(1)}
            disabled={isSaving}
          >
            <h2>1 question page + 1 answer page</h2>
            <p>
              If you need just one page to display the question and then one page to display the answer to it.
            </p>
          </button>

          <button
            className="flow-option-card"
            onClick={() => createFlow(2)}
            disabled={isSaving}
          >
            <h2>2 question pages + 1 answer page</h2>
            <p>
              If you need two pages to display the question (maybe extra images, videos etc.) and then one page to display the answer to them.
            </p>
          </button>
        </div>

        <div className="flow-adding-actions">
          <button
            className="secondary-btn"
            onClick={() => navigate(`/game/${game.id}`)}
            disabled={isSaving}
          >
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

export default QuestionFlowAddingPage;