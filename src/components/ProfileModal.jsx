import { useEffect, useState } from 'react'
import { Camera, Mail, UserCircle, X } from 'lucide-react'
import { getSession, updateUserProfile, getUserProfile, validators } from '../lib/authService'

export default function ProfileModal({ isOpen, onClose, showToast }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionEmail, setSessionEmail] = useState('')

  useEffect(() => {
    if (!isOpen) return
    loadProfileData()
  }, [isOpen])

  function loadProfileData() {
    const session = getSession()
    if (!session?.user?.email) return

    setSessionEmail(session.user.email)
    const profile = getUserProfile(session.user.email)
    const source = profile || session.user
    setFullName(source.fullName || '')
    setEmail(source.email || session.user.email || '')

    const storedImage = localStorage.getItem(`user_profile_image_${session.user.email}`)
    if (storedImage) {
      setProfileImage(storedImage)
    }
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file || !sessionEmail) return

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setProfileImage(result)
        localStorage.setItem(`user_profile_image_${sessionEmail}`, result)

        updateUserProfile(sessionEmail, {
          profileImage: result,
          updatedAt: new Date().toISOString(),
        })

        showToast('Profile picture updated successfully.', 'success')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!validators.fullName(fullName).valid) {
      showToast('Please enter a valid full name.', 'error')
      return
    }
    if (!validators.email(email).valid) {
      showToast('Please enter a valid email address.', 'error')
      return
    }
    if (!sessionEmail) {
      showToast('Unable to save profile. Session expired.', 'error')
      return
    }

    try {
      setLoading(true)
      const updatedProfile = updateUserProfile(sessionEmail, {
        fullName,
        email,
        profileImage: profileImage || null,
        updatedAt: new Date().toISOString(),
      })

      setFullName(updatedProfile.fullName || fullName)
      setEmail(updatedProfile.email || email)
      showToast('Profile saved successfully.', 'success')
    } catch (error) {
      console.error(error)
      showToast('Error saving profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</p>
            <h2 id="profile-modal-title" className="mt-1 text-xl font-semibold text-slate-950">
              Account details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
            aria-label="Close profile modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
              <div className="relative mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full bg-white shadow-sm">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-500">
                    <UserCircle size={52} />
                  </div>
                )}
              </div>
              <label
                htmlFor="profile-upload"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Camera size={16} />
                Add Profile Picture
              </label>
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Enter your email"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={loadProfileData}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
