import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface PricingProps {
  onGetStarted: () => void
}

const TIERS = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Perfect for small clubs and personal use.',
    features: [
      'Up to 3 resources',
      '1 organisation',
      '100 bookings/month',
      'Community support',
    ],
    cta: 'Get started free',
    highlighted: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 12,
    annualPrice: 10,
    description: 'For growing organisations that need more.',
    features: [
      'Unlimited resources',
      '5 organisations',
      'Unlimited bookings',
      'Email support',
      'Advanced analytics',
    ],
    cta: 'Start free trial',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Enterprise',
    monthlyPrice: 49,
    annualPrice: 39,
    description: 'For large organisations with advanced needs.',
    features: [
      'Everything in Pro',
      'Unlimited organisations',
      'Priority support',
      'Custom integrations',
      'SSO / SAML',
      'SLA guarantee',
    ],
    cta: 'Contact us',
    highlighted: false,
  },
]

export function Pricing({ onGetStarted }: PricingProps) {
  const [annual, setAnnual] = useState(false)

  return (
    <section
      id="pricing"
      className="py-20 sm:py-28 bg-slate-50"
      aria-labelledby="pricing-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-4">
            Pricing
          </span>
          <h2
            id="pricing-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Simple, transparent{' '}
            <span className="text-indigo-600">pricing</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            Start free and scale as you grow. No hidden fees.
          </p>

          {/* Billing toggle */}
          <div
            className="mt-8 inline-flex items-center gap-3 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm"
            role="group"
            aria-label="Billing period"
          >
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 cursor-pointer ${
                !annual
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              aria-pressed={!annual}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 cursor-pointer flex items-center gap-2 ${
                annual
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              aria-pressed={annual}
            >
              Annual
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.1 }}
              className={`relative flex flex-col rounded-2xl p-7 ${
                tier.highlighted
                  ? 'bg-white border-2 border-indigo-600 shadow-xl shadow-indigo-100'
                  : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              {/* Popular badge */}
              {tier.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Tier name + description */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{tier.description}</p>
              </div>

              {/* Price */}
              <div className="mb-7">
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-extrabold text-slate-900">
                    £{annual ? tier.annualPrice : tier.monthlyPrice}
                  </span>
                  <span className="text-slate-400 mb-1">/month</span>
                </div>
                {annual && tier.monthlyPrice > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Billed annually (£{tier.annualPrice * 12}/year)
                  </p>
                )}
              </div>

              {/* Features list */}
              <ul className="flex-1 flex flex-col gap-3 mb-8" aria-label={`${tier.name} features`}>
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-slate-700">
                    <Check
                      className="w-4 h-4 text-emerald-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={onGetStarted}
                className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer min-h-[44px] ${
                  tier.highlighted
                    ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-100 focus-visible:ring-amber-500'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 focus-visible:ring-indigo-600'
                }`}
                aria-label={`${tier.cta} — ${tier.name} plan`}
              >
                {tier.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
