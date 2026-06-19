/* MobileNav — bottom tab bar shown only on mobile */

function MobileNav({ tabs, active, onSelect }) {
  return (
    <nav className="mobile-nav">
      {tabs.map(tab => (
        <button key={tab.id} className={'mobile-nav-btn' + (active === tab.id ? ' active' : '')} onClick={() => onSelect(tab.id)}>
          <Icon name={tab.icon} size={20} sw={active === tab.id ? 2 : 1.6} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

window.MobileNav = MobileNav;
