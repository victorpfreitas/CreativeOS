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
import Login from './pages/Login';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider } from './lib/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
