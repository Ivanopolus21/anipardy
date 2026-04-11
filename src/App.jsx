import "./App.css";
import { Routes, Route } from "react-router-dom";
import GameSetupPage from "./gameManagerComponents/pages/GameCreationPage.jsx";
import MainPage from "./gameManagerComponents/pages/MainPage.jsx";
import PlayerSetupPage from "./gameManagerComponents/pages/PlayerSetupPage.jsx";
import GameManagerPage from "./gameManagerComponents/pages/GameManagerPage.jsx";
import PageAddingPage from "./gameManagerComponents/pages/PageAddingPage.jsx";
import BoardSetupPage from "./gameManagerComponents/pages/BoardSetupPage.jsx";
import BoardEditorPage from "./gameManagerComponents/pages/BoardEditorPage.jsx";
import QuestionFlowEditorPage from "./gameManagerComponents/pages/QuestionFlowEditorPage.jsx";
import GameFlowPlayerPage from "../src/gameComponents/GameFlowPlayerPage.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/create" element={<GameSetupPage />} />
      <Route path="/game/:id/setup" element={<PlayerSetupPage />} />
      <Route path="/game/:id" element={<GameManagerPage />} />
      <Route path="/game/:id/pages/new" element={<PageAddingPage />} />
      <Route path="/game/:id/board/:pageId/setup" element={<BoardSetupPage />} />
      <Route path="/game/:id/board/:pageId" element={<BoardEditorPage />} />
      <Route path="/game/:id/flow/:flowId" element={<QuestionFlowEditorPage />} />
      <Route path="/game/:id/flow/:flowId/play" element={<GameFlowPlayerPage />} />
    </Routes>
  );
}

export default App;