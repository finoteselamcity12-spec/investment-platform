import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from './AppShell'
import HomePage from './HomePage'
import InvestPage from './InvestPage'
import DepositPage from './DepositPage'
import HistoryPage from './HistoryPage'
import Support from './Support'
import Profile from './Profile'
import AdminPanel from './AdminPanel'
import Withdraw from '../pages/Withdraw'
import { getSession, updateSessionActivity, clearSession, getUserProfile } from '../lib/authService'

export default function MainApp() {
  const [activePage, setActivePage] = useState('home')
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [sessionWarningVisible, setSessionWarningVisible] = useState(false)
  const [userFullName, setUserFullName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [usdBalance, setUsdBalance] = useState(0)
  const [etbBalance, setEtbBalance] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    // Check session on mount
    const session = getSession()
    if (!session) {
      navigate('/login')
      return
    }

    loadUserData()

    // Listen for session events
    const handleSessionWarning = () => {
      setSessionWarningVisible(true)
      showToast('Your session will expire in 5 minutes due to inactivity.', 'warning')
    }

    const handleSessionExpired = () => {
      clearSession()
      showToast('Session expired. Please login again.', 'error')
      setTimeout(() => navigate('/login'), 2000)
    }

    window.addEventListener('sessionWarning', handleSessionWarning)
    window.addEventListener('sessionExpired', handleSessionExpired)

    // Update session activity on user interaction
    const handleUserActivity = () => {
      updateSessionActivity()
      setSessionWarningVisible(false)
    }

    document.addEventListener('click', handleUserActivity)
    document.addEventListener('scroll', handleUserActivity)
    document.addEventListener('keydown', handleUserActivity)

    return () => {
      window.removeEventListener('sessionWarning', handleSessionWarning)
      window.removeEventListener('sessionExpired', handleSessionExpired)
      document.removeEventListener('click', handleUserActivity)
      document.removeEventListener('scroll', handleUserActivity)
      document.removeEventListener('keydown', handleUserActivity)
    }
  }, [navigate])

  function loadUserData() {
    const session = getSession()
    if (session?.user?.email) {
      setUserEmail(session.user.email)
      setUserFullName(session.user.fullName)

      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const userRecord = userData[session.user.email]
      if (userRecord) {
        setUsdBalance(userRecord.usdBalance || 0)
        setEtbBalance(userRecord.etbBalance || 0)
      }
    }
  }

  function showToast(message, type = 'success') {
    setToastType(type)
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3200)
  }

  const ctx = {
    userFullName,
    userEmail,
    usdBalance,
    etbBalance,
    setActivePage,
    showToast,
  }

  const renderPage = (ctx) => {
    switch (activePage) {
      case 'home':
        return <HomePage ctx={ctx} />
      case 'deposit':
        return <DepositPage ctx={ctx} />
      case 'invest':
        return <InvestPage ctx={ctx} />
      case 'history':
        return <HistoryPage ctx={ctx} />
      case 'withdraw':
        return <Withdraw />
      case 'support':
        return <Support ctx={ctx} />
      case 'profile':
        return <Profile ctx={ctx} />
      case 'admin':
        return <AdminPanel />
      default:
        return <HomePage ctx={ctx} />
    }
  }

  return (
    <>
      <AppShell activePage={activePage} setActivePage={setActivePage}>
        {renderPage}
      </AppShell>

      {/* Session Warning Toast */}
      {sessionWarningVisible && (
        <div className="fixed top-4 right-4 max-w-md bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg z-50 animate-slide-in">
          <p className="text-sm font-semibold text-yellow-900">Session Expiring Soon</p>
          <p className="text-xs text-yellow-700 mt-1">Your session will expire in 5 minutes due to inactivity. Stay active to continue.</p>
        </div>
      )}

      {/* Toast Notifications */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md px-4 py-3 rounded-lg font-semibold shadow-lg z-50 animate-slide-in ${
            toastType === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : toastType === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : toastType === 'warning'
              ? 'bg-yellow-50 text-yellow-900 border border-yellow-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </>
  )
}
