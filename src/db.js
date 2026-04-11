import { openDB } from "idb";

export const dbPromise = openDB("anipardy-db", 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains("games")) {
            db.createObjectStore("games", { keyPath: "id" });
        }
    },
});

export async function saveGame(game) {
    const db = await dbPromise;
    await db.put("games", game);
}

export async function getGames() {
    const db = await dbPromise;
    return await db.getAll("games");
}

export async function getGameById(id) {
    const db = await dbPromise;
    return await db.get("games", id);
}

export async function updateGame(updatedGame) {
    const db = await dbPromise;
    await db.put("games", updatedGame);
}