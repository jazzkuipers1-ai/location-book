/* MobileNav — bottom tab bar shown only on mobile */

function MobileNav({ tabs, active, onSelect, onSync, syncProgress }) {
  return (
    <nav className="mobile-nav">
      {tabs.map(tab => (
        <button key={tab.id} className={'mobile-nav-btn' + (active === tab.id ? ' active' : '')} onClick={() => onSelect(tab.id)}>
          <Icon name={tab.icon} size={20} sw={active === tab.id ? 2 : 1.6} />
          {tab.label}
        </button>
      ))}
      {onSync && (
        <button className="mobile-nav-btn" onClick={onSync} disabled={!!syncProgress} title="Sync photos to cloud">
          <Icon name="upload" size={20} sw={1.6} />
          {syncProgress ? `${syncProgress.done}/${syncProgress.total}` : 'Sync'}
        </button>
      )}
    </nav>
  );
}

window.MobileNav = MobileNav;
