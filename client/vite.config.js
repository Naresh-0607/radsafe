import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'apple-touch-icon-180x180.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        name: 'RadSafe Mobile Safety Operations',
        short_name: 'RadSafe',
        description:
          'Academic radiation safety monitoring, inspection checklists, and alert management for safety officers.',
        theme_color: '#13796c',
        background_color: '#0e1726',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Radiation Monitor',
            short_name: 'Monitor',
            description: 'Log new synthetic radiation reading',
            url: '/officer/radiation',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Safety Alerts',
            short_name: 'Alerts',
            description: 'Inspect active safety alerts',
            url: '/officer/alerts',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Zone Inspections',
            short_name: 'Inspections',
            description: 'Perform and complete safety checklists',
            url: '/officer/inspections',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/settings') ||
              url.pathname.startsWith('/api/zones') ||
              url.pathname.startsWith('/api/sensors'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'radsafe-api-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/dashboard') ||
              url.pathname.startsWith('/api/radiation') ||
              url.pathname.startsWith('/api/alerts'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'radsafe-api-dynamic',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 6, // 6 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
});
