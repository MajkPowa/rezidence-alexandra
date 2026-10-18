(() => {
  'use strict';
  const statuses = {
    available: { key: 'available', label: 'Volný', shortLabel: 'Volný' },
    reserved: { key: 'reserved', label: 'Rezervovaný', shortLabel: 'Rezervovaný' },
    sold: { key: 'sold', label: 'Prodaný', shortLabel: 'Prodaný' },
    unknown: { key: 'unknown', label: 'Dostupnost na dotaz', shortLabel: 'Na dotaz' }
  };
  window.AlexandraInventory = Object.freeze({
    status(unit) {
      const entries = window.ALEXANDRA_AVAILABILITY?.units;
      const id = unit?.id;
      const value = Number.isSafeInteger(id) && entries && Object.prototype.hasOwnProperty.call(entries, String(id)) ? entries[id] : null;
      const key = typeof value === 'string' ? value : value?.status;
      return { ...(Object.prototype.hasOwnProperty.call(statuses, key) ? statuses[key] : statuses.unknown) };
    }
  });
})();
