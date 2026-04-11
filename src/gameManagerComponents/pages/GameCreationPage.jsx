import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveGame } from "../../db.js";
import '../../index.css'

function CreatePage() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState("");

    async function handleSave() {
        const newGame = {
            id: crypto.randomUUID(),
            name,
            currency,
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
        <section>
            <h1>Create game</h1>

            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Game name"
            />

            <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="Points symbol"
            />

            <button className="primary-btn" onClick={handleSave}>Save game</button>
        </section>
    );
}

export default CreatePage;