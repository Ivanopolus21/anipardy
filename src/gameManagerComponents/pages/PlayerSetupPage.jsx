import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, saveGame } from "../../db.js";
import '../../index.css'

function PlayerSetupPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [game, setGame] = useState(null);
    const [players, setPlayers] = useState([""]);

    useEffect(() => {
        async function loadGame() {
            const savedGame = await getGameById(id);

            if (!savedGame) {
                navigate("/");
                return;
            }

            setGame(savedGame);

            if (savedGame.gameConfig?.players?.length > 0) {
                setPlayers(
                  savedGame.gameConfig.players.map((player, index) =>
                    typeof player === "string"
                      ? player
                      : player.playerName || player.name || `Player ${index + 1}`
                  )
                );
            }
        }

        loadGame();
    }, [id, navigate]);

    function updatePlayer(index, value) {
        const updated = [...players];
        updated[index] = value;
        setPlayers(updated);
    }

    function addPlayer() {
        if (players.length < 8) {
            setPlayers([...players, ""]);
        }
    }

    function removePlayer(index) {
        if (players.length > 1) {
            setPlayers(players.filter((_, i) => i !== index));
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const existingPlayers = Array.isArray(game.gameConfig?.players)
          ? game.gameConfig.players
          : [];

        const cleanedPlayers = players
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name, index) => {
              const existingPlayer = existingPlayers[index];

              return {
                  id:
                    typeof existingPlayer === "object" && existingPlayer?.id
                      ? existingPlayer.id
                      : crypto.randomUUID(),
                  playerName: name,
                  name,
                  score:
                    typeof existingPlayer === "object" && existingPlayer?.score !== undefined
                      ? Number(existingPlayer.score || 0)
                      : 0,
                  order: index,
              };
          });

        if (cleanedPlayers.length < 1) return;

        const updatedGame = {
            ...game,
            gameConfig: {
                ...game.gameConfig,
                players: cleanedPlayers,
            },
            updatedAt: Date.now(),
        };

        await saveGame(updatedGame);
        navigate(`/game/${game.id}`);
    }

    if (!game) return <p>Loading...</p>;

    return (
        <section className="player-setup">
            <form className="player-setup__card" onSubmit={handleSubmit}>
                <h1>{game.name}</h1>
                <p>Add between 1 and 8 players</p>

                <div className="player-list">
                    {players.map((player, index) => (
                        <div key={index} className="player-row">
                            <input
                                type="text"
                                placeholder={`Player ${index + 1} name`}
                                value={player}
                                onChange={(e) => updatePlayer(index, e.target.value)}
                            />

                            {players.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removePlayer(index)}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="player-setup__actions">
                    <button
                        type="button"
                        onClick={addPlayer}
                        disabled={players.length >= 8}
                    >
                        Add player
                    </button>

                    <button type="submit">Create game</button>
                </div>
            </form>
        </section>
    );
}

export default PlayerSetupPage;