import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Link, useLocation } from 'react-router-dom';
import { getUserRoles } from '../api/client';

const linkBase = 'rounded-lg px-3 py-2 text-sm font-medium transition-colors';
const linkIdle = `${linkBase} text-white/80 hover:text-white hover:bg-white/15`;
const linkActive = `${linkBase} text-white bg-white/15`;

export function Navbar() {
  const auth = useAuth();
  const location = useLocation();
  const userRoles = getUserRoles(auth.user?.access_token);
  const isAdmin = userRoles.includes('admin');

  const linkClass = (active: boolean) => active ? linkActive : linkIdle;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-indigo-700 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex-shrink-0">
          <Link to="/" className="text-white font-bold text-xl tracking-tight" onClick={closeMenu}>📅 BookIt</Link>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <Link to="/" className={linkClass(location.pathname === '/')}>Home</Link>
          {auth.isAuthenticated && (
            <>
              <Link to="/tenants" className={linkClass(location.pathname.startsWith('/tenants'))}>Spaces</Link>
              <Link to="/my-bookings" className={linkClass(location.pathname === '/my-bookings')}>My Bookings</Link>
              <Link to="/profile" className={linkClass(location.pathname === '/profile')}>Profile</Link>
              {isAdmin && (
                <Link to="/admin/users" className={linkClass(location.pathname === '/admin/users')}>Admin</Link>
              )}
            </>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3">
          {auth.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-white/90 text-sm">
                {auth.user?.profile.preferred_username ?? auth.user?.profile.name}
              </span>
              <button className="border border-white/40 text-white hover:bg-white/15 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer" onClick={() => auth.signoutRedirect()}>
                Sign out
              </button>
            </div>
          ) : (
            <button className="bg-white text-indigo-700 hover:bg-white/90 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer" onClick={() => auth.signinRedirect()}>
              Sign in
            </button>
          )}
        </div>
        <button
          className="md:hidden text-white p-2 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-indigo-700 border-t border-white/10 px-4 pb-4 space-y-1">
          <Link to="/" className={`block ${linkClass(location.pathname === '/')}`} onClick={closeMenu}>Home</Link>
          {auth.isAuthenticated && (
            <>
              <Link to="/tenants" className={`block ${linkClass(location.pathname.startsWith('/tenants'))}`} onClick={closeMenu}>Spaces</Link>
              <Link to="/my-bookings" className={`block ${linkClass(location.pathname === '/my-bookings')}`} onClick={closeMenu}>My Bookings</Link>
              <Link to="/profile" className={`block ${linkClass(location.pathname === '/profile')}`} onClick={closeMenu}>Profile</Link>
              {isAdmin && (
                <Link to="/admin/users" className={`block ${linkClass(location.pathname === '/admin/users')}`} onClick={closeMenu}>Admin</Link>
              )}
            </>
          )}
          <div className="border-t border-white/10 pt-3 mt-2 flex flex-col gap-2">
            {auth.isAuthenticated ? (
              <>
                <span className="text-white/90 text-sm px-3">
                  {auth.user?.profile.preferred_username ?? auth.user?.profile.name}
                </span>
                <button className="border border-white/40 text-white hover:bg-white/15 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer w-full" onClick={() => { closeMenu(); auth.signoutRedirect(); }}>
                  Sign out
                </button>
              </>
            ) : (
              <button className="bg-white text-indigo-700 hover:bg-white/90 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer w-full" onClick={() => { closeMenu(); auth.signinRedirect(); }}>
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
