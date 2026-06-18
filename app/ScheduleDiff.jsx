/* ScheduleDiffModal — compare old vs new Fuzzlecheck schedule and let the
   user pick which changes to apply to the location sheets.                  */

/* ---- diff computation --------------------------------------------------- */
function normLocName(s) {
  return (s || '').replace(/[‘’]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
}

function computeDiff(oldModel, newModel, edits) {
  const changes = [];

  const oldByName = {};
  oldModel.locations.forEach(l => { oldByName[normLocName(l.name)] = l; });
  const newByName = {};
  newModel.locations.forEach(l => { newByName[normLocName(l.name)] = l; });

  // Added locations
  newModel.locations.forEach(newLoc => {
    if (!oldByName[normLocName(newLoc.name)]) {
      changes.push({
        id: 'add_' + newLoc.id,
        type: 'location_added',
        newLoc,
        label: 'New location',
        detail: newLoc.name,
        sub: newLoc.sceneCount + ' scenes · ' + (newLoc.regions[0] || ''),
      });
    }
  });

  // Removed locations
  oldModel.locations.forEach(oldLoc => {
    if (!newByName[normLocName(oldLoc.name)]) {
      changes.push({
        id: 'rem_' + oldLoc.id,
        type: 'location_removed',
        oldLoc,
        label: 'Location removed from schedule',
        detail: oldLoc.name,
        sub: 'Your edits & photos are kept if you keep it',
      });
    }
  });

  // Changed locations
  newModel.locations.forEach(newLoc => {
    const oldLoc = oldByName[normLocName(newLoc.name)];
    if (!oldLoc) return;
    const edit = edits[oldLoc.id] || {};

    // Shoot date changes
    const oldDays = {};
    (oldLoc.shootDates || []).forEach(d => { oldDays[d.dayNumber] = d; });
    const newDays = {};
    (newLoc.shootDates || []).forEach(d => { newDays[d.dayNumber] = d; });

    Object.entries(newDays).forEach(([dayNum, newDay]) => {
      const oldDay = oldDays[dayNum];
      if (oldDay && oldDay.date !== newDay.date) {
        const ov = ((edit.dayOverrides || {})[String(dayNum)] || {});
        const hasOverride = ov.date && ov.date !== oldDay.date;
        changes.push({
          id: 'date_' + oldLoc.id + '_' + dayNum,
          type: 'date_change',
          oldLocId: oldLoc.id,
          newLocId: newLoc.id,
          locName: newLoc.name,
          dayNumber: dayNum,
          oldDate: oldDay.date,
          newDate: newDay.date,
          hasOverride,
          label: newLoc.name + ' · Day ' + dayNum,
          detail: fmtDate(oldDay.date) + '  →  ' + fmtDate(newDay.date),
          sub: hasOverride ? 'You have a manual date override on this day' : '',
        });
      }
    });

    // New shoot days
    Object.entries(newDays).forEach(([dayNum, newDay]) => {
      if (!oldDays[dayNum]) {
        changes.push({
          id: 'dayadd_' + oldLoc.id + '_' + dayNum,
          type: 'day_added',
          oldLocId: oldLoc.id,
          newLocId: newLoc.id,
          locName: newLoc.name,
          day: newDay,
          label: newLoc.name,
          detail: 'New shoot day: Day ' + dayNum + (newDay.date ? ' · ' + fmtDate(newDay.date) : ''),
          sub: '',
        });
      }
    });

    // Removed shoot days
    Object.entries(oldDays).forEach(([dayNum, oldDay]) => {
      if (!newDays[dayNum]) {
        changes.push({
          id: 'dayrem_' + oldLoc.id + '_' + dayNum,
          type: 'day_removed',
          oldLocId: oldLoc.id,
          newLocId: newLoc.id,
          locName: newLoc.name,
          day: oldDay,
          label: newLoc.name,
          detail: 'Shoot day removed: Day ' + dayNum + (oldDay.date ? ' · ' + fmtDate(oldDay.date) : ''),
          sub: '',
        });
      }
    });

    // Scene count change
    if (oldLoc.sceneCount !== newLoc.sceneCount) {
      const diff = newLoc.sceneCount - oldLoc.sceneCount;
      changes.push({
        id: 'sc_' + oldLoc.id,
        type: 'scene_count',
        oldLocId: oldLoc.id,
        newLocId: newLoc.id,
        locName: newLoc.name,
        label: newLoc.name,
        detail: 'Scenes: ' + oldLoc.sceneCount + '  →  ' + newLoc.sceneCount,
        sub: (diff > 0 ? '+' + diff : diff) + ' scenes',
      });
    }
  });

  return changes;
}

/* ---- apply selected changes to produce new state ------------------------ */
function applyDiff(oldModel, newModel, edits, removed, selectedIds) {
  const sel = new Set(selectedIds);

  // Carry edits by matching location name
  const oldByName = {};
  oldModel.locations.forEach(l => { oldByName[normLocName(l.name)] = l; });

  const newEdits = {};
  newModel.locations.forEach(newLoc => {
    const oldLoc = oldByName[normLocName(newLoc.name)];
    if (oldLoc && edits[oldLoc.id]) {
      newEdits[newLoc.id] = { ...edits[oldLoc.id] };
    }
  });

  // Apply date changes: clear manual dayOverrides so new schedule date shows
  const diff = computeDiff(oldModel, newModel, edits);
  diff.forEach(change => {
    if (!sel.has(change.id)) return;
    if (change.type === 'date_change') {
      const edit = newEdits[change.newLocId] || {};
      const ov = { ...(edit.dayOverrides || {}) };
      delete ov[String(change.dayNumber)]; // let the new schedule date show through
      newEdits[change.newLocId] = { ...edit, dayOverrides: ov };
    }
  });

  // Removed locations: mark as removed if change was selected
  const newRemoved = [];
  diff.forEach(change => {
    if (change.type === 'location_removed' && sel.has(change.id)) {
      // Find the location in new model (it won't be there, keep old as removed)
      newRemoved.push(change.oldLoc.id);
    }
  });

  // Keep existing removed locations that are still absent in new model
  (removed || []).forEach(id => {
    const oldLoc = oldModel.locations.find(l => l.id === id);
    if (oldLoc && !oldByName[normLocName(oldLoc.name)]) newRemoved.push(id);
  });

  const activeId = newModel.locations[0] ? newModel.locations[0].id : null;

  return {
    model: { ...newModel, scheduleName: newModel.scheduleName || oldModel.scheduleName },
    edits: newEdits,
    removed: [...new Set(newRemoved)],
    activeId,
    scheduleName: newModel.scheduleName || oldModel.scheduleName,
  };
}

/* ---- type labels + colours ---------------------------------------------- */
const CHANGE_STYLE = {
  location_added:   { color: 'oklch(0.56 0.09 150)', label: 'Added' },
  location_removed: { color: 'oklch(0.56 0.04 250)', label: 'Removed' },
  date_change:      { color: 'oklch(0.62 0.12 40)',  label: 'Date changed' },
  day_added:        { color: 'oklch(0.56 0.09 150)', label: 'Day added' },
  day_removed:      { color: 'oklch(0.56 0.04 250)', label: 'Day removed' },
  scene_count:      { color: 'oklch(0.64 0.10 70)',  label: 'Scenes changed' },
};

/* ---- modal UI ----------------------------------------------------------- */
function ScheduleDiffModal({ oldModel, newModel, edits, removed, onClose, onApply }) {
  const diff = React.useMemo(() => computeDiff(oldModel, newModel, edits), []);
  const [sel, setSel] = useState(() => new Set(diff.map(c => c.id)));

  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(sel.size === diff.length ? new Set() : new Set(diff.map(c => c.id)));

  const grouped = {};
  diff.forEach(c => { (grouped[c.type] = grouped[c.type] || []).push(c); });
  const typeOrder = ['location_added', 'location_removed', 'date_change', 'day_added', 'day_removed', 'scene_count'];

  if (diff.length === 0) return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(520px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="kicker">Schedule update</div><h3>No changes detected</h3></div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            The new schedule matches the current one — no locations, scenes or dates have changed.
          </div>
          <div className="modal-foot"><span /><button className="btn" onClick={onClose}>Close</button></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(640px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Schedule update</div>
            <h3>{diff.length} change{diff.length !== 1 ? 's' : ''} detected</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.6 }}>
            Tick the changes you want to apply to your location sheets. Your edits, photos and adjustments are always kept.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="btn sm ghost" onClick={toggleAll}>
              {sel.size === diff.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="exp-list" style={{ maxHeight: 400 }}>
            {typeOrder.filter(t => grouped[t]).map(type => {
              const style = CHANGE_STYLE[type] || {};
              return (
                <div className="exp-region" key={type}>
                  <div className="exp-region-h" style={{ cursor: 'default', pointerEvents: 'none' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: style.color, flexShrink: 0, display: 'inline-block', marginRight: 6 }} />
                    <span className="rn">{style.label}</span>
                    <span className="rc">{grouped[type].length}</span>
                  </div>
                  {grouped[type].map(change => (
                    <div className="exp-row" key={change.id} onClick={() => toggle(change.id)}>
                      <span className={'chk' + (sel.has(change.id) ? ' on' : '')}>
                        <Icon name="check" size={12} sw={2.4} />
                      </span>
                      <span className="nm" style={{ flex: 'none', minWidth: 160 }}>{change.label}</span>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)' }}>{change.detail}</span>
                      {change.sub && <span className="mono" style={{ fontSize: 9.5, color: change.hasOverride ? 'var(--accent)' : 'var(--ink-3)', marginLeft: 8 }}>{change.sub}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="modal-foot">
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{sel.size} of {diff.length} selected</span>
            <button className="btn" onClick={onClose} style={{ marginRight: 6 }}>Cancel</button>
            <button className="btn primary" onClick={() => onApply(applyDiff(oldModel, newModel, edits, removed, [...sel]))}>
              <Icon name="check" size={15} />Apply {sel.size} change{sel.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScheduleDiffModal = ScheduleDiffModal;
