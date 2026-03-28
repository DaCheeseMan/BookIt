import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Link, useLocation } from 'react-router-dom';
import { getUserRoles } from '../api/client';
import './Navbar.css';

export function Navbar() {
  const auth = useAuth();
  const location = useLocation();
  const userRoles = getUserRoles(auth.user?.access_token);
  const isAdmin = userRoles.includes('admin');

  const isActive = (path: string) => location.pathname === path ? 'active' : '';
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" onClick={closeMenu}>📅 BookIt</Link>
      </div>
      <div className="navbar-links">
        <Link to="/" className={isActive('/')}>Home</Link>
        {auth.isAuthenticated && (
          <>
            <Link to="/tenants" className={location.pathname.startsWith('/tenants') ? 'active' : ''}>Spaces</Link>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>My Bookings</Link>
            <Link to="/profile" className={isActive('/profile')}>Profile</Link>
            {isAdmin && (
              <Link to="/admin/users" className={isActive('/admin/users')}>Admin</Link>
            )}
          </>
        )}
      </div>
      <div className="navbar-auth">
        {auth.isAuthenticated ? (
          <div className="user-info">
            <span className="user-name">
              {auth.user?.profile.preferred_username ?? auth.user?.profile.name}
            </span>
            <button className="btn btn-outline" onClick={() => auth.signoutRedirect()}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => auth.signinRedirect()}>
            Sign in
          </button>
        )}
      </div>
      <button
        className="navbar-hamburger"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(o => !o)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      {menuOpen && (
        <div className="navbar-mobile-menu">
          <Link to="/" className={isActive('/')} onClick={closeMenu}>Home</Link>
          {auth.isAuthenticated && (
            <>
              <Link to="/tenants" className={location.pathname.startsWith('/tenants') ? 'active' : ''} onClick={closeMenu}>Spaces</Link>
              <Link to="/my-bookings" className={isActive('/my-bookings')} onClick={closeMenu}>My Bookings</Link>
              <Link to="/profile" className={isActive('/profile')} onClick={closeMenu}>Profile</Link>
              {isAdmin && (
                <Link to="/admin/users" className={isActive('/admin/users')} onClick={closeMenu}>Admin</Link>
              )}
            </>
          )}
          <div className="navbar-mobile-auth">
            {auth.isAuthenticated ? (
              <>
                <span className="user-name">
                  {auth.user?.profile.preferred_username ?? auth.user?.profile.name}
                </span>
                <button className="btn btn-outline" onClick={() => { closeMenu(); auth.signoutRedirect(); }}>
                  Sign out
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => { closeMenu(); auth.signinRedirect(); }}>
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
