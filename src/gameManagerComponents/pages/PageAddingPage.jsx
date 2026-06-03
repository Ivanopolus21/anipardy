import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";

function PageAddingPage() {
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

  const hasSupergamePage = (game?.gameConfig?.pages || []).some(
    (page) => page.type === "supergame"
  );

  async function addPage(type) {
    if (!game) return;

    if (
      type === "supergame" &&
      game.gameConfig?.pages?.some((page) => page.type === "supergame")
    ) {
      return;
    }

    const newPage = {
      id: crypto.randomUUID(),
      type,
      title: "",
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
    setGame(updatedGame);

    if (type === "board") {
      navigate(`/game/${game.id}/board/${newPage.id}/setup`);
      return;
    }

    navigate(`/game/${game.id}`);
  }

  function handleAddSupergame() {
    if (!game || hasSupergamePage) return;
    navigate(`/game/${game.id}/supergame/new`);
  }

  if (!game) return <p>Loading...</p>;

  return (
    <section className="page-adding-page">
      <div className="page-adding-card">
        <h1>Add a new page</h1>
        <h2>Choose what kind of page you want to add to {game.name}.</h2>

        <div className="page-type-grid">
          <button onClick={() => addPage("board")} className="page-type-card">
            <h2>The Board</h2>
            <p>A board with categories, question values and players' scores.</p>
          </button>

          <button
            type="button"
            onClick={handleAddSupergame}
            className="page-type-card"
            disabled={hasSupergamePage}
          >
            <h2>Supergame page</h2>
            <p>
              {hasSupergamePage
                ? "A Supergame already exists for this game."
                : "A special final or bonus round page."}
            </p>
          </button>
        </div>

        <div className="page-adding-actions">
          <button
            className="secondary-btn"
            onClick={() => navigate(`/game/${game.id}`)}
          >
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

export default PageAddingPage;