import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Component, type ReactNode } from 'react';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ContentAnalysis from './pages/ContentAnalysis';
import WeeklyPlanning from './pages/WeeklyPlanning';
import Automations from './pages/Automations';
import NewAutomation from './pages/NewAutomation';
import AutomationDetail from './pages/AutomationDetail';
import SlideshowEditor from './pages/SlideshowEditor';
import Collections from './pages/Collections';
import Gallery from './pages/Gallery';
import Login from './pages/Login';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider } from './lib/AuthContext';

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { error: Error | null }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-slate-400 text-sm">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-slate-600">404</h1>
        <p className="text-slate-400">Page not found.</p>
        <a href="/" className="text-indigo-400 hover:underline">Go home</a>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="projects/:id/analysis" element={<ContentAnalysis />} />
                <Route path="projects/:id/planning" element={<WeeklyPlanning />} />
                <Route path="automations" element={<Automations />} />
                <Route path="automations/new" element={<NewAutomation />} />
                <Route path="automations/:id" element={<AutomationDetail />} />
                <Route path="editor/:id" element={<SlideshowEditor />} />
                <Route path="collections" element={<Collections />} />
                <Route path="gallery" element={<Gallery />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
