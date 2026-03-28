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
        <Link to="/" onClick={closeMenu}>🎾 Jonsereds TK</Link>
      </div>
      <div className="navbar-links">
        <Link to="/" className={isActive('/')}>Hem</Link>
        <Link to="/courts" className={isActive('/courts')}>Banor</Link>
        {auth.isAuthenticated && (
          <>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>Mina Bokningar</Link>
            <Link to="/profile" className={isActive('/profile')}>Min Profil</Link>
            {isAdmin && (
              <Link to="/admin/users" className={isActive('/admin/users')}>Administrera</Link>
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
              Logga ut
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => auth.signinRedirect()}>
            Logga in
          </button>
        )}
      </div>
      <button
        className="navbar-hamburger"
        aria-label={menuOpen ? 'Stäng meny' : 'Öppna meny'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(o => !o)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      {menuOpen && (
        <div className="navbar-mobile-menu">
          <Link to="/" className={isActive('/')} onClick={closeMenu}>Hem</Link>
          <Link to="/courts" className={isActive('/courts')} onClick={closeMenu}>Banor</Link>
          {auth.isAuthenticated && (
            <>
              <Link to="/my-bookings" className={isActive('/my-bookings')} onClick={closeMenu}>Mina Bokningar</Link>
              <Link to="/profile" className={isActive('/profile')} onClick={closeMenu}>Min Profil</Link>
              {isAdmin && (
                <Link to="/admin/users" className={isActive('/admin/users')} onClick={closeMenu}>Administrera</Link>
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
                  Logga ut
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => { closeMenu(); auth.signinRedirect(); }}>
                Logga in
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
