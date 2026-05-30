import { getCurrentWindow } from '@tauri-apps/api/window';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ThemeEditor from './components/views/ThemeEditor.tsx';
import { ConfigProvider } from './contexts/ConfigContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';
import './utils/debugLogger';
import { installSmoothScroll } from './utils/smoothScroll';

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'dark' || savedTheme === 'custom') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

installSmoothScroll();

if ((window as any).__TAURI_INTERNALS__) {
  getCurrentWindow()
    .onCloseRequested(async (event) => {
      event.preventDefault();
      await getCurrentWindow().hide();
    })
    .catch(() => null);
}

class ThemeEditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-bg-base text-text-primary p-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-[var(--radius-lg)] border border-danger/30 bg-danger/10 p-5">
          <h1 className="text-lg font-bold text-danger">Theme Editor failed to load</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {this.state.error.message || 'Unknown render error'}
          </p>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ConfigProvider>
        <ThemeProvider>
          <main className="text-text-primary bg-bg-base min-h-screen h-full font-sans transition-colors duration-300">
            <ThemeEditorErrorBoundary>
              <ThemeEditor />
            </ThemeEditorErrorBoundary>
          </main>
        </ThemeProvider>
      </ConfigProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
