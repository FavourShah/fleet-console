import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { LiveProvider } from "./lib/live";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import MapPage from "./pages/MapPage";
import Playback from "./pages/Playback";
import Alerts from "./pages/Alerts";
import Trips from "./pages/Trips";
import Geofences from "./pages/Geofences";
import Drivers from "./pages/Drivers";
import Import from "./pages/Import";
import Reports from "./pages/Reports";
import System from "./pages/System";
import Audit from "./pages/Audit";
import { Loading } from "./components/ui";

function Gate() {
  const { user, booting, can } = useAuth();
  if (booting) return <Loading text="Restoring session…" />;
  if (!user) return <Login />;
  return (
    <LiveProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/playback/:vehicleId?" element={<Playback />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/geofences" element={<Geofences />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/import" element={<Import />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/system" element={<System />} />
          <Route path="/audit" element={can("audit") ? <Audit /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Shell>
    </LiveProvider>
  );
}

export default function App() {
  return <AuthProvider><Gate /></AuthProvider>;
}
