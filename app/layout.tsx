import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://the-un-official.com'),
  title: 'The UnOfficial — NBA Analytics',
  description: 'Serious Fans, UnSerious Takes. NBA analytics without the spin.',
  openGraph: {
    siteName: 'The UnOfficial',
    images: ['/default-og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@TheUnOfficial',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#111118',
                color: '#e8e6e3',
                border: '1px solid #1e1e2a',
                fontFamily: 'Space Mono, monospace',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#fbbf24', secondary: '#0a0a0f' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#0a0a0f' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
