import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DesignKit ErrorBoundary] Uncaught component error:', error, errorInfo)
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="tool-view" style={{ padding: 'var(--sp-6)' }}>
          <div
            className="card"
            style={{
              padding: 'var(--sp-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-3)',
              border: '1px solid var(--c-error-border, #FECACA)',
              background: 'var(--c-error-subtle, #FEF2F2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--c-error, #DC2626)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                {this.props.fallbackTitle || 'Tool Error'}
              </h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              This tool encountered an unexpected error. You can reset it or select another tool from the sidebar.
            </p>
            {this.state.error && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  padding: 'var(--sp-2) var(--sp-3)',
                  background: 'rgba(0, 0, 0, 0.04)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--c-text-primary)',
                  overflowX: 'auto',
                }}
              >
                {this.state.error.message || 'Unknown error'}
              </div>
            )}
            <div style={{ marginTop: 'var(--sp-2)', display: 'flex', gap: 'var(--sp-2)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={this.handleReset}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
