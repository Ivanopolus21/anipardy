import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";

function SupergameTypePage() {
  const { id } = useParams();
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

  async function addSupergame(supergameType) {
    if (!game) return;

    const newPage = {
      id: crypto.randomUUID(),
      type: "supergame",
      supergameType: "bingo",
      isConfigured: false,
      title: "",
      name: "Bingo",
      createdAt: Date.now(),
    };

    const updatedGame = {
      ...game,
      gameConfig: {
        ...game.gameConfig,
        pages: [...(game.gameConfig?.pages || []), newPage],
      },
      updatedAt: Date.now(),
    };

    await updateGame(updatedGame);
    navigate(`/game/${game.id}/supergame/${newPage.id}/setup`);
  }

  if (!game) return <p>Loading...</p>;

  return (
    <section className="page-adding-page">
      <div className="page-adding-card">
        <h1>Choose a supergame type</h1>
        <h2>Select which kind of supergame you want to add to {game.name}.</h2>

        <div className="page-type-grid">
          <button
            type="button"
            onClick={() => addSupergame("bingo")}
            className="page-type-card"
          >
            <h2>Bingo</h2>
            <p>A bingo-style final or bonus round page.</p>
          </button>
        </div>

        <div className="page-adding-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={() => navigate(`/game/${game.id}/pages/new`)}
          >
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

export default SupergameTypePage;