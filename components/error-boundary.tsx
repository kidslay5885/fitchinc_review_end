"use client";

import React from "react";

interface Props {
  name: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}] 에러 발생:`, error);
    console.error(`[ErrorBoundary:${this.props.name}] 컴포넌트 스택:`, errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-300 bg-red-50 rounded-lg m-2">
          <div className="text-red-700 font-bold text-[14px] mb-1">
            [{this.props.name}] 렌더링 오류
          </div>
          <div className="text-red-600 text-[12px] mb-2">
            {this.state.error?.message}
          </div>
          {this.state.errorInfo?.componentStack && (
            <pre className="text-[10px] text-red-500 whitespace-pre-wrap max-h-[200px] overflow-y-auto bg-white p-2 rounded border">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-[12px]"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
