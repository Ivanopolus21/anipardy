import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, updateGame } from "../../db.js";
import '../../index.css'

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

  async function addPage(type) {
    if (!game) return;

    if (type === "board") {
      const name = window.prompt("Name this board:", "New board")?.trim();

      if (!name) return;

      const newBoardPage = {
        id: crypto.randomUUID(),
        type: "board",
        name,
        isConfigured: false,
        categories: [],
        questionCount: 0,
        background: null,
        createdAt: Date.now(),
      };

      const updatedGame = {
        ...game,
        gameConfig: {
          ...game.gameConfig,
          pages: [...(game.gameConfig?.pages || []), newBoardPage],
        },
        updatedAt: Date.now(),
      };

      await updateGame(updatedGame);
      navigate(`/game/${game.id}/board/${newBoardPage.id}/setup`);
      return;
    }

    if (type === "supergame") {
      const name = window.prompt("Name this block:", "New supergame")?.trim();

      if (!name) return;

      const newPage = {
        id: crypto.randomUUID(),
        type,
        name,
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
      navigate(`/game/${game.id}`);
    }
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

          <button onClick={() => navigate(`/game/${game.id}/flows/new`)} className="page-type-card">
            <h2>Question flow</h2>
            <p>Create 1 or 2 question pages followed by an answer page.</p>
          </button>

          <button onClick={() => addPage("supergame")} className="page-type-card">
            <h2>Supergame page</h2>
            <p>A special final or bonus round page.</p>
          </button>
        </div>

        <button
          className="back-btn"
          onClick={() => navigate(`/game/${game.id}`)}
        >
          Back
        </button>
      </div>
    </section>
  );
}

export default PageAddingPage;