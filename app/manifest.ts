import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The UnOfficial — NBA Analytics',
    short_name: 'The UnOfficial',
    description: 'Serious Fans, UnSerious Takes. NBA analytics without the spin.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#fbbf24',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
