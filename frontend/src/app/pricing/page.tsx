import { NavBar } from '@/components/layout/NavBar'
import { PricingSection } from '@/components/layout/PricingSection'
import { Footer } from '@/components/layout/Footer'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <main className="py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start free and upgrade as your needs grow. All plans include AI-powered
            cancer insights backed by peer-reviewed research.
          </p>
        </div>
        <PricingSection />
      </main>
      <Footer />
    </div>
  )
}
