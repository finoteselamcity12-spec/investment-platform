import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((reg) => reg.unregister()))

      const buildStamp = import.meta.env.VITE_BUILD_STAMP || 'dev'
      await navigator.serviceWorker.register(
        `/service-worker.js?build=${encodeURIComponent(buildStamp)}`,
        { updateViaCache: 'none' }
      )
    } catch (error) {
      console.warn('Service worker skipped:', error)
    }
  })
}
