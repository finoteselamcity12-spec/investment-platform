import { Mail } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'
const TELEGRAM_USERNAME = '@BlackrockSupport'
const TELEGRAM_URL = 'https://t.me/BlackrockSupport'
const SUPPORT_EMAIL = 'damot@gmail.com'

const GOAL_TEXT =
  'Blackrock Investment is a long-term, sustainable platform built to provide consistent growth. We are committed to transparency and the security of your assets, ensuring a reliable investment experience for all our users.'

function TelegramIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

export default function Support() {
  return (
    <div className="min-h-screen bg-white pb-24 pt-4">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <header>
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: PRIMARY_GREEN }}
          >
            Contact Us
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Support</h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#84CC16] hover:shadow-md"
          >
            <span
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: PRIMARY_GREEN }}
            >
              <TelegramIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Telegram</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{TELEGRAM_USERNAME}</p>
              <p className="mt-1 text-xs text-slate-500">Message us on Telegram</p>
            </div>
          </a>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#84CC16] hover:shadow-md"
          >
            <span
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: PRIMARY_GREEN }}
            >
              <Mail size={26} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Email</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
                Send us an email at:{' '}
                <span className="font-bold text-slate-950">{SUPPORT_EMAIL}</span>
              </p>
            </div>
          </a>
        </div>

        <section className="rounded-2xl border border-[#84CC16]/30 bg-[#84CC16]/5 p-6">
          <h2 className="text-lg font-bold text-slate-950">Our Goal</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700 sm:text-base">
            {GOAL_TEXT}
          </p>
        </section>
      </div>
    </div>
  )
}
