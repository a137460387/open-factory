import React from 'react';
import { RefreshCw } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { showToast } from '../../lib/toast';

interface ErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    showToast({
      kind: 'error',
      title: zhCN.errors.panelCrashed(this.props.name),
      message: error instanceof Error ? error.message : zhCN.errors.panelUnexpected,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-md border border-rose-300 bg-rose-50 p-4 text-center">
        <div className="text-sm font-semibold text-rose-900">{zhCN.errors.panelCouldNotRender(this.props.name)}</div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
          onClick={() => this.setState({ hasError: false })}
        >
          <RefreshCw size={16} />
          {zhCN.errors.reloadPanel}
        </button>
      </div>
    );
  }
}
