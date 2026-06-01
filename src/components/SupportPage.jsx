import { useState } from 'react'
import { Mail, Phone, MessageCircle, Send, ExternalLink } from 'lucide-react'

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
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#84CC16]">Support Center</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Get Help & Support</h1>
          <p className="mt-2 text-slate-600">We're here to help. Reach out through any of these channels.</p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Telegram Direct Link */}
          <a
            href="https://t.me/investment_platform_3"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border-2 border-[#84CC16] bg-gradient-to-br from-green-50 to-emerald-50 p-6 transition-all hover:shadow-lg hover:shadow-[#84CC16]/20 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-950">Telegram</h3>
                <p className="mt-1 text-sm text-slate-600">Direct message support</p>
                <p className="mt-2 font-mono text-sm font-semibold text-[#84CC16]">@investment_platform_3</p>
              </div>
              <ExternalLink className="h-5 w-5 text-[#84CC16]" />
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:support@astrawealth.com"
            className="rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 transition-all hover:shadow-lg hover:shadow-blue-300/20 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-950">Email</h3>
                <p className="mt-1 text-sm text-slate-600">Response within 24 hours</p>
                <p className="mt-2 font-mono text-sm font-semibold text-blue-700">support@astrawealth.com</p>
              </div>
              <Mail className="h-5 w-5 text-blue-700" />
            </div>
          </a>

          {/* Phone */}
          <a
            href="tel:+251XXX"
            className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-6 transition-all hover:shadow-lg hover:shadow-purple-300/20 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-950">Phone</h3>
                <p className="mt-1 text-sm text-slate-600">Mon-Fri 9AM-5PM (EAT)</p>
                <p className="mt-2 font-mono text-sm font-semibold text-purple-700">+251 XXX XXX XXXX</p>
              </div>
              <Phone className="h-5 w-5 text-purple-700" />
            </div>
          </a>

          {/* Live Chat Info */}
          <div className="rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-950">Live Chat</h3>
                <p className="mt-1 text-sm text-slate-600">Response within 15 minutes</p>
                <p className="mt-2 font-mono text-sm font-semibold text-orange-700">Available on website</p>
              </div>
              <MessageCircle className="h-5 w-5 text-orange-700" />
            </div>
          </div>
        </div>

        {/* Message Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-950">Send Us a Message</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Info (Read-only) */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">From</p>
              <p className="mt-2 font-semibold text-slate-950">{userFullName}</p>
              <p className="text-sm text-slate-600">{userEmail}</p>
            </div>

            {/* Message Textarea */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Your Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or question in detail..."
                rows="6"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 placeholder-slate-400 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20 resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full rounded-full bg-[#84CC16] px-6 py-3 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send size={18} />
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>

        {/* FAQ Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-6 text-xl font-bold text-slate-950">Frequently Asked Questions</h2>

          <div className="space-y-4">
            {[
              { q: 'How long does deposit approval take?', a: 'Usually 15-30 minutes during business hours. After 5PM, deposits are processed the next business day.' },
              { q: 'Can I withdraw anytime?', a: 'Yes, you can request a withdrawal anytime. Processing typically takes 1-2 business days.' },
              { q: 'What is the minimum investment?', a: '$3 USD or 350 ETB is our minimum investment amount.' },
              { q: 'Are my funds secure?', a: 'Yes, all funds are securely stored and managed with blockchain technology and multi-signature security.' },
              { q: 'How are daily profits calculated?', a: 'Daily profits are calculated based on your investment tier and credited automatically to your wallet.' },
            ].map((faq, idx) => (
              <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="font-semibold text-slate-950">{faq.q}</p>
                <p className="mt-2 text-sm text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5">
          <p className="text-sm text-blue-900">
            <strong>📞 Response Guarantee:</strong> We aim to respond to all inquiries within 24 hours. For urgent issues, please contact us via Telegram.
          </p>
        </div>

        {/* Admin Operator Hidden Panel */}
        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400 opacity-60">Admin Operator Panel • Support Management System v1.0</p>
        </div>
      </div>
    </div>
  )
}
