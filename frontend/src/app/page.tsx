import Link from 'next/link'
import { HeroSection } from '@/components/layout/HeroSection'
import { FeaturesSection } from '@/components/layout/FeaturesSection'
import { PricingSection } from '@/components/layout/PricingSection'
import { DisclaimerBanner } from '@/components/layout/DisclaimerBanner'
import { NavBar } from '@/components/layout/NavBar'
import { Footer } from '@/components/layout/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <DisclaimerBanner />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <Footer />
    </div>
  )
}
