import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import Clubs from "@/pages/Clubs";
import ClubDetails from "@/pages/ClubDetails";
import Memories from "@/pages/Memories";
import Login from "@/pages/Login";
import MyRegistrations from "@/pages/MyRegistrations";
import AdminDashboard from "@/pages/AdminDashboard";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/events" element={<Events />} />
      <Route path="/events/:eventId" element={<EventDetails />} />
      <Route path="/clubs" element={<Clubs />} />
      <Route path="/clubs/:clubId" element={<ClubDetails />} />
      <Route path="/memories" element={<Memories />} />
      <Route path="/login" element={<Login />} />
      <Route path="/my-registrations" element={<MyRegistrations />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}
