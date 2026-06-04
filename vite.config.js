import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const buildStamp =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 12) ||
  String(Date.now())

/** Inject build id into index.html so clients can detect stale shells */
function htmlBuildVersionPlugin() {
  return {
    name: 'html-build-version',
    transformIndexHtml(html) {
      const meta = `<meta name="app-build" content="${buildStamp}" />\n    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />\n    <meta http-equiv="Pragma" content="no-cache" />\n    <meta http-equiv="Expires" content="0" />`
      return html.replace('</head>', `    ${meta}\n  </head>`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), htmlBuildVersionPlugin()],
  define: {
    'import.meta.env.VITE_BUILD_STAMP': JSON.stringify(buildStamp),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
