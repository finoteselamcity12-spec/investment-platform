import { useEffect, useState } from 'react'
import { Camera, UserCircle, Mail, Shield } from 'lucide-react'
import { getSession, updateUserProfile, getUserProfile, validators } from '../lib/authService'

export default function Profile({ ctx }) {
  const { showToast } = ctx
  const [profileImage, setProfileImage] = useState('')
  const [userData, setUserData] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingEmail, setEditingEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const session = getSession()

  useEffect(() => {
    loadProfileData()
  }, [])

  function loadProfileData() {
    setLoading(true)
    try {
      if (session?.user?.email) {
        const profile = getUserProfile(session.user.email)
        const src = profile || session.user
        setUserData(src)
        setEditingName(src.fullName || '')
        setEditingEmail(src.email || session.user.email)
        
        const storedImage = localStorage.getItem(`user_profile_image_${session.user.email}`)
        if (storedImage) {
          setProfileImage(storedImage)
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setProfileImage(result)
        localStorage.setItem(`user_profile_image_${session.user.email}`, result)
        
        // Update profile in database
            updateUserProfile(session.user.email, {
              profileImage: result,
              updatedAt: new Date().toISOString(),
            })
        
        showToast('Profile picture updated successfully.', 'success')
      }
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-24 pt-4 flex items-center justify-center">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    )
  }

  const userFullName = userData?.fullName || session?.user?.fullName || 'Account Holder'
  const userEmail = userData?.email || session?.user?.email || 'user@example.com'

  const handleSave = async () => {
    // Basic validation
    if (!validators.fullName(editingName).valid) {
      showToast('Please enter a valid full name.', 'error')
      return
    }
    if (!validators.email(editingEmail).valid) {
      showToast('Please enter a valid email address.', 'error')
      return
    }

    try {
      setLoading(true)
      const updated = updateUserProfile(session.user.email, {
        fullName: editingName,
        email: editingEmail,
        profileImage: profileImage || userData?.profileImage || null,
        updatedAt: new Date().toISOString(),
      })

      setUserData((prev) => ({ ...prev, ...updated }))
      showToast('Profile saved successfully.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Error saving profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-slate-50 pb-24 pt-4">
      <div className="space-y-6 px-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Your Account</h1>
          <p className="mt-2 text-sm text-slate-500">Manage your profile information and settings.</p>
        </div>

        {/* Profile Picture Card - Glassmorphism */}
        <div className="rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="h-32 w-32 rounded-full object-cover shadow-lg ring-4 ring-lime-400/30"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-lime-100 to-lime-200 text-lime-700 shadow-lg ring-4 ring-lime-400/30">
                  <UserCircle size={64} />
                </div>
              )}
              <label htmlFor="profile-upload" className="absolute bottom-0 right-0 inline-flex cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-lime-400 to-lime-500 p-3 text-white shadow-lg transition hover:shadow-xl hover:scale-110 duration-200">
                <Camera size={20} />
              </label>
            </div>

              <div className="space-y-3 w-full">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Full Name</label>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest font-semibold">
                    <Mail size={14} />
                    Email
                  </label>
                  <input
                    value={editingEmail}
                    onChange={(e) => setEditingEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-white font-semibold"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(userData?.fullName || '')
                      setEditingEmail(userData?.email || session.user.email)
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700 font-semibold"
                  >
                    Reset
                  </button>
                </div>
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
      </div>
    </div>
  )
}
