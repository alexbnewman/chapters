import { existsSync, createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Your own history, written by `chapters build`. Never committed; public/chapters.json is the demo.
const own = resolve(__dirname, '../data/chapters.json')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'own-history',
      configureServer(server) {
        server.middlewares.use('/chapters.json', (_req, res, next) => {
          if (!existsSync(own)) return next()
          res.setHeader('content-type', 'application/json')
          createReadStream(own).pipe(res)
        })
      },
    },
  ],
  // Relative asset paths so the build works from a GitHub Pages subpath.
  base: './',
  server: {
    // Lets the page open at wt0.pb.test:5173; Vite refuses hostnames it wasn't told about.
    allowedHosts: ['.pb.test'],
    proxy: { '/api': 'http://localhost:8765' },
  },
})
