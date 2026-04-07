import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Toaster } from '@/components/ui/Toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cancer LLM Insights — AI-Powered Cancer Prevention & Guidance',
  description:
    'Evidence-based cancer risk insights, lifestyle guidance, and nutrition advice powered by AI. ' +
    'Supports text, audio, and video analysis in multiple languages.',
  keywords: 'cancer prevention, cancer insights, AI health, oncology, nutrition, lifestyle',
  openGraph: {
    title: 'Cancer LLM Insights',
    description: 'AI-powered cancer prevention and lifestyle guidance',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
