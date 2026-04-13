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
  const showModifier = Boolean(page.enableModifier && page.modifierText?.trim());
  const isSecretModifier = Boolean(page.isSecretModifier);
  const modifierDisplayText = showModifier
    ? page.type === "question-step" && isSecretModifier
      ? "Secret modifier!"
      : page.modifierText
    : "";

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

  const renderTextItem = (block, index) => {
    if (block?.value) {
      return (
        <div key={block.id || index} className="flow-page-renderer__text-card">
          <div className="flow-page-renderer__main-text">{block.value}</div>
        </div>
      );
    }

    return (
      <div key={block?.id || index} className="flow-page-renderer__empty">
        No text added yet
      </div>
    );
  };

  const renderLayout = () => {
    switch (page.layout) {
      case "text-only":
        return (
          <div className="flow-page-renderer__text-only">
            {textBlocks[0]?.value ? (
              <div className="flow-page-renderer__main-text">{textBlocks[0].value}</div>
            ) : (
              <div className="flow-page-renderer__empty">No text added yet</div>
            )}
          </div>
        );

      case "texts-4":
        return (
          <div className="flow-page-renderer__text-grid flow-page-renderer__text-grid--4">
            {textBlocks.map(renderTextItem)}
          </div>
        );

      case "image-only":
      case "audio-only":
      case "video-only":
        return (
          <div className="flow-page-renderer__media-only">
            {mediaItems[0] ? renderMediaItem(mediaItems[0]) : (
              <div className="flow-page-renderer__media-placeholder">No media selected yet</div>
            )}
          </div>
        );

      case "image-text":
      case "audio-text":
        return (
          <div className="flow-page-renderer__split">
            <div className="flow-page-renderer__text-column">
              {textBlocks[0]?.value ? (
                <div className="flow-page-renderer__main-text">{textBlocks[0].value}</div>
              ) : (
                <div className="flow-page-renderer__empty">No text added yet</div>
              )}
            </div>
            <div className="flow-page-renderer__media-column">
              {mediaItems[0] ? renderMediaItem(mediaItems[0]) : (
                <div className="flow-page-renderer__media-placeholder">No media selected yet</div>
              )}
            </div>
          </div>
        );

      case "audio-image":
        return (
          <div className="flow-page-renderer__split flow-page-renderer__split--stacked-media">
            <div className="flow-page-renderer__media-column">
              {mediaItems.map((item, index) => (
                <div key={item.id || index} className="flow-page-renderer__media-cell">
                  {renderMediaItem(item)}
                </div>
              ))}
            </div>
          </div>
        );

      case "images-2":
      case "images-3":
      case "images-4":
      case "images-8":
        return (
          <div
            className={`flow-page-renderer__media-grid flow-page-renderer__media-grid--${mediaItems.length}`}
          >
            {mediaItems.map((item, index) => (
              <div key={item.id || index} className="flow-page-renderer__media-cell">
                {renderMediaItem(item)}
              </div>
            ))}
          </div>
        );

      case "images-text-2":
      case "images-text-3":
      case "images-text-4":
      case "images-text-8":
        return (
          <div
            className={`flow-page-renderer__combo-grid flow-page-renderer__combo-grid--${Math.max(
              textBlocks.length,
              mediaItems.length
            )}`}
          >
            {Array.from({ length: Math.max(textBlocks.length, mediaItems.length) }).map((_, index) => (
              <div key={index} className="flow-page-renderer__combo-card">
                <div className="flow-page-renderer__combo-media">
                  {mediaItems[index]
                    ? renderMediaItem(mediaItems[index])
                    : <div className="flow-page-renderer__media-placeholder">No media selected yet</div>}
                </div>
                <div className="flow-page-renderer__combo-text">
                  {textBlocks[index]?.value
                    ? <div className="flow-page-renderer__main-text">{textBlocks[index].value}</div>
                    : <div className="flow-page-renderer__empty">No text added yet</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case "videos-2-text":
        return (
          <div className="flow-page-renderer__video-text-layout">
            <div className="flow-page-renderer__video-row">
              {mediaItems.map((item, index) => (
                <div key={item.id || index} className="flow-page-renderer__media-cell">
                  {renderMediaItem(item)}
                </div>
              ))}
            </div>
            <div className="flow-page-renderer__video-text-box">
              {textBlocks[0]?.value ? (
                <div className="flow-page-renderer__main-text">{textBlocks[0].value}</div>
              ) : (
                <div className="flow-page-renderer__empty">No text added yet</div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="flow-page-renderer__text-only">
            {textBlocks[0]?.value ? (
              <div className="flow-page-renderer__main-text">{textBlocks[0].value}</div>
            ) : (
              <div className="flow-page-renderer__empty">No text added yet</div>
            )}
          </div>
        );
    }
  };

  return (
    <section
      className={`flow-page-renderer flow-page-renderer--${mode}`}
      aria-label={mode === "gameplay" ? "Game page" : "Page preview"}
    >
      <div
        className="flow-page-renderer__background"
        style={
          page.useCustomBackground && backgroundPreviewUrl
            ? { backgroundImage: `url(${backgroundPreviewUrl})`, opacity: 1 }
            : { backgroundImage: "none", opacity: 0 }
        }
        aria-hidden="true"
      />

      <div className="flow-page-renderer__overlay">
        <header className="flow-page-renderer__header">
          <div className="flow-page-renderer__topbar">
            <div className="flow-page-renderer__badges">
              {showModifier ? (
                <span className="flow-page-renderer__badge">
                  {modifierDisplayText}
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

        <div className="flow-page-renderer__body">{renderLayout()}</div>

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