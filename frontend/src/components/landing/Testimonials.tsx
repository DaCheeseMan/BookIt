import { motion } from 'framer-motion'

const TESTIMONIALS = [
  {
    quote:
      'BookIt transformed how we manage our marina. Members love the self-service booking.',
    name: 'Marcus L.',
    role: 'Marina Manager',
    company: 'Lakeside Marina',
    initials: 'ML',
    avatarColor: 'bg-indigo-600',
  },
  {
    quote:
      'We switched from spreadsheets to BookIt for our tennis courts. Setup took 10 minutes.',
    name: 'Sarah K.',
    role: 'Club Secretary',
    company: 'Greenfield FC',
    initials: 'SK',
    avatarColor: 'bg-emerald-500',
  },
  {
    quote:
      'The per-tenant isolation gives us confidence to run multiple organisations on one platform.',
    name: 'Tech Director',
    role: 'Technology',
    company: 'TechHub Berlin',
    initials: 'TD',
    avatarColor: 'bg-amber-500',
  },
]

function StarRating() {
  return (
    <div className="flex gap-0.5" aria-label="5 stars out of 5" role="img">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="text-amber-400 text-lg" aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="py-20 sm:py-28 bg-white"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-4">
            Testimonials
          </span>
          <h2
            id="testimonials-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Loved by organisations{' '}
            <span className="text-indigo-600">worldwide</span>
          </h2>
        </motion.div>

        {/* Cards */}
        <ul
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
          role="list"
          aria-label="Customer testimonials"
        >
          {TESTIMONIALS.map((t, i) => (
            <motion.li
              key={t.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.1 }}
              className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-7 flex flex-col gap-5"
            >
              <StarRating />

              <blockquote className="flex-1">
                <p className="text-slate-700 text-base leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </blockquote>

              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-full ${t.avatarColor} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                  aria-hidden="true"
                >
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
