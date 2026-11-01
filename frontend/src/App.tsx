import { Navigate, Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import Clubs from "@/pages/Clubs";
import ClubDetails from "@/pages/ClubDetails";
import Memories from "@/pages/Memories";
import Login from "@/pages/Login";
import MyRegistrations from "@/pages/MyRegistrations";
import AdminDashboard from "@/pages/AdminDashboard";
import ClubManagement from "@/pages/ClubManagement";
import ProtectedRoute from "@/auth/ProtectedRoute";
import Register from "@/pages/Register";
import { useAuth } from "@/auth/AuthContext";

function LandingRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-center text-slate-300">Checking your session…</p>;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Home />;
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/events" element={<Events />} />
      <Route path="/events/:eventId" element={<EventDetails />} />
      <Route path="/clubs" element={<Clubs />} />
      <Route path="/clubs/:clubId" element={<ClubDetails />} />
      <Route path="/clubs/:clubId/manage" element={<ProtectedRoute><ClubManagement /></ProtectedRoute>} />
      <Route path="/memories" element={<Memories />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/my-registrations" element={<ProtectedRoute><MyRegistrations /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
    </Routes>
  );
}
