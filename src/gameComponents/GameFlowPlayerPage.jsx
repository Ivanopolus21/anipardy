import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameById, getMediaById, updateGame } from "../db.js";
import FlowPageRenderer from "../FlowPageRenderer.jsx";
import "../index.css";

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

function GameFlowPlayerPage() {
  const { id, flowId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [currentPageId, setCurrentPageId] = useState("");
  const [mediaPreviewMap, setMediaPreviewMap] = useState({});
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [lastScoreEvent, setLastScoreEvent] = useState(null);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [scoreAmount, setScoreAmount] = useState(0);
  const [isSubtractMode, setIsSubtractMode] = useState(false);

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
      setCurrentPageId(flowPages[0].id);
    }

    loadGame();
  }, [id, flowId, navigate]);

  const flowPages = useMemo(() => {
    return (game?.gameConfig?.pages || [])
      .filter((page) => page.flowId === flowId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [game, flowId]);

  const currentPage = useMemo(() => {
    return flowPages.find((page) => page.id === currentPageId) || null;
  }, [flowPages, currentPageId]);

  const isAnswerPage = currentPage?.type === "answer";

  const answerPage = useMemo(() => {
    return flowPages.find((page) => page.type === "answer") || null;
  }, [flowPages]);

  const firstQuestionPage = useMemo(() => {
    return flowPages.find((page) => page.type === "question-step") || null;
  }, [flowPages]);

  const linkedBoardPageId = useMemo(() => {
    return flowPages.find((page) => page.boardLink?.boardPageId)?.boardLink?.boardPageId || null;
  }, [flowPages]);

  const backgroundSourcePage = useMemo(() => {
    if (!currentPage) return null;

    if (currentPage.useCustomBackground && currentPage.backgroundMediaId) {
      return currentPage;
    }

    if (currentPage.type === "answer") {
      return (
        flowPages.find(
          (page) =>
            page.type === "question-step" &&
            page.useCustomBackground &&
            page.backgroundMediaId
        ) || null
      );
    }

    return null;
  }, [currentPage, flowPages]);

  const pageTitle = useMemo(() => {
    if (!currentPage) return "";

    if (
      currentPage.titleMode === "custom" &&
      currentPage.customTitle?.trim()
    ) {
      return currentPage.customTitle.trim();
    }

    return getAutoTitle(flowPages, game);
  }, [currentPage, flowPages, game]);

  const players = useMemo(() => {
    const rawPlayers =
      Array.isArray(game?.gameConfig?.players) && game.gameConfig.players.length > 0
        ? game.gameConfig.players
        : Array.isArray(game?.players) && game.players.length > 0
          ? game.players
          : [];

    return rawPlayers.map((player, index) => {
      if (typeof player === "string") {
        return {
          id: `player-${index}`,
          name: player.trim() || `Player ${index + 1}`,
          score: 0,
        };
      }

      return {
        id: player.id || `player-${index}`,
        name: player.name || player.title || `Player ${index + 1}`,
        score: player.score || 0,
      };
    });
  }, [game]);

  const inheritedBackgroundPage = useMemo(() => {
    if (!currentPage) return null;

    if (currentPage.useCustomBackground && currentPage.backgroundMediaId) {
      return currentPage;
    }

    if (currentPage.type === "answer") {
      return (
        flowPages.find(
          (page) =>
            page.type === "question-step" &&
            page.useCustomBackground &&
            page.backgroundMediaId
        ) || null
      );
    }

    return null;
  }, [currentPage, flowPages]);

  const pointsValue = useMemo(() => {
    if (!currentPage) return 0;

    if (
      currentPage.boardLink?.clueValue !== null &&
      currentPage.boardLink?.clueValue !== undefined
    ) {
      return Number(currentPage.boardLink.clueValue) || 0;
    }

    const linkedPage = flowPages.find(
      (page) =>
        page.boardLink?.clueValue !== null &&
        page.boardLink?.clueValue !== undefined
    );

    return Number(linkedPage?.boardLink?.clueValue) || 0;
  }, [currentPage, flowPages]);

  useEffect(() => {
    if (!currentPage) return;

    setTimerRunning(false);
    setTimeLeft(currentPage.enableTimer ? currentPage.timerSeconds ?? 60 : 60);
  }, [currentPage]);

  useEffect(() => {
    setScoreAmount(pointsValue || 0);
  }, [pointsValue, currentPageId]);

  useEffect(() => {
    if (!timerRunning || !currentPage?.enableTimer || timeLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setTimerRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerRunning, currentPage, timeLeft]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls = [];

    async function loadMediaPreviews() {
      if (!currentPage?.mediaItems?.length) {
        setMediaPreviewMap({});
        return;
      }

      const nextMap = {};

      for (const item of currentPage.mediaItems) {
        if (!item?.mediaId) continue;

        const mediaRecord = await getMediaById(item.mediaId);
        if (!mediaRecord?.blob) continue;

        const previewUrl = URL.createObjectURL(mediaRecord.blob);
        objectUrls.push(previewUrl);
        nextMap[item.id] = previewUrl;
      }

      if (!isCancelled) {
        setMediaPreviewMap(nextMap);
      }
    }

    loadMediaPreviews();

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [currentPage?.id, currentPage?.mediaItems]);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl = "";

    async function loadBackgroundPreview() {
      if (!backgroundSourcePage?.backgroundMediaId) {
        setBackgroundPreviewUrl("");
        return;
      }

      const mediaRecord = await getMediaById(backgroundSourcePage.backgroundMediaId);
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
  }, [backgroundSourcePage]);

  function startTimer() {
    if (!currentPage?.enableTimer || timerRunning || timeLeft <= 0) return;
    setTimerRunning(true);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimeLeft(currentPage?.enableTimer ? currentPage.timerSeconds ?? 60 : 60);
  }

  function goToAnswerPage() {
    if (!answerPage) return;
    setCurrentPageId(answerPage.id);
  }

  function goToQuestionPage() {
    if (!firstQuestionPage) return;
    setCurrentPageId(firstQuestionPage.id);
  }

  function getPlayersContainer(gameState) {
    if (Array.isArray(gameState?.gameConfig?.players)) return "gameConfig.players";
    if (Array.isArray(gameState?.players)) return "players";
    return "gameConfig.players";
  }

  async function onPlayerScore(playerId) {
    if (!game || !scoreAmount || isSavingScore) return;

    const numericAmount = Number(scoreAmount) || 0;
    if (!numericAmount) return;

    const delta = isSubtractMode ? -numericAmount : numericAmount;
    const container = getPlayersContainer(game);

    const sourcePlayers =
      container === "gameConfig.players"
        ? [...(game.gameConfig?.players || [])]
        : [...(game.players || [])];

    const updatedPlayers = sourcePlayers.map((player, index) => {
      const id = typeof player === "string" ? `player-${index}` : player.id || `player-${index}`;
      const currentScore = typeof player === "string" ? 0 : player.score || 0;

      if (id !== playerId) return player;

      if (typeof player === "string") {
        return {
          id,
          name: player,
          score: currentScore + delta,
        };
      }

      return {
        ...player,
        score: currentScore + delta,
      };
    });

    const updatedGame =
      container === "gameConfig.players"
        ? {
          ...game,
          gameConfig: {
            ...game.gameConfig,
            players: updatedPlayers,
          },
          updatedAt: Date.now(),
        }
        : {
          ...game,
          players: updatedPlayers,
          updatedAt: Date.now(),
        };

    setGame(updatedGame);
    setLastScoreEvent({ container, previousPlayers: sourcePlayers });
    setIsSavingScore(true);

    try {
      await updateGame(updatedGame);
    } finally {
      setIsSavingScore(false);
    }
  }

  async function undoLastScore() {
    if (!game || !lastScoreEvent || isSavingScore) return;

    const updatedGame =
      lastScoreEvent.container === "players"
        ? {
          ...game,
          players: lastScoreEvent.previousPlayers,
          updatedAt: Date.now(),
        }
        : {
          ...game,
          gameConfig: {
            ...game.gameConfig,
            players: lastScoreEvent.previousPlayers,
          },
          updatedAt: Date.now(),
        };

    setGame(updatedGame);
    setLastScoreEvent(null);
    setIsSavingScore(true);

    try {
      await updateGame(updatedGame);
    } finally {
      setIsSavingScore(false);
    }
  }

  if (!game || !currentPage) {
    return <p>Loading...</p>;
  }

  return (
    <div className="game-flow-player-page">
      <div className="game-flow-player-toolbar">
        <div className="game-flow-player-toolbar__left">
          <button
            type="button"
            className="game-flow-player-btn"
            onClick={() =>
              linkedBoardPageId
                ? navigate(`/play/${id}/board/${linkedBoardPageId}`)
                : navigate(`/game/${id}`)
            }
          >
            {linkedBoardPageId ? "Back to board" : "Back"}
          </button>
        </div>

        <div className="game-flow-player-toolbar__center">
          {currentPage.enableTimer ? (
            <div className="game-flow-player-toolbar__timer">
              <span className="game-flow-player-timer-value">{timeLeft}s</span>

              <button
                type="button"
                className="game-flow-player-btn game-flow-player-btn--primary"
                onClick={startTimer}
                disabled={timerRunning || timeLeft <= 0}
              >
                Start timer
              </button>

              <button
                type="button"
                className="game-flow-player-btn"
                onClick={resetTimer}
              >
                Reset
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="game-flow-player-stage">
        <FlowPageRenderer
          page={{
            ...currentPage,
            timerSeconds: timeLeft,
            useCustomBackground: Boolean(backgroundSourcePage?.backgroundMediaId),
            backgroundMediaId: backgroundSourcePage?.backgroundMediaId || "",
            backgroundName: backgroundSourcePage?.backgroundName || currentPage.backgroundName || "",
          }}
          pageTitle={pageTitle}
          mediaPreviewMap={mediaPreviewMap}
          backgroundPreviewUrl={backgroundPreviewUrl}
          mode="gameplay"
        />
      </div>

      {isAnswerPage && (
        <div className="game-flow-player-scoring-dock">
          <div className="game-flow-player-scoring-simple">
            <div className="game-flow-player-amount-row">
              <label className="game-flow-player-amount-label">
                Amount
              </label>
              <input
                type="number"
                value={scoreAmount}
                onChange={(e) => setScoreAmount(e.target.value)}
                className="game-flow-player-amount-input"
              />
              <label className="game-flow-player-subtract-toggle">
                <input
                  type="checkbox"
                  checked={isSubtractMode}
                  onChange={(e) => setIsSubtractMode(e.target.checked)}
                />
                Subtract
              </label>
            </div>

            <div className="game-flow-player-player-buttons">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="game-flow-player-player-btn"
                  onClick={() => onPlayerScore(player.id)}
                  disabled={isSavingScore}
                >
                  <span>{player.name}</span>
                  <span className="game-flow-player-player-score">
                    {player.score}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {!isAnswerPage ? (
        <button
          type="button"
          className="game-flow-player-answer-fab"
          onClick={goToAnswerPage}
        >
          Answer
        </button>
      ) : (
        <button
          type="button"
          className="game-flow-player-question-fab"
          onClick={goToQuestionPage}
        >
          Question
        </button>
      )}
    </div>
  );
}

export default GameFlowPlayerPage;