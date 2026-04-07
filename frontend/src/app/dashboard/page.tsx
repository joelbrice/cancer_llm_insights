import { NavBar } from '@/components/layout/NavBar'
import { Dashboard } from '@/components/dashboard/Dashboard'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <Dashboard />
      </main>
    </div>
  )
}
