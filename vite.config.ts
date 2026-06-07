import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import https from 'https'
import http from 'http'
import type { Plugin } from 'vite'

// Lokal proxy-plugin — henter eksterne sider server-side og omgår CORS
function localProxyPlugin(): Plugin {
  return {
    name: 'local-recipe-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', (req, res) => {
        const targetUrl = new URL(req.url ?? '', `http://localhost`).searchParams.get('url')
        if (!targetUrl) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Mangler url parameter' }))
          return
        }

        const parsed = new URL(targetUrl)
        const client = parsed.protocol === 'https:' ? https : http

        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
          },
        }

        const proxyReq = client.request(options, (proxyRes) => {
          // Følg redirects
          if (proxyRes.statusCode && [301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.end(`REDIRECT:${proxyRes.headers.location}`)
            return
          }

          res.writeHead(proxyRes.statusCode ?? 200, {
            'Content-Type': proxyRes.headers['content-type'] ?? 'text/html',
            'Access-Control-Allow-Origin': '*',
          })
          proxyRes.pipe(res)
        })

        proxyReq.on('error', (e) => {
          if (!res.headersSent) {
            res.writeHead(500)
            res.end(JSON.stringify({ error: e.message }))
          }
        })

        proxyReq.setTimeout(12000, () => {
          proxyReq.destroy()
          if (!res.headersSent) {
            res.writeHead(504)
            res.end(JSON.stringify({ error: 'Timeout' }))
          }
        })

        proxyReq.end()
      })
    },
  }
}

export default defineConfig({
  // Relative stier, så appen virker både i roden og i en undermappe (fx GitHub Pages: /REPO/).
  base: './',
  plugins: [react(), tailwindcss(), localProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
