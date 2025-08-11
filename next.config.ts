import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    const csp = [
      "default-src 'self'",
      // Allow Next.js runtime and dev eval in development; keep 'unsafe-eval' for dev only if needed
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' https://api.openai.com https://cdn.jsdelivr.net https://storage.googleapis.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), browsing-topics=(), clipboard-read=(), clipboard-write=(), display-capture=(), document-domain=(), encrypted-media=(), fullscreen=(self), gamepad=(), gyroscope=(), hid=(), idle-detection=(), interest-cohort=(), magnetometer=(), midi=(), payment=(), picture-in-picture=(self), publickey-credentials-get=(self), screen-wake-lock=(), serial=(), sync-xhr=(), usb=(), xr-spatial-tracking=()' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // HSTS is effective only over HTTPS; safe to include
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default nextConfig
