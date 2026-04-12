import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveGame } from "../../db.js";
import "../../index.css";

function CreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedCurrency = currency.trim();

    if (!trimmedName) return;

    const newGame = {
      id: crypto.randomUUID(),
      name: trimmedName,
      currency: trimmedCurrency,
      gameConfig: {
        players: [],
        pages: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveGame(newGame);
    navigate("/");
  }

  return (
    <section className="create-game-page">
      <div className="create-game-card">
        <div className="create-game-header">
          <h1>Create game</h1>
        </div>

        <div className="create-game-fields">
          <label className="create-game-field">
            <span>Game name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Game name"
            />
          </label>

          <label className="create-game-field">
            <span>Points symbol</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="Points, $, coins..."
            />
          </label>
        </div>

        <div className="create-game-actions">
          <button className="primary-btn" onClick={handleSave}>
            Save game
          </button>
        </div>
      </div>
    </section>
  );
}

export default CreatePage;