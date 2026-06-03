import { openDB } from "idb";

function normalizeMediaValue(value) {
    return String(value || "").trim().toLowerCase();
}

export function buildMediaCacheKey({ name, mimeType, size }) {
    return [
        normalizeMediaValue(name),
        normalizeMediaValue(mimeType),
        String(size ?? ""),
    ].join("::");
}

export const dbPromise = openDB("anipardy-db", 3, {
    upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains("games")) {
            db.createObjectStore("games", { keyPath: "id" });
        }

        let mediaStore;

        if (!db.objectStoreNames.contains("media")) {
            mediaStore = db.createObjectStore("media", { keyPath: "id" });
            mediaStore.createIndex("createdAt", "createdAt");
        } else {
            mediaStore = transaction.objectStore("media");
        }

        if (!mediaStore.indexNames.contains("createdAt")) {
            mediaStore.createIndex("createdAt", "createdAt");
        }

        if (!mediaStore.indexNames.contains("cacheKey")) {
            mediaStore.createIndex("cacheKey", "cacheKey", { unique: false });
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

    const recordWithCacheKey = {
        ...mediaRecord,
        cacheKey:
          mediaRecord.cacheKey ||
          buildMediaCacheKey({
              name: mediaRecord.name,
              mimeType: mediaRecord.mimeType,
              size: mediaRecord.size,
          }),
    };

    await db.put("media", recordWithCacheKey);
}

export async function findMediaByCacheKey({ name, mimeType, size }) {
    const db = await dbPromise;
    const cacheKey = buildMediaCacheKey({ name, mimeType, size });
    return await db.getFromIndex("media", "cacheKey", cacheKey);
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

export async function deleteGameById(id) {
    const db = await dbPromise;
    await db.delete("games", id);
}