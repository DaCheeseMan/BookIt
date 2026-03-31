import { motion } from 'framer-motion'
import { Building2, Calendar, Shield, Smartphone, Zap, Users } from 'lucide-react'

const FEATURES = [
  {
    icon: Building2,
    title: 'Multi-tenant workspaces',
    description:
      'One platform for every organisation. Each space is fully isolated with its own resources, members, and settings.',
  },
  {
    icon: Calendar,
    title: 'Smart scheduling',
    description:
      'Slot-based booking with automatic conflict prevention. Set slot durations and advance booking windows per resource.',
  },
  {
    icon: Shield,
    title: 'Secure by default',
    description:
      'Enterprise-grade security with Keycloak OIDC, per-tenant data isolation, and role-based access control.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-first',
    description:
      'Book from any device. The interface is optimised for touch with full responsiveness from 320px to 4K.',
  },
  {
    icon: Zap,
    title: 'Instant setup',
    description:
      'Create a space, add resources, and start accepting bookings in minutes. No technical knowledge required.',
  },
  {
    icon: Users,
    title: 'Team management',
    description:
      'Invite members, assign roles, and manage access across your organisation with fine-grained permissions.',
  },
]

export function Features() {
  return (
    <section
      id="features"
      className="py-20 sm:py-28 bg-white"
      aria-labelledby="features-heading"
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
            Features
          </span>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Everything you need to{' '}
            <span className="text-indigo-600">manage bookings</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            A complete booking platform that scales with your organisation, from a single
            sauna to hundreds of resources across multiple spaces.
          </p>
        </motion.div>

        {/* Feature cards grid */}
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          role="list"
          aria-label="Feature list"
        >
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.li
                key={feature.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
                className="group relative bg-white border border-slate-200 rounded-2xl p-7 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-200"
              >
                <div
                  className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors"
                  aria-hidden="true"
                >
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
