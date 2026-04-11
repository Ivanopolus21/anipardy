import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGames } from "../../db.js";
import '../../index.css'

function MainPage() {
    const navigate = useNavigate();
    const [games, setGames] = useState([]);

    useEffect(() => {
        async function loadGames() {
            const savedGames = await getGames();
            setGames(savedGames);
        }

        loadGames();
    }, []);

    function openGame(game) {
        if (game.gameConfig?.players?.length > 0) {
            navigate(`/game/${game.id}`);
        } else {
            navigate(`/game/${game.id}/setup`);
        }
    }

    return (
        <section className="main-page">
            <div className="main-page__header">
                <h1>Games you created</h1>
                <button className="create" onClick={() => navigate("/create")}>
                    Create a new game
                </button>
            </div>

            <div className="games-grid">
                {games.map((game) => (
                    <div key={game.id} className="game-card" onClick={() => openGame(game)}>
                        <h2>{game.name}</h2>
                        <p>Created on {new Date(game.createdAt).toLocaleDateString()}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default MainPage;