import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getGameById,
  updateGame,
  saveMedia,
  getMediaById,
} from "../../db.js";
import FlowPageRenderer from "../../FlowPageRenderer.jsx";
import "../../index.css";

function createEmptyTextBlock() {
  return {
    id: crypto.randomUUID(),
    value: "",
  };
}

function createEmptyMediaItem() {
  return {
    id: crypto.randomUUID(),
    type: "image",
    mediaId: "",
    name: "",
    mimeType: "",
    alt: "",
    wasOptimized: false,
    width: null,
    height: null,
  };
}

function normalizeMediaItem(item = {}) {
  return {
    id: item.id || crypto.randomUUID(),
    type: item.type || "image",
    mediaId: item.mediaId || "",
    name: item.name || "",
    mimeType: item.mimeType || "",
    alt: item.alt || "",
    wasOptimized: Boolean(item.wasOptimized),
    width: item.width ?? null,
    height: item.height ?? null,
  };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataURL(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

async function optimizeImageToBlob(file) {
  const isGif =
    file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

  if (isGif) {
    return {
      blob: file,
      mimeType: file.type || "image/gif",
      wasOptimized: false,
      width: null,
      height: null,
    };
  }

  const originalDataUrl = await readFileAsDataURL(file);
  const image = await loadImageFromDataURL(originalDataUrl);

  const maxDimension = 1920;
  let { width, height } = image;

  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);

  const isPng =
    file.type === "image/png" || file.name.toLowerCase().endsWith(".png");

  const outputType = isPng ? "image/png" : "image/jpeg";
  const quality = isPng ? 1 : 0.86;

  const optimizedBlob = await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), outputType, quality);
  });

  if (optimizedBlob.size >= file.size) {
    return {
      blob: file,
      mimeType: file.type || outputType,
      wasOptimized: false,
      width: image.width,
      height: image.height,
    };
  }

  return {
    blob: optimizedBlob,
    mimeType: outputType,
    wasOptimized: true,
    width,
    height,
  };
}

async function createStoredMediaRecord(file) {
  let processed = {
    blob: file,
    mimeType: file.type || "",
    wasOptimized: false,
    width: null,
    height: null,
  };

  if (file.type.startsWith("image/")) {
    processed = await optimizeImageToBlob(file);
  }

  const mediaRecord = {
    id: crypto.randomUUID(),
    blob: processed.blob,
    name: file.name,
    mimeType: processed.mimeType,
    size: processed.blob.size || file.size || 0,
    createdAt: Date.now(),
  };

  await saveMedia(mediaRecord);

  return {
    mediaId: mediaRecord.id,
    name: mediaRecord.name,
    mimeType: mediaRecord.mimeType,
    wasOptimized: processed.wasOptimized,
    width: processed.width,
    height: processed.height,
  };
}

function normalizePageContent(page) {
  const layout = page.layout || "text-only";

  const existingText =
    Array.isArray(page.textBlocks) && page.textBlocks.length > 0
      ? page.textBlocks
      : page.text
        ? [{ id: crypto.randomUUID(), value: page.text }]
        : [createEmptyTextBlock()];

  const existingMedia =
    Array.isArray(page.mediaItems) && page.mediaItems.length > 0
      ? page.mediaItems.map(normalizeMediaItem)
      : [createEmptyMediaItem()];

  if (layout === "text-only") {
    return {
      layout,
      textBlocks: [existingText[0] || createEmptyTextBlock()],
      mediaItems: [],
    };
  }

  if (layout === "media-only") {
    return {
      layout,
      textBlocks: [],
      mediaItems: [existingMedia[0] || createEmptyMediaItem()],
    };
  }

  return {
    layout: "text-media",
    textBlocks: [existingText[0] || createEmptyTextBlock()],
    mediaItems: [existingMedia[0] || createEmptyMediaItem()],
  };
}

