import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getGameById,
  updateGame,
  saveMedia,
  getMediaById,
} from "../../db.js";
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
    previewUrl: "",
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
    previewUrl: "",
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

function getStepLabel(page, index) {
  if (page.type === "answer") return "Answer";
  return `Question ${index + 1}`;
}

function getAutoTitle(flowPages, game) {
  const linkedPage = flowPages.find(
    (page) =>
      page.boardLink?.categoryName &&
      page.boardLink?.clueValue !== null &&
      page.boardLink?.clueValue !== undefined
  );

  if (!linkedPage) return "Unlinked flow";

  const categoryName = linkedPage.boardLink.categoryName || "Category";
  const clueValue = linkedPage.boardLink.clueValue ?? "?";
  const currency = game?.currency || "Points";

  return `${categoryName} - ${clueValue} ${currency}`;
}

function QuestionFlowEditorPage() {
  const { id, flowId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [activePageId, setActivePageId] = useState("");
  const [draft, setDraft] = useState({
    titleMode: "auto",
    customTitle: "",
    layout: "text-only",
    textBlocks: [createEmptyTextBlock()],
    mediaItems: [],
    answer: "",
    explanation: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadGame() {
      const savedGame = await getGameById(id);

      if (!savedGame) {
        navigate("/");
        return;
      }

      const flowPages = (savedGame.gameConfig?.pages || [])
        .filter((page) => page.flowId === flowId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (flowPages.length === 0) {
        navigate(`/game/${id}`);
        return;
      }

      setGame(savedGame);
      setActivePageId(flowPages[0].id);
    }

    loadGame();
  }, [id, flowId, navigate]);

  const flowPages = useMemo(() => {
    return (game?.gameConfig?.pages || [])
      .filter((page) => page.flowId === flowId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [game, flowId]);

  const activePage = useMemo(() => {
    return flowPages.find((page) => page.id === activePageId) || null;
  }, [flowPages, activePageId]);

  const autoTitle = useMemo(() => {
    return getAutoTitle(flowPages, game);
  }, [flowPages, game]);

  const effectiveTitle =
    draft.titleMode === "custom" && draft.customTitle.trim()
      ? draft.customTitle.trim()
      : autoTitle;

  useEffect(() => {
    if (!activePage) return;

    const normalized = normalizePageContent(activePage);

    setDraft({
      titleMode: activePage.titleMode || "auto",
      customTitle: activePage.customTitle || "",
      layout: normalized.layout,
      textBlocks: normalized.textBlocks,
      mediaItems: normalized.mediaItems,
      answer: activePage.answer || "",
      explanation: activePage.explanation || "",
    });
  }, [activePage]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls = [];

    async function loadPreviewUrls() {
      const itemsWithPreviews = await Promise.all(
        draft.mediaItems.map(async (item) => {
          if (!item.mediaId) {
            return { ...item, previewUrl: "" };
          }

          const mediaRecord = await getMediaById(item.mediaId);

          if (!mediaRecord?.blob) {
            return { ...item, previewUrl: "" };
          }

          const previewUrl = URL.createObjectURL(mediaRecord.blob);
          objectUrls.push(previewUrl);

          return {
            ...item,
            previewUrl,
          };
        })
      );

      if (!isCancelled) {
        setDraft((current) => ({
          ...current,
          mediaItems: itemsWithPreviews,
        }));
      }
    }

    if (draft.mediaItems.length > 0) {
      loadPreviewUrls();
    }

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [activePageId, draft.mediaItems.length]);

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
          current.textBlocks.length > 0 ? [current.textBlocks[0]] : [createEmptyTextBlock()];
        next.mediaItems = [];
      } else if (nextLayout === "media-only") {
        next.textBlocks = [];
        next.mediaItems =
          current.mediaItems.length > 0 ? [current.mediaItems[0]] : [createEmptyMediaItem()];
      } else {
        next.textBlocks =
          current.textBlocks.length > 0 ? [current.textBlocks[0]] : [createEmptyTextBlock()];
        next.mediaItems =
          current.mediaItems.length > 0 ? [current.mediaItems[0]] : [createEmptyMediaItem()];
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
      const previewRecord = await getMediaById(storedMedia.mediaId);
      const previewUrl = previewRecord?.blob
        ? URL.createObjectURL(previewRecord.blob)
        : "";

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
              previewUrl,
            }
            : item
        ),
      }));
    } catch (error) {
      console.error("Failed to store media:", error);
    }
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!game || !activePage || isSaving) return;

    setIsSaving(true);

    const updatedPages = game.gameConfig.pages.map((page) => {
      if (page.id !== activePage.id) return page;

      const sanitizedMediaItems = draft.mediaItems.map(({ previewUrl, ...item }) => item);

      const commonFields = {
        ...page,
        titleMode: draft.titleMode,
        customTitle: draft.titleMode === "custom" ? draft.customTitle : "",
        layout: draft.layout,
        textBlocks: draft.textBlocks,
        mediaItems: sanitizedMediaItems,
        text: draft.textBlocks?.[0]?.value || "",
      };

      if (page.type === "answer") {
        return {
          ...commonFields,
          answer: draft.answer,
          explanation: draft.explanation,
        };
      }

      return commonFields;
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

  if (!game || !activePage) return <p>Loading...</p>;

  const questionPagesCount = flowPages.filter(
    (page) => page.type === "question-step"
  ).length;

  const mediaItem = draft.mediaItems[0] || null;
  const isAnswerPage = activePage.type === "answer";

  return (
    <section className="flow-editor-page">
      <div className="flow-editor-shell">
        <div className="flow-editor-header">
          <div>
            <h1>{autoTitle}</h1>
            <p>
              Editing a flow with {questionPagesCount} question page
              {questionPagesCount !== 1 ? "s" : ""} and 1 answer page in {game.name}.
            </p>
          </div>

          <div className="flow-editor-actions">
            <button
              className="secondary-btn"
              type="button"
              onClick={() => navigate(`/game/${id}`)}
            >
              Back to game
            </button>
          </div>
        </div>

        <div className="flow-editor-tabs" role="tablist" aria-label="Flow steps">
          {flowPages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={page.id === activePageId}
              className={`flow-editor-tab ${
                page.id === activePageId ? "flow-editor-tab--active" : ""
              }`}
              onClick={() => setActivePageId(page.id)}
            >
              {getStepLabel(page, index)}
            </button>
          ))}
        </div>

        <form className="flow-editor-card" onSubmit={handleSave}>
          <div className="flow-editor-field">
            <span>Page Title</span>
            <div className="flow-editor-title-box">
              <div className="flow-editor-title-preview">{effectiveTitle}</div>
              <p className="flow-editor-title-help">
                This is the title players will see on this page.
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
                <span>{isAnswerPage ? "Main text" : "Question text"}</span>
                <textarea
                  value={draft.textBlocks[0]?.value || ""}
                  onChange={(e) =>
                    updateTextBlock(draft.textBlocks[0].id, e.target.value)
                  }
                  placeholder={
                    isAnswerPage
                      ? "Write the main answer-page text"
                      : "Write the question, clue, or prompt shown to players"
                  }
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

              {mediaItem.name && (
                <div className="flow-editor-file-note">
                  Selected file: {mediaItem.name}
                </div>
              )}

              {mediaItem.type === "image" && (
                <label className="flow-editor-field">
                  <span>Alt text</span>
                  <input
                    type="text"
                    value={mediaItem.alt || ""}
                    onChange={(e) => updateMediaItem(mediaItem.id, "alt", e.target.value)}
                    placeholder="Describe the image briefly"
                  />
                </label>
              )}

              {mediaItem.previewUrl && mediaItem.type === "image" && (
                <div className="flow-editor-preview">
                  <img src={mediaItem.previewUrl} alt={mediaItem.alt || ""} />
                </div>
              )}

              {mediaItem.previewUrl && mediaItem.type === "audio" && (
                <div className="flow-editor-preview">
                  <audio controls src={mediaItem.previewUrl} />
                </div>
              )}

              {mediaItem.previewUrl && mediaItem.type === "video" && (
                <div className="flow-editor-preview">
                  <video controls src={mediaItem.previewUrl} />
                </div>
              )}
            </div>
          )}

          {isAnswerPage && (
            <div className="flow-editor-fields">
              <label className="flow-editor-field">
                <span>Answer</span>
                <textarea
                  value={draft.answer}
                  onChange={(e) => updateDraftField("answer", e.target.value)}
                  placeholder="Write the correct answer here"
                />
              </label>

              <label className="flow-editor-field">
                <span>Explanation</span>
                <textarea
                  value={draft.explanation}
                  onChange={(e) => updateDraftField("explanation", e.target.value)}
                  placeholder="Add extra context, explanation, or fun facts"
                />
              </label>
            </div>
          )}

          <div className="flow-editor-footer">
            <button className="primary-btn" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default QuestionFlowEditorPage;