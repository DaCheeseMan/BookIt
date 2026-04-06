import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

const TIERS = [
  {
    name: 'Free',
    price: '£0',
    description: 'Perfect for small clubs and personal use.',
    features: [
      '1 space',
      'Up to 3 resources per space',
      'Public space only',
      'Self-service bookings',
      'Community support',
    ],
    cta: null,
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '£12',
    priceSuffix: '/month',
    description: 'For growing organisations that need more.',
    features: [
      'Up to 5 spaces',
      'Up to 100 resources per space',
      'Public & private spaces',
      'Member invitations',
      'Email support',
    ],
    cta: { label: 'Contact us to upgrade', href: 'mailto:hello@bookit.app?subject=Upgrade%20to%20Pro' },
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Enterprise',
    price: '£49',
    priceSuffix: '/month',
    description: 'For large organisations with advanced needs.',
    features: [
      'Unlimited spaces',
      'Unlimited resources per space',
      'Public & private spaces',
      'Member invitations',
      'Priority support',
      'SLA guarantee',
    ],
    cta: { label: 'Contact us', href: 'mailto:hello@bookit.app?subject=Enterprise%20plan' },
    highlighted: false,
  },
];

export function UpgradePage() {
  const navigate = useNavigate();
  const auth = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        className="bg-transparent border-none text-indigo-600 cursor-pointer text-sm p-0 mb-6 block hover:underline"
        onClick={() => navigate(auth.isAuthenticated ? '/spaces' : '/')}
      >
        ← Back
      </button>

      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          Upgrade your plan
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Start free and scale as you grow. No hidden fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {TIERS.map(tier => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-2xl p-7 ${
              tier.highlighted
                ? 'bg-white border-2 border-indigo-600 shadow-xl shadow-indigo-100'
                : 'bg-white border border-slate-200 shadow-sm'
            }`}
          >
            {tier.badge && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                  {tier.badge}
                </span>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">{tier.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{tier.description}</p>
            </div>

            <div className="mb-7">
              <span className="text-4xl font-extrabold text-slate-900">{tier.price}</span>
              {tier.priceSuffix && <span className="text-slate-400 ml-1">{tier.priceSuffix}</span>}
            </div>

            <ul className="flex-1 flex flex-col gap-3 mb-8">
              {tier.features.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="text-emerald-500 text-base shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {tier.cta ? (
              <a
                href={tier.cta.href}
                className={`w-full py-3.5 rounded-xl font-semibold text-base text-center transition-all min-h-[44px] flex items-center justify-center no-underline ${
                  tier.highlighted
                    ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-100'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                }`}
              >
                {tier.cta.label}
              </a>
            ) : (
              <div className="w-full py-3.5 rounded-xl font-semibold text-base text-center bg-slate-100 text-slate-500 min-h-[44px] flex items-center justify-center">
                Your current plan
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
