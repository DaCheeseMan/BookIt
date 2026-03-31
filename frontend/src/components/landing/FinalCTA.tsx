import { motion } from 'framer-motion'

interface FinalCTAProps {
  onGetStarted: () => void
}

export function FinalCTA({ onGetStarted }: FinalCTAProps) {
  return (
    <section
      className="relative overflow-hidden py-20 sm:py-28 bg-gradient-to-br from-indigo-600 to-indigo-800"
      aria-labelledby="final-cta-heading"
    >
      {/* Decorative circles */}
      <div
        className="absolute top-0 right-0 w-72 h-72 bg-indigo-500 rounded-full opacity-30 blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 w-56 h-56 bg-indigo-900 rounded-full opacity-40 blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex flex-col items-center gap-6"
        >
          <h2
            id="final-cta-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight"
          >
            Ready to simplify your bookings?
          </h2>

          <p className="text-lg sm:text-xl text-indigo-200 max-w-xl">
            Join 500+ organisations already using BookIt. Start free, no credit card required.
          </p>

          <button
            onClick={onGetStarted}
            className="mt-2 px-10 py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-bold rounded-2xl text-lg transition-all shadow-xl shadow-amber-900/30 hover:shadow-amber-900/40 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-700 cursor-pointer min-h-[52px]"
            aria-label="Start using BookIt for free today"
          >
            Start for free today →
          </button>

          <p className="text-indigo-300 text-sm">
            No credit card required · Cancel anytime · Setup in 5 minutes
          </p>
        </motion.div>
      </div>
    </section>
  )
}
