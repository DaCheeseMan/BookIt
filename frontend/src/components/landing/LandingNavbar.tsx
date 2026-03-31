import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function LandingNavbar() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleGetStarted() {
    if (auth.isAuthenticated) {
      navigate('/tenants')
    } else {
      auth.signinRedirect()
    }
  }

  function handleLogin() {
    if (auth.isAuthenticated) {
      navigate('/tenants')
    } else {
      auth.signinRedirect()
    }
  }

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault()
    setMenuOpen(false)
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200/60'
            : 'bg-transparent'
        }`}
        role="banner"
      >
        <nav
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
            aria-label="BookIt home"
          >
            <span aria-hidden="true">📅</span>
            <span>BookIt</span>
          </a>

          {/* Desktop nav links */}
          <ul className="hidden md:flex items-center gap-1" role="list">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    scrolled
                      ? 'text-slate-700 hover:text-indigo-600 hover:bg-indigo-50'
                      : 'text-slate-800 hover:text-indigo-600 hover:bg-white/60'
                  }`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleLogin}
              className={`px-4 py-2 font-semibold rounded-xl text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 cursor-pointer ${
                scrolled
                  ? 'text-indigo-600 hover:bg-indigo-50'
                  : 'text-slate-800 hover:bg-white/60'
              }`}
              aria-label="Log in to your account"
            >
              Log In
            </button>
            <button
              onClick={handleGetStarted}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-semibold rounded-xl text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 shadow-sm cursor-pointer"
              aria-label="Get started for free"
            >
              Get Started Free
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-colors cursor-pointer"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </nav>
      </header>

      {/* Mobile drawer backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile slide-in drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-2xl transform transition-transform duration-300 md:hidden flex flex-col ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100">
          <span className="text-lg font-bold text-slate-900">
            <span aria-hidden="true">📅</span> BookIt
          </span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-4" aria-label="Mobile navigation">
          <ul className="flex flex-col gap-1" role="list">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
                  className="block px-4 py-3 rounded-xl text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-4 pb-6 flex flex-col gap-3">
          <button
            onClick={() => { setMenuOpen(false); handleLogin() }}
            className="w-full py-3 bg-white hover:bg-slate-50 text-indigo-600 font-semibold rounded-xl text-base transition-colors border-2 border-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 cursor-pointer"
            aria-label="Log in to your account"
          >
            Log In
          </button>
          <button
            onClick={() => { setMenuOpen(false); handleGetStarted() }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 cursor-pointer"
            aria-label="Get started for free"
          >
            Get Started Free
          </button>
        </div>
      </div>
    </>
  )
}
