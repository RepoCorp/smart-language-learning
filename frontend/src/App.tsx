import { Navigate, Route, Routes } from "react-router-dom";

import SessionPage from "./components/SessionPage";

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/session" element={<SessionPage />} />
      <Route path="*" element={<Navigate to="/session" replace />} />
    </Routes>
  );
}
