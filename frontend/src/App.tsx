import { Navigate, Route, Routes } from "react-router-dom";

import ContentCreatePage from "./components/ContentCreatePage";
import ContentManagePage from "./components/ContentManagePage";
import ConversationPage from "./components/ConversationPage";
import OverviewStatsBar from "./components/OverviewStatsBar";
import SessionPage from "./components/SessionPage";

export default function App(): JSX.Element {
  return (
    <>
      <OverviewStatsBar />
      <Routes>
        <Route path="/session" element={<SessionPage />} />
        <Route path="/content/create" element={<ContentCreatePage />} />
        <Route path="/content/manage" element={<ContentManagePage />} />
        <Route path="/conversation" element={<ConversationPage />} />
        <Route path="*" element={<Navigate to="/session" replace />} />
      </Routes>
    </>
  );
}
