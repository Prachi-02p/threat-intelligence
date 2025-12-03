import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import {Dashboard} from './pages/Dashboard/index'
import {Threats} from "./pages/Threat/index";
import {Reports} from "./pages/Report/index";
import {Settings} from "./pages/Settings/index";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Navbar */}
        <nav className="bg-white shadow p-4 flex gap-6 items-center border-b">
  <h1 className="text-xl font-bold text-gray-800">🧠 Threat Intelligence</h1>
  <div className="flex gap-4 ml-6">
    <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium ">Dashboard</Link>
    <Link to="/threats" className="text-gray-700 hover:text-blue-600 font-medium right-10">Threats</Link>
    <Link to="/reports" className="text-gray-700 hover:text-blue-600 font-medium">Reports</Link>
    <Link to="/settings" className="text-gray-700 hover:text-blue-600 font-medium">Settings</Link>
  </div>
</nav>

        

        {/* Page Content */}
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/threats" element={<Threats />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
