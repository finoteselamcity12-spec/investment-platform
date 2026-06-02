/**
 * Enterprise-Grade Authentication Service
 * Features: JWT tokens, Session timeout, Input validation, Security
 */

const JWT_SECRET = 'investment-platform-secret-key-2024'
const SESSION_TIMEOUT_MINUTES = 30
const SESSION_WARNING_MINUTES = 25

// JWT Token Generation (Simulated - in production, use backend)
export function generateJWT(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TIMEOUT_MINUTES * 60,
  }
  
  // Simulated JWT (in production, this would come from backend)
  const token = btoa(JSON.stringify(payload))
  return token
}

// JWT Token Validation
export function validateJWT(token) {
  try {
    const payload = JSON.parse(atob(token))
    const now = Math.floor(Date.now() / 1000)
    
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired', payload: null }
    }
    
    return { valid: true, error: null, payload }
  } catch (err) {
    return { valid: false, error: 'Invalid token', payload: null }
  }
}

// Session Management
export function createSession(user) {
  const session = {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      profileImage: user.profileImage || null,
    },
    token: generateJWT(user),
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60000).toISOString(),
  }
  
  sessionStorage.setItem('investment_platform_session', JSON.stringify(session))
  localStorage.setItem('user_email', user.email)
  
  // Set up session timeout warning
  setupSessionTimeout()
  
  return session
}

export function getSession() {
  const sessionData = sessionStorage.getItem('investment_platform_session')
  if (!sessionData) return null
  
  const session = JSON.parse(sessionData)
  const now = Date.now()
  
  if (new Date(session.expiresAt).getTime() < now) {
    clearSession()
    return null
  }
  
  return session
}

// Session Timeout Handler
function setupSessionTimeout() {
  // Clear any existing timeouts
  if (window.sessionTimeoutHandle) {
    clearTimeout(window.sessionTimeoutHandle)
  }
  if (window.sessionWarningHandle) {
    clearTimeout(window.sessionWarningHandle)
  }
  
  const warningDelay = Math.max(0, (SESSION_TIMEOUT_MINUTES - SESSION_WARNING_MINUTES) * 60000)
  
  window.sessionWarningHandle = setTimeout(() => {
    const event = new CustomEvent('sessionWarning', {
      detail: { message: 'Your session will expire in 5 minutes due to inactivity.' }
    })
    window.dispatchEvent(event)
  }, warningDelay)
  
  // Expiration at SESSION_TIMEOUT_MINUTES
  window.sessionTimeoutHandle = setTimeout(() => {
    clearSession()
    const event = new CustomEvent('sessionExpired', {
      detail: { message: 'Session expired. Please login again.' }
    })
    window.dispatchEvent(event)
  }, SESSION_TIMEOUT_MINUTES * 60 * 1000)
}

export function updateSessionActivity() {
  const session = getSession()
  if (!session) return
  
  session.lastActivity = new Date().toISOString()
  session.expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60000).toISOString()
  
  sessionStorage.setItem('investment_platform_session', JSON.stringify(session))
  setupSessionTimeout()
}

export function clearSession() {
  sessionStorage.removeItem('investment_platform_session')
  localStorage.removeItem('user_email')
}

// Input Validation (Server-side simulation)
export const validators = {
  email: (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
    return {
      valid: regex.test(String(email).trim()),
      error: !regex.test(String(email).trim()) ? 'Invalid email format' : null,
    }
  },
  
  password: (password) => {
    const checks = {
      length: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*]/.test(password),
    }
    
    const valid = checks.length && checks.hasUpperCase && checks.hasLowerCase && checks.hasNumber
    const errors = []
    
    if (!checks.length) errors.push('Password must be at least 8 characters')
    if (!checks.hasUpperCase) errors.push('Password must contain uppercase letter')
    if (!checks.hasLowerCase) errors.push('Password must contain lowercase letter')
    if (!checks.hasNumber) errors.push('Password must contain number')
    
    return { valid, errors: errors.length > 0 ? errors : null }
  },
  
  fullName: (name) => {
    const valid = name.trim().length >= 2
    return {
      valid,
      error: !valid ? 'Name must be at least 2 characters' : null,
    }
  },
  
  amount: (amount) => {
    const num = parseFloat(amount)
    const valid = num > 0 && num <= 10000000
    return {
      valid,
      error: !valid ? 'Invalid amount (0 - 10,000,000)' : null,
    }
  },
  
  transactionId: (txId) => {
    const valid = txId.trim().length >= 3
    return {
      valid,
      error: !valid ? 'Transaction ID must be at least 3 characters' : null,
    }
  },
  
  bankAccount: (account) => {
    const valid = account.trim().length >= 3
    return {
      valid,
      error: !valid ? 'Account number/name required' : null,
    }
  },
}

// Prevent XSS attacks
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  
  const div = document.createElement('div')
  div.textContent = input
  return div.innerHTML
}

// User Profile Data Management (Database simulation)
export function getUserProfile(email) {
  const usersData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  const profileData = localStorage.getItem(`profile_${email}`)
  
  if (!usersData[email]) {
    return null
  }
  
  return {
    ...usersData[email],
    profileImage: profileData ? JSON.parse(profileData).profileImage : null,
    createdAt: usersData[email].createdAt || new Date().toISOString(),
  }
}

export function updateUserProfile(email, profileData) {
  const usersData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  
  if (usersData[email]) {
    usersData[email] = {
      ...usersData[email],
      ...profileData,
    }
    localStorage.setItem('admin_user_data', JSON.stringify(usersData))
  }
  
  // Store additional profile data
  localStorage.setItem(`profile_${email}`, JSON.stringify(profileData))
  
  return usersData[email]
}

export default {
  generateJWT,
  validateJWT,
  createSession,
  getSession,
  updateSessionActivity,
  clearSession,
  validators,
  sanitizeInput,
  getUserProfile,
  updateUserProfile,
}
