import { useState } from 'react'
import { Mail, Phone, MessageCircle, Send, ExternalLink } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

export default function SupportPage({ ctx }) {
  const { userEmail, userFullName, showToast } = ctx
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!message.trim()) {
      showToast('Please enter a message', 'error')
      return
    }

    setIsSending(true)
    
    try {
      const supportMessages = JSON.parse(localStorage.getItem('support_messages') || '[]')
      supportMessages.push({
        id: `support-${Date.now()}`,
        userId: userEmail,
        userName: userFullName,
        message: message.trim(),
        createdAt: new Date().toISOString(),
        status: 'Unread',
      })
      localStorage.setItem('support_messages', JSON.stringify(supportMessages))

      showToast('Message sent! We will respond shortly.', 'success')
      setMessage('')
    } catch (error) {
      showToast('Error sending message. Please try again.', 'error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-white pb-4">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-slate-500">Help & Support</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Get Assistance</h1>
        </div>

        {/* Contact Methods - Mobile Stack */}
        <div className="space-y-3">
          {/* Telegram Direct Link */}
          <a
            href="https://t.me/investment_platform_3"
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-slate-200 bg-slate-50 p-5 active:scale-95 transition"
            style={{
              borderLeftWidth: '4px',
              borderLeftColor: PRIMARY_GREEN,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-950 flex items-center gap-2">
                  <MessageCircle size={20} style={{ color: PRIMARY_GREEN }} />
                  Telegram
                </h3>
                <p className="text-xs text-slate-500 mt-2">@investment_platform_3</p>
              </div>
              <ExternalLink size={20} style={{ color: PRIMARY_GREEN }} />
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:support@investmentplatform.com"
            className="block rounded-2xl border border-slate-200 bg-slate-50 p-5 active:scale-95 transition"
            style={{
              borderLeftWidth: '4px',
              borderLeftColor: PRIMARY_GREEN,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-950 flex items-center gap-2">
                  <Mail size={20} style={{ color: PRIMARY_GREEN }} />
                  Email Support
                </h3>
                <p className="text-xs text-slate-500 mt-2">support@investmentplatform.com</p>
              </div>
              <ExternalLink size={20} style={{ color: PRIMARY_GREEN }} />
            </div>
          </a>

          {/* Phone */}
          <a
            href="tel:+251XXX"
            className="block rounded-2xl border border-slate-200 bg-slate-50 p-5 active:scale-95 transition"
            style={{
              borderLeftWidth: '4px',
              borderLeftColor: PRIMARY_GREEN,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-950 flex items-center gap-2">
                  <Phone size={20} style={{ color: PRIMARY_GREEN }} />
                  Phone
                </h3>
                <p className="text-xs text-slate-500 mt-2">Mon-Fri, 9AM-5PM EAT</p>
              </div>
              <ExternalLink size={20} style={{ color: PRIMARY_GREEN }} />
            </div>
          </a>
        </div>

        {/* Message Form */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="mb-4 font-bold text-slate-950">Send Message</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Info */}
            <div className="rounded-2xl bg-white p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500">From</p>
              <p className="mt-1 font-bold text-slate-950 text-sm">{userFullName}</p>
              <p className="text-xs text-slate-500">{userEmail}</p>
            </div>

            {/* Message Textarea */}
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows="4"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none transition resize-none text-sm"
                style={{
                  focusBorder: `${PRIMARY_GREEN}80`,
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full rounded-2xl px-4 py-4 font-bold text-white active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                  backgroundColor: PRIMARY_GREEN,
                  boxShadow: `0 4px 12px ${PRIMARY_GREEN}30`,
                }}
            >
              <Send size={18} />
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="mb-4 font-bold text-slate-950">Quick Answers</h2>
          <div className="space-y-3">
            {[
              { q: 'How long does approval take?', a: '15-30 mins during business hours' },
              { q: 'Can I withdraw anytime?', a: 'Yes, 1-2 business days processing' },
              { q: 'Minimum investment?', a: '$3 USD or 350 ETB' },
              { q: 'Are funds secure?', a: 'Yes, blockchain secured & insured' },
              { q: 'How are profits calculated?', a: 'Automatically credited daily' },
            ].map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-950 text-sm">{faq.q}</p>
                <p className="mt-1 text-xs text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Operator Hidden Panel */}
        <div className="pt-4 mt-4 border-t border-slate-200 text-center opacity-40">
          <p className="text-xs text-slate-400">Admin Operator Panel • v1.0</p>
          <button
            onClick={() => ctx?.setShowAdminLogin && ctx.setShowAdminLogin(true)}
            className="mt-3 text-xs text-slate-600 underline"
            aria-label="Secret Admin Login"
          >
            Secret Login
          </button>
        </div>
      </div>
    </div>
  )
}
