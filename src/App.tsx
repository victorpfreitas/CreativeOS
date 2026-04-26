import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Component, Suspense, lazy, type ReactNode } from 'react';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider } from './lib/AuthContext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateContent = lazy(() => import('./pages/CreateContent'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ContentAnalysis = lazy(() => import('./pages/ContentAnalysis'));
const WeeklyPlanning = lazy(() => import('./pages/WeeklyPlanning'));
const Automations = lazy(() => import('./pages/Automations'));
const NewAutomation = lazy(() => import('./pages/NewAutomation'));
const AutomationDetail = lazy(() => import('./pages/AutomationDetail'));
const SlideshowEditor = lazy(() => import('./pages/SlideshowEditor'));
const Collections = lazy(() => import('./pages/Collections'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Login = lazy(() => import('./pages/Login'));

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

function PageFallback() {
  return (
    <div className="min-h-[320px] flex items-center justify-center text-slate-500">
      <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
    </div>
  );
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
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="create" element={<CreateContent />} />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
