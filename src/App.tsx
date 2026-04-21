import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Automations from './pages/Automations';
import NewAutomation from './pages/NewAutomation';
import AutomationDetail from './pages/AutomationDetail';
import SlideshowEditor from './pages/SlideshowEditor';
import Collections from './pages/Collections';
import Gallery from './pages/Gallery';
import Schedule from './pages/Schedule';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="automations" element={<Automations />} />
          <Route path="automations/new" element={<NewAutomation />} />
          <Route path="automations/:id" element={<AutomationDetail />} />
          <Route path="editor/:id" element={<SlideshowEditor />} />
          <Route path="collections" element={<Collections />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="schedule" element={<Schedule />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
