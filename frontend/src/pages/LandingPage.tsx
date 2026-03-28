import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const resourceTypes = [
  { icon: '🧖', label: 'Sauna', desc: 'Wellness & relaxation facilities' },
  { icon: '🍽️', label: 'Restaurant', desc: 'Dining rooms and private event spaces' },
  { icon: '🏓', label: 'Sports court', desc: 'Tennis, padel, squash and more' },
  { icon: '⛵', label: 'Boat / dock', desc: 'Marinas, boats and watercraft' },
  { icon: '🚗', label: 'Vehicle', desc: 'Cars, vans and shared fleet' },
  { icon: '🏢', label: 'Meeting room', desc: 'Conference and co-working spaces' },
];

export function LandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleGetStarted() {
    if (auth.isAuthenticated) {
      navigate('/tenants');
    } else {
      auth.signinRedirect();
    }
  }

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1>📅 BookIt</h1>
          <p className="hero-tagline">Your resource, booked.</p>
          <p className="hero-sub">
            Create a bookable space for any resource — courts, saunas, boats, meeting rooms and more.
            Share the link, let people book.
          </p>
          <div className="hero-cta">
            <button className="cta-btn primary" onClick={handleGetStarted}>
              {auth.isAuthenticated ? 'Go to my spaces →' : 'Get started — create your space'}
            </button>
            {!auth.isAuthenticated && (
              <button className="cta-btn secondary" onClick={() => auth.signinRedirect()}>
                Sign in
              </button>
            )}
          </div>
        </div>
        <div className="hero-image" aria-hidden="true">📅</div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="section-content">
          <h2>Book anything</h2>
          <p className="section-lead">
            BookIt works for any type of bookable resource. Set your slot duration, advance booking window and go.
          </p>
          <div className="features-grid">
            {resourceTypes.map(r => (
              <div key={r.label} className="feature-card">
                <span className="feature-icon">{r.icon}</span>
                <strong>{r.label}</strong>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <div className="section-content">
          <h2>How it works</h2>
          <div className="steps-grid">
            <div className="step">
              <span className="step-num">1</span>
              <strong>Create a space</strong>
              <p>Sign in and create a tenant for your organisation or club.</p>
            </div>
            <div className="step">
              <span className="step-num">2</span>
              <strong>Add resources</strong>
              <p>Define each bookable resource, slot size and how far ahead people can book.</p>
            </div>
            <div className="step">
              <span className="step-num">3</span>
              <strong>Share & book</strong>
              <p>Share your space URL. Members sign in and book slots in the weekly calendar.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="cta-footer">
        <div className="section-content cta-footer-content">
          <h2>Ready to get started?</h2>
          <p>Create your first bookable space in minutes — no credit card required.</p>
          <button className="cta-btn primary cta-btn--large" onClick={handleGetStarted}>
            {auth.isAuthenticated ? 'Go to my spaces →' : 'Create your space →'}
          </button>
        </div>
      </section>
    </div>
  );
}
