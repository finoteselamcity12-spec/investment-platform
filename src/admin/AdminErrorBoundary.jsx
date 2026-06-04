import { Component } from 'react'

export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[AdminDashboard]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-error-fallback">
          <h1>Admin dashboard error</h1>
          <p>
            The admin panel encountered an error and was isolated so the rest of the app
            keeps running.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload admin panel
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
