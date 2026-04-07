import { NavBar } from '@/components/layout/NavBar'
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel'

export default function AnalysePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cancer Risk Analysis</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Describe your symptoms, lifestyle habits, or upload audio/video.
            Our AI will provide evidence-based cancer risk insights and personalised guidance.
          </p>
        </div>
        <AnalysisPanel />
      </main>
    </div>
  )
}
