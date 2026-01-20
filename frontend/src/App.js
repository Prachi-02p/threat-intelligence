// src/App.js
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from './pages/Dashboard';  // Default import
import Threats from "./pages/Threat";      // Default import
import Reports from "./pages/Report";      // Default import
import Settings from "./pages/Settings";   // Default import
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        
        {/* Navbar */}
        <header className="bg-white shadow p-4 flex flex-wrap items-center justify-between border-b">
          <h1 className="text-xl font-bold text-gray-800">Threat Intelligence - Dashboard</h1>

          <nav className="flex gap-4 mt-2 sm:mt-0">
            <NavLink 
              to="/" 
              className={({ isActive }) =>
                `font-medium text-gray-700 hover:text-blue-600 ${isActive ? 'text-blue-600' : ''}`
              }
            >
              Dashboard
            </NavLink>

            <NavLink 
              to="/threats" 
              className={({ isActive }) =>
                `font-medium text-gray-700 hover:text-blue-600 ${isActive ? 'text-blue-600' : ''}`
              }
            >
              Threats
            </NavLink>

            <NavLink 
              to="/reports" 
              className={({ isActive }) =>
                `font-medium text-gray-700 hover:text-blue-600 ${isActive ? 'text-blue-600' : ''}`
              }
            >
              Reports
            </NavLink>

            <NavLink 
              to="/settings" 
              className={({ isActive }) =>
                `font-medium text-gray-700 hover:text-blue-600 ${isActive ? 'text-blue-600' : ''}`
              }
            >
              Settings
            </NavLink>
          </nav>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/threats" element={<Threats />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;