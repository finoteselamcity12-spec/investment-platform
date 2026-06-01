import { useState } from 'react'
import { Mail, Phone, MessageCircle, Send } from 'lucide-react'

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
      // Store support message in localStorage for admin
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
    <div className="space-y-6">
      {/* Contact Methods Card */}
      <div className="app-card">
        <h3 className="text-lg font-bold text-white mb-4">Contact Us</h3>
        
        <div className="space-y-4">
          {/* Email */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 hover:border-sky-500/50 transition-all cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="bg-sky-600/20 border border-sky-600/50 rounded-lg p-3">
                <Mail className="text-sky-400" size={24} />
              </div>
              <div>
                <p className="font-semibold text-white">Email</p>
                <p className="text-sm text-slate-400 mt-1">support@astrawealth.com</p>
                <p className="text-xs text-slate-500 mt-2">Response time: 24 hours</p>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 hover:border-sky-500/50 transition-all cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="bg-green-600/20 border border-green-600/50 rounded-lg p-3">
                <Phone className="text-green-400" size={24} />
              </div>
              <div>
                <p className="font-semibold text-white">Phone</p>
                <p className="text-sm text-slate-400 mt-1">+251 XXX XXX XXXX</p>
                <p className="text-xs text-slate-500 mt-2">Mon - Fri: 9AM - 5PM (EAT)</p>
              </div>
            </div>
          </div>

          {/* Live Chat */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 hover:border-sky-500/50 transition-all cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="bg-purple-600/20 border border-purple-600/50 rounded-lg p-3">
                <MessageCircle className="text-purple-400" size={24} />
              </div>
              <div>
                <p className="font-semibold text-white">Live Chat</p>
                <p className="text-sm text-slate-400 mt-1">Available on website</p>
                <p className="text-xs text-slate-500 mt-2">Response time: 15 minutes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Form */}
      <div className="app-card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <MessageCircle size={20} className="text-sky-400" />
          Send a Message
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Info (Read-only) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">From</p>
            <p className="font-semibold text-white">{userFullName}</p>
            <p className="text-sm text-slate-400">{userEmail}</p>
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              rows="5"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSending}
            className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:shadow-lg hover:shadow-sky-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <Send size={18} />
            {isSending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>

      {/* FAQ Section */}
      <div className="app-card">
        <h3 className="text-lg font-bold text-white mb-4">Frequently Asked Questions</h3>

        <div className="space-y-3">
          {[
            {
              q: 'How long does deposit approval take?',
              a: 'Usually 15-30 minutes during business hours.',
            },
            {
              q: 'Can I withdraw anytime?',
              a: 'Yes, withdrawals are processed immediately when requested.',
            },
            {
              q: 'What is the minimum investment?',
              a: '$3 USD or 350 ETB is our minimum investment amount.',
            },
            {
              q: 'Are my funds secure?',
              a: 'Yes, all funds are securely stored and managed with blockchain technology.',
            },
          ].map((faq, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
              <p className="font-semibold text-white text-sm mb-2">{faq.q}</p>
              <p className="text-sm text-slate-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Alert */}
      <div className="app-card bg-blue-950/30 border border-blue-900/50 p-4 rounded-xl">
        <p className="text-sm text-blue-300">
          💡 <strong>Average Response Time:</strong> Our support team typically responds within 24 hours.
        </p>
      </div>
    </div>
  )
}
