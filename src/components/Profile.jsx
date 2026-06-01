import { useEffect, useState } from 'react'
import { Camera, UserCircle } from 'lucide-react'

export default function Profile({ ctx }) {
  const { userFullName, userEmail, showToast } = ctx
  const [profileImage, setProfileImage] = useState('')

  useEffect(() => {
    const storedImage = localStorage.getItem('user_profile_image')
    if (storedImage) {
      setProfileImage(storedImage)
    }
  }, [])

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setProfileImage(result)
        localStorage.setItem('user_profile_image', result)
        showToast('Profile picture updated.', 'success')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-white pb-24 pt-4">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Your Account</h1>
          <p className="mt-2 text-sm text-slate-500">Manage your profile information and profile picture.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="h-28 w-28 rounded-full object-cover shadow-md"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-700 shadow-md">
                  <UserCircle size={48} />
                </div>
              )}
              <label htmlFor="profile-upload" className="absolute bottom-0 right-0 inline-flex cursor-pointer items-center justify-center rounded-full bg-[#84CC16] p-2 text-white shadow-lg transition hover:bg-lime-500">
                <Camera size={18} />
              </label>
            </div>

            <div className="space-y-1 text-left">
              <p className="text-sm text-slate-500">Name</p>
              <p className="text-xl font-semibold text-slate-950">{userFullName || 'Account Holder'}</p>
            </div>

            <div className="space-y-1 text-left w-full">
              <p className="text-sm text-slate-500">Email</p>
              <p className="text-base font-medium text-slate-900">{userEmail || 'user@example.com'}</p>
            </div>

            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-950">Profile Tips</p>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>Upload a clear profile photo for a professional account view.</li>
            <li>Your email is used for support and account notifications.</li>
            <li>Profile details are saved locally in your browser.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
