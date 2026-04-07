import { NavBar } from '@/components/layout/NavBar'
import { AuthForm } from '@/components/layout/AuthForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavBar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <AuthForm mode="login" />
      </div>
    </div>
  )
}