function SupergameEditorPage() {
  const { id, pageId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [draft, setDraft] = useState({
    titleMode: "auto",
    customTitle: "",
    layout: "text-only",
    textBlocks: [createEmptyTextBlock()],
    mediaItems: [],
    useCustomBackground: false,
    backgroundMediaId: "",
    backgroundName: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState({});
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      const supergamePage = (savedGame.gameConfig?.pages || []).find(
        (page) => page.id === pageId && page.type === "supergame"
      );

      if (!supergamePage) {
        navigate(`/game/${id}`);
        return;
      }

      setGame(savedGame);
    }

    loadGame();
  }, [id, pageId, navigate]);

  const page = useMemo(() => {
    return (
      (game?.gameConfig?.pages || []).find(
        (entry) => entry.id === pageId && entry.type === "supergame"
      ) || null
    );
  }, [game, pageId]);

  const autoTitle = page?.name || "Supergame";
  const effectiveTitle =
    draft.titleMode === "custom" && draft.customTitle.trim()
      ? draft.customTitle.trim()
      : autoTitle;

  useEffect(() => {
    if (!page) return;

    const normalized = normalizePageContent(page);

    setDraft({
      titleMode: page.titleMode || "auto",
      customTitle: page.customTitle || "",
      layout: normalized.layout,
      textBlocks: normalized.textBlocks,
      mediaItems: normalized.mediaItems,
      useCustomBackground: Boolean(page.useCustomBackground),
      backgroundMediaId: page.backgroundMediaId || "",
      backgroundName: page.backgroundName || "",
    });
  }, [page]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls = [];

    async function loadPreviewUrls() {
      if (!draft.mediaItems.length) {
        setMediaPreviews({});
        return;
      }

      const nextPreviews = {};

      for (const item of draft.mediaItems) {
        if (!item.mediaId) continue;

        const mediaRecord = await getMediaById(item.mediaId);
        if (!mediaRecord?.blob) continue;

        const previewUrl = URL.createObjectURL(mediaRecord.blob);
        objectUrls.push(previewUrl);
        nextPreviews[item.id] = previewUrl;
      }

      if (!isCancelled) {
        setMediaPreviews(nextPreviews);
      }
    }

    loadPreviewUrls();

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [draft.mediaItems]);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl = "";

    async function loadBackgroundPreview() {
      if (!draft.useCustomBackground || !draft.backgroundMediaId) {
        setBackgroundPreviewUrl("");
        return;
      }

      const mediaRecord = await getMediaById(draft.backgroundMediaId);
      if (!mediaRecord?.blob) {
        setBackgroundPreviewUrl("");
        return;
      }

      objectUrl = URL.createObjectURL(mediaRecord.blob);

      if (!isCancelled) {
        setBackgroundPreviewUrl(objectUrl);
      }
    }

    loadBackgroundPreview();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [draft.useCustomBackground, draft.backgroundMediaId]);

  function updateDraftField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleLayoutChange(nextLayout) {
    setDraft((current) => {
      const next = {
        ...current,
        layout: nextLayout,
      };

      if (nextLayout === "text-only") {
        next.textBlocks =
          current.textBlocks.length > 0
            ? [current.textBlocks[0]]
            : [createEmptyTextBlock()];
        next.mediaItems = [];
      } else if (nextLayout === "media-only") {
        next.textBlocks = [];
        next.mediaItems =
          current.mediaItems.length > 0
            ? [current.mediaItems[0]]
            : [createEmptyMediaItem()];
      } else {
        next.textBlocks =
          current.textBlocks.length > 0
            ? [current.textBlocks[0]]
            : [createEmptyTextBlock()];
        next.mediaItems =
          current.mediaItems.length > 0
            ? [current.mediaItems[0]]
            : [createEmptyMediaItem()];
      }

      return next;
    });
  }

  function updateTextBlock(blockId, value) {
    setDraft((current) => ({
      ...current,
      textBlocks: current.textBlocks.map((block) =>
        block.id === blockId ? { ...block, value } : block
      ),
    }));
  }

  function updateMediaItem(itemId, field, value) {
    setDraft((current) => ({
      ...current,
      mediaItems: current.mediaItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  }

  async function handleMediaFileChange(itemId, file) {
    if (!file) return;

    try {
      const storedMedia = await createStoredMediaRecord(file);

      setDraft((current) => ({
        ...current,
        mediaItems: current.mediaItems.map((item) =>
          item.id === itemId
            ? {
              ...item,
              mediaId: storedMedia.mediaId,
              name: storedMedia.name,
              mimeType: storedMedia.mimeType,
              wasOptimized: storedMedia.wasOptimized,
              width: storedMedia.width,
              height: storedMedia.height,
            }
            : item
        ),
      }));
    } catch (error) {
      console.error("Failed to store media:", error);
    }
  }

  async function handleBackgroundFileChange(file) {
    if (!file) return;

    try {
      const storedMedia = await createStoredMediaRecord(file);

      setDraft((current) => ({
        ...current,
        useCustomBackground: true,
        backgroundMediaId: storedMedia.mediaId,
        backgroundName: storedMedia.name,
      }));
    } catch (error) {
      console.error("Failed to store background media:", error);
    }
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!game || !page || isSaving) return;

    setIsSaving(true);

    const updatedPages = game.gameConfig.pages.map((entry) => {
      if (entry.id !== page.id) return entry;

      return {
        ...entry,
        titleMode: draft.titleMode,
        customTitle: draft.titleMode === "custom" ? draft.customTitle : "",
        layout: draft.layout,
        textBlocks: draft.textBlocks,
        mediaItems: draft.mediaItems,
        text: draft.textBlocks?.[0]?.value || "",
        useCustomBackground: draft.useCustomBackground,
        backgroundMediaId: draft.useCustomBackground ? draft.backgroundMediaId : "",
        backgroundName: draft.useCustomBackground ? draft.backgroundName : "",
      };
    });

    const updatedGame = {
      ...game,
      gameConfig: {
        ...game.gameConfig,
        pages: updatedPages,
      },
      updatedAt: Date.now(),
    };

    await updateGame(updatedGame);
    setGame(updatedGame);
    setIsSaving(false);
  }

  if (!game || !page) return <p>Loading...</p>;

  const mediaItem = draft.mediaItems[0] || null;
  const mediaPreviewUrl = mediaItem ? mediaPreviews[mediaItem.id] || "" : "";
  const mediaPreviewMap = Object.fromEntries(
    draft.mediaItems.map((item) => [item.id, mediaPreviews[item.id] || ""])
  );

  return (
    <section className="flow-editor-page">
      <div className="flow-editor-shell">
        <div className="flow-editor-header">
          <div>
            <h1>{page.name || "Supergame"}</h1>
            <p>Edit the final supergame page for {game.name}.</p>
          </div>

          <div className="flow-editor-actions">
            <button
              className="secondary-btn"
              type="button"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to manager
            </button>
          </div>
        </div>

        <div className="flow-editor-panels">
          <form className="flow-editor-card flow-editor-panel" onSubmit={handleSave}>
            <div className="flow-editor-panel__header">
              <h2>Page config</h2>
            </div>

            <div className="flow-editor-field">
              <div className="flow-editor-title-box">
                <div className="flow-editor-title-preview">{effectiveTitle}</div>
                <p className="flow-editor-title-help">
                  This is the title players will see on the supergame page.
                </p>
              </div>
            </div>

            <label className="flow-editor-checkbox">
              <input
                type="checkbox"
                checked={draft.titleMode === "custom"}
                onChange={(e) =>
                  updateDraftField("titleMode", e.target.checked ? "custom" : "auto")
                }
              />
              <span>Use custom player title</span>
            </label>

            {draft.titleMode === "custom" && (
              <label className="flow-editor-field">
                <span>Custom title</span>
                <input
                  type="text"
                  value={draft.customTitle}
                  onChange={(e) => updateDraftField("customTitle", e.target.value)}
                  placeholder={autoTitle}
                />
              </label>
            )}

            <label className="flow-editor-field">
              <span>Layout</span>
              <select
                value={draft.layout}
                onChange={(e) => handleLayoutChange(e.target.value)}
              >
                <option value="text-only">Text only</option>
                <option value="media-only">Media only</option>
                <option value="text-media">1 text + 1 media</option>
              </select>
            </label>

            {(draft.layout === "text-only" || draft.layout === "text-media") && (
              <div className="flow-editor-fields">
                <label className="flow-editor-field">
                  <span>Main text</span>
                  <textarea
                    value={draft.textBlocks[0]?.value || ""}
                    onChange={(e) =>
                      updateTextBlock(draft.textBlocks[0].id, e.target.value)
                    }
                    placeholder="Write the final supergame prompt, rules, or intro"
                  />
                </label>
              </div>
            )}

            {(draft.layout === "media-only" || draft.layout === "text-media") && mediaItem && (
              <div className="flow-editor-fields">
                <label className="flow-editor-field">
                  <span>Media type</span>
                  <select
                    value={mediaItem.type}
                    onChange={(e) => updateMediaItem(mediaItem.id, "type", e.target.value)}
                  >
                    <option value="image">Image / GIF</option>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                  </select>
                </label>

                <label className="flow-editor-field">
                  <span>Upload file</span>
                  <input
                    type="file"
                    accept={
                      mediaItem.type === "image"
                        ? "image/*,.gif"
                        : mediaItem.type === "audio"
                          ? "audio/*"
                          : "video/*,.mp4,.mkv"
                    }
                    onChange={(e) => handleMediaFileChange(mediaItem.id, e.target.files?.[0])}
                  />
                </label>

                {mediaItem.name ? (
                  <div className="flow-editor-file-note">
                    Selected file: {mediaItem.name}
                  </div>
                ) : null}

                {mediaItem.type === "image" ? (
                  <label className="flow-editor-field">
                    <span>Alt text</span>
                    <input
                      type="text"
                      value={mediaItem.alt || ""}
                      onChange={(e) => updateMediaItem(mediaItem.id, "alt", e.target.value)}
                      placeholder="Describe the image briefly"
                    />
                  </label>
                ) : null}

                {mediaPreviewUrl && mediaItem.type === "image" ? (
                  <div className="flow-editor-preview">
                    <img src={mediaPreviewUrl} alt={mediaItem.alt || ""} />
                  </div>
                ) : null}

                {mediaPreviewUrl && mediaItem.type === "audio" ? (
                  <div className="flow-editor-preview">
                    <audio controls src={mediaPreviewUrl} />
                  </div>
                ) : null}

                {mediaPreviewUrl && mediaItem.type === "video" ? (
                  <div className="flow-editor-preview">
                    <video controls src={mediaPreviewUrl} />
                  </div>
                ) : null}
              </div>
            )}

            <div className="flow-editor-section">
              <h3>Background</h3>

              <label className="flow-editor-checkbox">
                <input
                  type="checkbox"
                  checked={draft.useCustomBackground}
                  onChange={(e) =>
                    updateDraftField("useCustomBackground", e.target.checked)
                  }
                />
                <span>Use custom background</span>
              </label>

              {draft.useCustomBackground ? (
                <div className="flow-editor-stack">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleBackgroundFileChange(e.target.files?.[0])}
                  />
                </div>
              ) : null}
            </div>

            <div className="flow-editor-footer">
              <button className="primary-btn" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>

          <aside className="flow-editor-live-preview flow-editor-panel">
            <div className="flow-editor-panel__header flow-editor-live-preview__header">
              <div>
                <h2>Page preview</h2>
                <p>This shows how the supergame page will look in the game.</p>
              </div>

              <button
                type="button"
                className="flow-editor-link-btn"
                onClick={() =>
                  navigate(`/play/${id}/supergame/${pageId}`, {
                    state: {
                      fromEditor: true,
                      returnTo: `/game/${id}/supergame/${pageId}`,
                    },
                  })
                }
              >
                Open gameplay view
              </button>
            </div>

            <div className="flow-editor-live-preview__frame">
              <FlowPageRenderer
                page={{
                  ...page,
                  layout: draft.layout,
                  textBlocks: draft.textBlocks,
                  mediaItems: draft.mediaItems,
                  useCustomBackground: draft.useCustomBackground,
                  backgroundMediaId: draft.backgroundMediaId,
                  type: "supergame",
                }}
                pageTitle={effectiveTitle}
                mediaPreviewMap={mediaPreviewMap}
                backgroundPreviewUrl={backgroundPreviewUrl}
                mode="preview"
              />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default SupergameEditorPage;