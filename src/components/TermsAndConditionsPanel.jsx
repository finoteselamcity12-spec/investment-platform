import { TERMS_HEADING, TERMS_SECTIONS } from '../lib/supportConfig'

export default function TermsAndConditionsPanel() {
  return (
    <div className="text-left text-sm leading-relaxed text-gray-800">
      <h3 className="text-base font-bold text-lime-800">{TERMS_HEADING}</h3>
      <div className="mt-4 space-y-4">
        {TERMS_SECTIONS.map((section) => (
          <section key={section.title}>
            <h4 className="font-semibold text-gray-900">{section.title}</h4>
            <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-lime-600">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
