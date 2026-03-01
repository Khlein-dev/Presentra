import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Session from "./pages/Session";
import Dashboard from "./pages/Dashboard";
import Footer from "./components/Footer";
import "bootstrap-icons/font/bootstrap-icons.css";

function App() {
  return (
    <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session" element={<Session />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        <Footer />
    </Router>
  );
}

export default App;