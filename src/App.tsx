import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Automations from './pages/Automations';
import NewAutomation from './pages/NewAutomation';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="automations" element={<Automations />} />
          <Route path="automations/new" element={<NewAutomation />} />
          <Route path="*" element={<div className="p-8">Work in progress...</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
