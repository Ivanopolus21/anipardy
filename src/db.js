import { openDB } from "idb";

export const dbPromise = openDB("anipardy-db", 2, {
    upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("games")) {
            db.createObjectStore("games", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("media")) {
            const mediaStore = db.createObjectStore("media", { keyPath: "id" });
            mediaStore.createIndex("createdAt", "createdAt");
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

export async function saveMedia(mediaRecord) {
    const db = await dbPromise;
    await db.put("media", mediaRecord);
}

export async function getMediaById(id) {
    const db = await dbPromise;
    return await db.get("media", id);
}

export async function deleteMediaById(id) {
    const db = await dbPromise;
    await db.delete("media", id);
}

export async function getAllMedia() {
    const db = await dbPromise;
    return await db.getAll("media");
}