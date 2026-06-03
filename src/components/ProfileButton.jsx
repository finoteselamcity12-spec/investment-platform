import { useState } from 'react'
import { User } from 'lucide-react'
import ProfileModal from './ProfileModal'

export default function ProfileButton({ showToast }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
      >
        <User size={18} />
        Profile
      </button>

      <ProfileModal isOpen={isOpen} onClose={() => setIsOpen(false)} showToast={showToast} />
    </>
  )
}
