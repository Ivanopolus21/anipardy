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

  const showQuestionText =
    Boolean(page.showQuestionText) &&
    page.layout !== "text-1" &&
    page.layout !== "text-2" &&
    page.layout !== "text-5";

  const questionText = showQuestionText ? textBlocks[0]?.value || "" : "";
  const contentTextBlocks = showQuestionText ? textBlocks.slice(1) : textBlocks;

  const timerDisplay =
    typeof page.timerSeconds === "number" ? page.timerSeconds : 60;

  const showModifier = Boolean(page.enableModifier && page.modifierText?.trim());
  const isSecretModifier = Boolean(page.isSecretModifier);
  const modifierDisplayText = showModifier
    ? page.type === "question-step" && isSecretModifier
      ? "Secret modifier!"
      : page.modifierText
    : "";

  function renderMediaItem(item) {
    const previewUrl = mediaPreviewMap?.[item.id] || "";
    const caption = item.caption?.trim();

    if (!previewUrl) {
      return (
        <div className="flow-page-renderer__media-block">
          <div className="flow-page-renderer__media-placeholder">
            No media selected yet
          </div>
          {caption ? (
            <div className="flow-page-renderer__media-caption">{caption}</div>
          ) : null}
        </div>
      );
    }

    if (item.type === "image") {
      return (
        <div className="flow-page-renderer__media-block">
          <img
            src={previewUrl}
            alt={caption || item.name || "Uploaded image"}
            className="flow-page-renderer__image"
          />
          {caption ? (
            <div className="flow-page-renderer__media-caption">{caption}</div>
          ) : null}
        </div>
      );
    }

    if (item.type === "audio") {
      return (
        <div className="flow-page-renderer__media-block">
          <audio controls src={previewUrl} className="flow-page-renderer__audio" />
          {caption ? (
            <div className="flow-page-renderer__media-caption">{caption}</div>
          ) : null}
        </div>
      );
    }

    if (item.type === "video") {
      return (
        <div className="flow-page-renderer__media-block">
          <video controls src={previewUrl} className="flow-page-renderer__video" />
          {caption ? (
            <div className="flow-page-renderer__media-caption">{caption}</div>
          ) : null}
        </div>
      );
    }

    return null;
  }

  const renderTopQuestionText = () => {
    if (!showQuestionText) return null;

    return (
      <div className="flow-page-renderer__top-question">
        {questionText ? (
          <div className="flow-page-renderer__main-text">{questionText}</div>
        ) : (
          <div className="flow-page-renderer__empty">No question text added yet</div>
        )}
      </div>
    );
  };

  const renderLayout = () => {
    switch (page.layout) {
      case "text-1":
        return (
          <div className="flow-page-renderer__text-only">
            <div className="flow-page-renderer__text-card">
              {textBlocks[0]?.value ? (
                <div className="flow-page-renderer__main-text">{textBlocks[0].value}</div>
              ) : (
                <div className="flow-page-renderer__empty">No text added yet</div>
              )}
            </div>
          </div>
        );

      case "text-2":
        return (
          <div className="flow-page-renderer__text-grid flow-page-renderer__text-grid--2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={textBlocks[index]?.id || index}
                className="flow-page-renderer__text-card"
              >
                {textBlocks[index]?.value ? (
                  <div className="flow-page-renderer__main-text">
                    {textBlocks[index].value}
                  </div>
                ) : (
                  <div className="flow-page-renderer__empty">No text added yet</div>
                )}
              </div>
            ))}
          </div>
        );

      case "text-5": {
        const questionBlock = textBlocks[0];
        const optionBlocks = textBlocks.slice(1, 5);

        return (
          <div className="flow-page-renderer__quiz-layout">
            <div className="flow-page-renderer__quiz-question">
              {questionBlock?.value ? (
                <div className="flow-page-renderer__main-text">{questionBlock.value}</div>
              ) : (
                <div className="flow-page-renderer__empty">No question text added yet</div>
              )}
            </div>

            <div className="flow-page-renderer__text-grid flow-page-renderer__text-grid--4">
              {optionBlocks.map((block, index) => (
                <div
                  key={block?.id || index}
                  className="flow-page-renderer__text-card flow-page-renderer__option-card"
                >
                  {block?.value ? (
                    <div className="flow-page-renderer__main-text">{block.value}</div>
                  ) : (
                    <div className="flow-page-renderer__empty">No option text added yet</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "image-1":
      case "audio-1":
      case "video-1":
        return (
          <div className="flow-page-renderer__media-only">
            {mediaItems[0] ? renderMediaItem(mediaItems[0]) : (
              <div className="flow-page-renderer__media-placeholder">
                No media selected yet
              </div>
            )}
          </div>
        );

      case "image-2":
      case "image-3":
      case "image-4":
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

      case "image-audio": {
        const imageItem = mediaItems.find((item) => item.type === "image");
        const audioItem = mediaItems.find((item) => item.type === "audio");

        return (
          <div className="flow-page-renderer__split flow-page-renderer__split--stacked-media">
            <div className="flow-page-renderer__media-column">
              <div className="flow-page-renderer__media-cell">
                {imageItem ? renderMediaItem(imageItem) : (
                  <div className="flow-page-renderer__media-placeholder">
                    No image selected yet
                  </div>
                )}
              </div>

              <div className="flow-page-renderer__media-cell">
                {audioItem ? renderMediaItem(audioItem) : (
                  <div className="flow-page-renderer__media-placeholder">
                    No audio selected yet
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="flow-page-renderer__text-only">
            {contentTextBlocks[0]?.value ? (
              <div className="flow-page-renderer__main-text">
                {contentTextBlocks[0].value}
              </div>
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
          backgroundPreviewUrl
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

        <div className="flow-page-renderer__body">
          {renderTopQuestionText()}
          <div className="flow-page-renderer__layout">
            {renderLayout()}
          </div>
        </div>

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