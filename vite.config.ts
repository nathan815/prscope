import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/ado': {
        target: 'https://dev.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ado/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const pat = req.headers['x-ado-pat'] as string | undefined;
            if (pat) {
              proxyReq.setHeader(
                'Authorization',
                `Basic ${Buffer.from(':' + pat).toString('base64')}`
              );
              proxyReq.removeHeader('x-ado-pat');
            }
          });
        },
      },
      '/api/vssps': {
        target: 'https://vssps.dev.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vssps/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const pat = req.headers['x-ado-pat'] as string | undefined;
            if (pat) {
              proxyReq.setHeader(
                'Authorization',
                `Basic ${Buffer.from(':' + pat).toString('base64')}`
              );
              proxyReq.removeHeader('x-ado-pat');
            }
          });
        },
      },
    },
  },
})
