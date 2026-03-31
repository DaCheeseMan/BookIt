import { motion } from 'framer-motion'

const STEPS = [
  {
    number: '01',
    title: 'Create your space',
    description:
      'Sign up and create a tenant for your organisation or club in under 2 minutes.',
  },
  {
    number: '02',
    title: 'Add your resources',
    description:
      'Define bookable resources — courts, saunas, rooms, boats. Set slot durations and booking windows.',
  },
  {
    number: '03',
    title: 'Start accepting bookings',
    description:
      'Share your space URL with members. They sign in and book slots from the weekly calendar.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 bg-slate-50"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-4">
            How It Works
          </span>
          <h2
            id="how-it-works-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Up and running in{' '}
            <span className="text-indigo-600">three steps</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            No complex setup. No IT team required. Just sign up and start booking.
          </p>
        </motion.div>

        {/* Steps */}
        <ol
          className="relative flex flex-col lg:flex-row items-start lg:items-stretch gap-8 lg:gap-6"
          aria-label="Steps to get started"
        >
          {/* Connector line (desktop only) */}
          <div
            className="hidden lg:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-0.5 bg-indigo-200 z-0"
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <motion.li
              key={step.number}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.15 }}
              className="relative z-10 flex-1 flex flex-col items-center text-center"
            >
              {/* Number circle */}
              <div
                className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-extrabold shadow-lg shadow-indigo-200 mb-6 flex-shrink-0"
                aria-hidden="true"
              >
                {step.number}
              </div>

              <div className="max-w-xs">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed">{step.description}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
