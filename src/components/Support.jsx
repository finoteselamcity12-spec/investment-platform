import { useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'

export default function Support({ ctx }) {
  const { showToast } = ctx
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleTelegramClick = () => {
    window.open('https://t.me/investment_platform_3', '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!email.trim() || !message.trim()) {
      showToast('Please enter your email and message.', 'error')
      return
    }

    setIsSending(true)
    try {
      const supportMessages = JSON.parse(localStorage.getItem('support_messages') || '[]')
      supportMessages.push({
        id: `support-${Date.now()}`,
        email: email.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('support_messages', JSON.stringify(supportMessages))

      showToast('Your message has been sent. We will respond shortly.', 'success')
      setEmail('')
      setMessage('')
    } catch (error) {
      showToast('Unable to send message. Please try again.', 'error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24 pt-4">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Help Center</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Support</h1>
          <p className="mt-2 text-sm text-slate-500">Reach out directly through Telegram or send us a message below.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleTelegramClick}
            className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-5 text-left transition hover:border-[#84CC16] hover:shadow-lg"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-[#84CC16]/10 text-[#84CC16]">
              <MessageCircle size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">Telegram</p>
              <p className="text-xs text-slate-500 mt-1">@investment_platform_3</p>
            </div>
          </button>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-[#84CC16]/10 text-[#84CC16]">
                <Mail size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">Email Support</p>
                <p className="text-xs text-slate-500 mt-1">Send your own message directly.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">Your Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />

              <label className="block text-sm font-medium text-slate-700">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows="5"
                placeholder="How can we help you today?"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />

              <button
                type="submit"
                disabled={isSending}
                className="w-full rounded-3xl bg-[#84CC16] px-4 py-3 text-sm font-semibold text-white transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
