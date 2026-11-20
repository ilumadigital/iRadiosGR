import React from 'react';
import BrandLogo from './BrandLogo';
import {useLocation} from 'react-router-dom';

export default function AuthShell({ children }) {
  const {pathname}=useLocation();
  const mode=pathname==='/login'?'login':pathname==='/register'?'register':'other';
  return (
    <section className={'ir-auth-page ir-auth-page--'+mode}>
      <div className="ir-auth-shell">
        <aside className="ir-auth-story">
          <div className="ir-auth-story__brand">
            <BrandLogo variant="full" title="iRadios GR" width="200" height="56" />
          </div>
          <div className="ir-auth-story__body">
            <span className="ir-auth-eyebrow">YOUR SOUND. YOUR WORLD.</span>
            <h1>Ο κόσμος σου.<br /><em>Στη συχνότητά σου.</em></h1>
            <p>Οι αγαπημένοι σου σταθμοί, οι εκπομπές και η μουσική σου. Όλα σε ένα μέρος.</p>
            <div className="ir-auth-wave" aria-hidden="true">
              {Array.from({ length: 25 }, (_, i) => <i key={i} style={{ '--bar': i }} />)}
            </div>
          </div>
          <span className="ir-auth-story__foot">iRadiosGR <span>·</span> Listen beyond limits</span>
        </aside>
        <div className="ir-auth-content">
          <div className="ir-auth-mobile-brand">
            <BrandLogo variant="full" title="iRadios GR" width="190" height="52" />
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

export function AuthIntro({ icon: Icon, eyebrow, title, description }) {
  return (
    <header className="ir-auth-intro">
      <span className="ir-auth-intro__icon">{Icon && <Icon size={24} strokeWidth={2} />}</span>
      <span className="ir-auth-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
