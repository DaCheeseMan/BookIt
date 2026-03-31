import { motion, type Variants } from 'framer-motion'

interface HeroProps {
  onGetStarted: () => void
}

export function Hero({ onGetStarted }: HeroProps) {
  function handleSeeHowItWorks(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    const target = document.querySelector('#how-it-works')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  return (
    <section
      className="relative min-h-screen flex items-center bg-gradient-to-br from-indigo-50 to-white overflow-hidden pt-16"
      aria-label="Hero section"
    >
      {/* Decorative blobs */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100 rounded-full opacity-40 blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-100 rounded-full opacity-30 blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium border border-indigo-200">
              <span
                className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                aria-hidden="true"
              />
              Now open for early access
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-slate-900 leading-tight tracking-tight"
          >
            Effortless Booking{' '}
            <span className="text-indigo-600">for Any Space</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            The multi-tenant platform that lets any organisation create bookable resources —
            saunas, courts, meeting rooms, boats, and more.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={itemVariants}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-amber-200 hover:shadow-amber-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 cursor-pointer min-h-[44px]"
              aria-label="Start your free trial"
            >
              Start Free Trial
            </button>
            <a
              href="#how-it-works"
              onClick={handleSeeHowItWorks}
              className="w-full sm:w-auto px-8 py-4 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-2xl text-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 text-center min-h-[44px] flex items-center justify-center"
              aria-label="See how BookIt works"
            >
              See How It Works
            </a>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            variants={itemVariants}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-slate-500"
            aria-label="Trust signals"
          >
            {[
              'No credit card required',
              'Setup in 5 minutes',
              'Free plan available',
            ].map((item, i) => (
              <span key={item} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                )}
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold" aria-hidden="true">✓</span>
                  {item}
                </span>
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
