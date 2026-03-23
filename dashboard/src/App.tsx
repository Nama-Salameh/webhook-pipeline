import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import Overview from './pages/Overview';
import Events from './pages/Events';
import Deliveries from './pages/Deliveries';

const nav = [
  { to: '/', label: 'Overview' },
  { to: '/events', label: 'Events' },
  { to: '/deliveries', label: 'Deliveries' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-6 px-4 gap-1 shrink-0">
          <div className="px-2 mb-6">
            <span className="text-sm font-semibold text-gray-800">Webhook Pipeline</span>
            <p className="text-xs text-gray-400 mt-0.5">Dashboard</p>
          </div>
          {nav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/events" element={<Events />} />
            <Route path="/deliveries" element={<Deliveries />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
