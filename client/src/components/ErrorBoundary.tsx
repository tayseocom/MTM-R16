import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      localStorage.removeItem('mtm-project');
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full border rounded-md p-6 bg-card space-y-4" role="alert">
          <h1 className="text-xl font-bold text-destructive font-mono" data-testid="text-error-title">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            The app hit an unexpected error and needs to reload. Your saved project should still be in your browser.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto" data-testid="text-error-message">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={this.handleReload} data-testid="button-reload">
              Reload
            </Button>
            <Button variant="outline" onClick={this.handleClearAndReload} data-testid="button-clear-reload">
              Clear saved project &amp; reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
