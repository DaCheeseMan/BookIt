import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    question: 'Is BookIt really free to start?',
    answer:
      'Yes! Our free tier includes up to 3 resources and 100 bookings per month. No credit card required to sign up.',
  },
  {
    question: 'How does multi-tenancy work?',
    answer:
      'Each organisation (tenant) gets its own isolated space with its own resources, members, and booking history. Data is never shared between tenants.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use Keycloak for enterprise-grade OIDC authentication, per-tenant data isolation at the database level, and encrypted connections.',
  },
  {
    question: 'Can I cancel at any time?',
    answer:
      'Yes, you can cancel your subscription at any time. Your data remains accessible for 30 days after cancellation.',
  },
  {
    question: 'What types of resources can I book?',
    answer:
      'Anything! Saunas, sports courts, meeting rooms, boats, vehicles, desks — if it has a schedule, BookIt can manage it.',
  },
  {
    question: 'Do you offer a self-hosted option?',
    answer:
      'Yes, BookIt is open-source and can be self-hosted. Check our GitHub repository for deployment instructions.',
  },
  {
    question: 'How many users can I have?',
    answer:
      "There's no limit on users. Any number of members can join your organisation and make bookings.",
  },
  {
    question: 'What integrations are available?',
    answer:
      'We currently offer calendar export (iCal), webhook notifications, and REST API access. More integrations are on the roadmap.',
  },
]

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
  index: number
}

function FAQItem({ question, answer, isOpen, onToggle, index }: FAQItemProps) {
  const id = `faq-answer-${index}`
  const buttonId = `faq-button-${index}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.06 }}
      className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
    >
      <h3>
        <button
          id={buttonId}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={id}
          className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-slate-900 font-semibold hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 transition-colors cursor-pointer"
        >
          <span>{question}</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="flex-shrink-0 text-indigo-600"
            aria-hidden="true"
          >
            <ChevronDown size={20} />
          </motion.span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={id}
            role="region"
            aria-labelledby={buttonId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-0 text-slate-600 leading-relaxed text-sm border-t border-slate-100">
              <p className="pt-4">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  function toggle(i: number) {
    setOpenIndex((prev) => (prev === i ? null : i))
  }

  return (
    <section
      id="faq"
      className="py-20 sm:py-28 bg-white"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-4">
            FAQ
          </span>
          <h2
            id="faq-heading"
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-slate-500">
            Can&apos;t find what you&apos;re looking for? Reach out to our team.
          </p>
        </motion.div>

        {/* Accordion */}
        <div className="flex flex-col gap-3" role="list">
          {FAQS.map((faq, i) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
