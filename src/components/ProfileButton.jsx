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
        className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
        aria-label="Open profile"
      >
        <User size={18} />
      </button>

      <ProfileModal isOpen={isOpen} onClose={() => setIsOpen(false)} showToast={showToast} />
    </>
  )
}
