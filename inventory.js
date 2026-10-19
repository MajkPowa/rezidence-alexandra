(() => {
  'use strict';
  const statuses = {
    available: { key: 'available', label: 'Volný', shortLabel: 'Volný' },
    reserved: { key: 'reserved', label: 'Rezervovaný', shortLabel: 'Rezervovaný' },
    sold: { key: 'sold', label: 'Prodaný', shortLabel: 'Prodaný' },
    unknown: { key: 'unknown', label: 'Dostupnost na dotaz', shortLabel: 'Na dotaz' }
  };
  let inventory = { updatedAt: null, units: {}, parking: {} };
  let pending = null;
  let signature = '';
  function statusFor(collection, id) {
    const value = Object.prototype.hasOwnProperty.call(inventory[collection], String(id)) ? inventory[collection][id] : null;
    const key = typeof value === 'string' ? value : value?.status;
    return { ...(Object.prototype.hasOwnProperty.call(statuses, key) ? statuses[key] : statuses.unknown) };
  }
  function cleanEntries(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id]) => /^[A-Za-z0-9-]{1,12}$/.test(id)).map(([id, item]) => {
      const key = typeof item === 'string' ? item : item?.status;
      return [id, Object.prototype.hasOwnProperty.call(statuses, key) ? key : 'unknown'];
    }));
  }
  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetch('data/availability.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Availability unavailable');
        const data = await response.json();
        if (!data || typeof data !== 'object' || !data.units || !data.parking || Array.isArray(data.units) || Array.isArray(data.parking)) throw new Error('Invalid availability');
        const next = { updatedAt: typeof data.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data.updatedAt) ? data.updatedAt : null, units: cleanEntries(data.units), parking: cleanEntries(data.parking) };
        const nextSignature = JSON.stringify(next);
        if (nextSignature !== signature) {
          inventory = next; signature = nextSignature;
          document.dispatchEvent(new CustomEvent('alexandra:inventory-change', { detail: { updatedAt: next.updatedAt } }));
        }
        return true;
      } catch (_) {
        // Keep the last successfully loaded state; never invent a free unit.
        return false;
      } finally { pending = null; }
    })();
    return pending;
  }
  window.AlexandraInventory = Object.freeze({ status: unit => statusFor('units', unit?.id), parkingStatus: id => statusFor('parking', id), updatedAt: () => inventory.updatedAt, refresh });
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
