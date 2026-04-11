import "./index.css";

function FlowPageRenderer({
                            page,
                            pageTitle,
                            mediaPreviewMap = {},
                            backgroundPreviewUrl = "",
                            mode = "preview",
                          }) {
  if (!page) return null;

  const textBlocks = Array.isArray(page.textBlocks) ? page.textBlocks : [];
  const mediaItems = Array.isArray(page.mediaItems) ? page.mediaItems : [];
  const timerDisplay =
    typeof page.timerSeconds === "number" ? page.timerSeconds : 60;

  const renderMediaItem = (item) => {
    const src = mediaPreviewMap[item.id] || "";

    if (!src) {
      return (
        <div className="flow-page-renderer__media-placeholder">
          No media selected yet
        </div>
      );
    }

    if (item.type === "image") {
      return (
        <img
          src={src}
          alt={item.alt || ""}
          className="flow-page-renderer__image"
        />
      );
    }

    if (item.type === "audio") {
      return (
        <audio
          controls
          src={src}
          className="flow-page-renderer__audio"
          aria-label={item.name || "Audio"}
        />
      );
    }

    if (item.type === "video") {
      return (
        <video
          controls
          src={src}
          className="flow-page-renderer__video"
          aria-label={item.name || "Video"}
        />
      );
    }

    return null;
  };

  const renderContent = () => {
    if (page.layout === "media-only") {
      return (
        <div className="flow-page-renderer__media-only">
          {mediaItems[0] ? (
            renderMediaItem(mediaItems[0])
          ) : (
            <div className="flow-page-renderer__media-placeholder">
              No media selected yet
            </div>
          )}
        </div>
      );
    }

    if (page.layout === "text-media") {
      return (
        <div className="flow-page-renderer__split">
          <div className="flow-page-renderer__text-column">
            {textBlocks[0]?.value ? (
              <div className="flow-page-renderer__main-text">
                {textBlocks[0].value}
              </div>
            ) : (
              <div className="flow-page-renderer__empty">
                No text added yet
              </div>
            )}
          </div>

          <div className="flow-page-renderer__media-column">
            {mediaItems[0] ? (
              renderMediaItem(mediaItems[0])
            ) : (
              <div className="flow-page-renderer__media-placeholder">
                No media selected yet
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flow-page-renderer__text-only">
        {textBlocks[0]?.value ? (
          <div className="flow-page-renderer__main-text">
            {textBlocks[0].value}
          </div>
        ) : (
          <div className="flow-page-renderer__empty">
            No text added yet
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      className={`flow-page-renderer flow-page-renderer--${mode}`}
      aria-label={mode === "gameplay" ? "Game page" : "Page preview"}
    >
      {page.useCustomBackground && backgroundPreviewUrl ? (
        <div
          className="flow-page-renderer__background"
          style={{ backgroundImage: `url(${backgroundPreviewUrl})` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="flow-page-renderer__overlay">
        <header className="flow-page-renderer__header">
          <div className="flow-page-renderer__topbar">
            <div className="flow-page-renderer__badges">
              {page.enableModifier && page.modifierText ? (
                <span className="flow-page-renderer__badge">
                  {page.modifierText}
                </span>
              ) : null}

              {mode !== "gameplay" && page.enableTimer ? (
                <span className="flow-page-renderer__badge flow-page-renderer__badge--timer">
                  {timerDisplay}s timer
                 </span>
              ) : null}
            </div>
          </div>

          <h2 className="flow-page-renderer__title">
            {pageTitle || "Untitled page"}
          </h2>
        </header>

        <div className="flow-page-renderer__body">{renderContent()}</div>

        {page.type === "answer" && (page.answer || page.explanation) ? (
          <footer className="flow-page-renderer__answer-box">
            {page.answer ? (
              <div className="flow-page-renderer__answer-line">
                <span className="flow-page-renderer__answer-label">Answer:</span>
                <span>{page.answer}</span>
              </div>
            ) : null}

            {page.explanation ? (
              <div className="flow-page-renderer__explanation">
                {page.explanation}
              </div>
            ) : null}
          </footer>
        ) : null}
      </div>
    </section>
  );
}

export default FlowPageRenderer;