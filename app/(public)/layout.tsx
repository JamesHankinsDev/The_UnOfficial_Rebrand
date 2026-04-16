import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { NewsTicker } from '@/components/NewsTicker'
import { ScoresDrawer } from '@/components/ScoresDrawer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <NewsTicker />
      <main className="flex-1">{children}</main>
      <Footer />
      <ScoresDrawer />
    </>
  )
}
