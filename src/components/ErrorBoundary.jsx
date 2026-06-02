import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // You can log the error to an error reporting service here
    console.error('Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-6">
          <div className="max-w-xl text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-6">An unexpected error occurred while loading the app. Please try refreshing the page. If the problem persists contact support.</p>
            <pre className="text-xs text-left bg-gray-100 p-3 rounded overflow-auto">{String(this.state.error || '')}</pre>
            <div className="mt-6">
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-green-600 text-white rounded">Reload</button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
