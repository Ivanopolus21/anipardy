import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById } from "../../db.js";
import '../../index.css'

function getStepStatus(page) {
  if (!page.layout) return "Not configured";
  return "Ready";
}

function getStepLabel(page, index) {
  if (page.type === "answer") return "Answer";
  return `Question ${index + 1}`;
}

function QuestionFlowManagerPage() {
  const { id, flowId } = useParams();
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

  const flowPages = useMemo(() => {
    return (game?.gameConfig?.pages || [])
      .filter((page) => page.flowId === flowId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [game, flowId]);

  function openStep(page) {
    if (!game) return;

    if (!page.layout) {
      navigate(`/game/${game.id}/flow/${flowId}/step/${page.id}/template`);
      return;
    }

    navigate(`/game/${game.id}/flow/${flowId}/step/${page.id}/edit`);
  }

  if (!game) return <p>Loading...</p>;

  if (flowPages.length === 0) {
    return (
      <section className="manager-page">
        <h1>Question flow</h1>
        <p>Flow not found.</p>
        <button className="secondary-btn" onClick={() => navigate(`/game/${id}`)}>
          Back
        </button>
      </section>
    );
  }

  const configuredCount = flowPages.filter((page) => page.layout).length;

  return (
    <section className="manager-page">
      <div className="manager-page__header">
        <div>
          <h1>Question flow</h1>
          <p>
            {configuredCount} of {flowPages.length} steps configured
          </p>
        </div>

        <div className="manager-page__actions">
          <button className="secondary-btn" onClick={() => navigate(`/game/${id}`)}>
            Back to game
          </button>
        </div>
      </div>

      <div className="pages-grid">
        {flowPages.map((page, index) => (
          <div
            key={page.id}
            className="page-card page-card--flow"
            onClick={() => openStep(page)}
          >
            <h3>{getStepLabel(page, index)}</h3>
            <p>{getStepStatus(page)}</p>
            <p>{page.layout ? `Layout: ${page.layout}` : "Choose a layout to start editing."}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default QuestionFlowManagerPage;