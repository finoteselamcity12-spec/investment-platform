import { Mail, MessageCircle, ExternalLink } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl rounded-[2rem] bg-white p-8 shadow-xl border border-slate-200">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Contact Us</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Need help? We’re here for you.</h1>
            <p className="mt-3 text-sm text-slate-600">If you encounter any issues, reach out through the channels below and our support team will respond quickly.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9F7D4] text-[#4D7C0F]">
                  <Mail size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-500">Email Support</p>
                  <p className="mt-2 text-lg font-bold text-slate-950">damot@gmail.com</p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9F7D4] text-[#4D7C0F]">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-500">Telegram</p>
                  <a
                    href="https://t.me/investment_platform_3"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-lg font-bold text-slate-950 underline decoration-[#84CC16]/40"
                  >
                    @investment_platform_3
                  </a>
                </div>
              </div>
            </article>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[#F7FBEE] p-6">
            <p className="text-sm font-semibold text-slate-600">Support Hours</p>
            <p className="mt-2 text-sm text-slate-700">Monday to Friday • 09:00 - 17:00 EAT</p>
            <p className="mt-3 text-sm text-slate-700">For urgent issues, email is the fastest way to get assistance.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
