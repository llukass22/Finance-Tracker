// The database migration marker is authoritative. Retain the legacy copy for
// recovery, but never import it again after migration (including after deletions).
export function createPurchaseStorage(plugin, legacyStorage, source = 'localStorage.v1') {
  return {
    async reload(validate) {
      const state = await plugin.read({ source });
      if (!validate(state.purchases)) throw new Error('Invalid native purchases');
      return state.purchases;
    },
    async load(validate) {
      let state = await plugin.read({ source });
      if (!state.migrated) {
        const raw = legacyStorage.getItem('pocket.purchases.v1');
        const purchases = raw === null ? [] : JSON.parse(raw);
        if (!validate(purchases)) throw new Error('Invalid legacy purchases');
        state = await plugin.migrate({ purchases, source });
      }
      if (!validate(state.purchases)) throw new Error('Invalid native purchases');
      return state.purchases;
    },
    async save(previous, next, validate) {
      const old = new Map(previous.map(record => [record.id, record]));
      const ids = new Set(next.map(record => record.id));
      const upserts = next.filter(record => JSON.stringify(old.get(record.id)) !== JSON.stringify(record));
      const deletedIds = previous.filter(record => !ids.has(record.id)).map(record => record.id);
      const state = await plugin.applyChanges({ upserts, deletedIds });
      if (!validate(state.purchases)) throw new Error('Invalid native purchases');
      return state.purchases;
    },
  };
}
