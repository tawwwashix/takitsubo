// Keep these keys and their value shapes stable across site updates.
export const PARTY_KEY = 'takitsubo:episode-lab:party:v1';
export const COLLECTION_KEY = 'takitsubo:episode-lab:collection:v1';
const DEX_KEY = 'takitsubo:episode-lab:dex:v1';
const LEGACY_KEY = 'takitsubo:excavation:v1';

export function createLabStorage(byNumber, access = () => localStorage) {
  let available = true;
  function read(key, fallback) {
    return JSON.parse(access().getItem(key) ?? JSON.stringify(fallback));
  }
  function write(key, value) {
    try { access().setItem(key, JSON.stringify(value)); }
    catch (_) { available = false; }
  }
  return {
    get available() { return available; },
    readCollection() {
      try {
        const current = access().getItem(COLLECTION_KEY);
        // Import old discoveries only when no current record exists. Preserve
        // the legacy value for rollback; it has no role in current game rules.
        const saved = current === null ? read(LEGACY_KEY, []) : JSON.parse(current);
        const numbers = Array.isArray(saved) ? saved.filter(n => Number.isInteger(n) && byNumber.has(n)) : [];
        if (current === null && numbers.length) write(COLLECTION_KEY, [...new Set(numbers)]);
        return numbers;
      } catch (_) { available = false; return []; }
    },
    readParty(collection) {
      if (!available) return null; // Keep the in-memory party if storage fails.
      try {
        const saved = read(PARTY_KEY, []);
        return Array.isArray(saved)
          ? [...new Set(saved.filter(n => Number.isInteger(n) && byNumber.has(n) && collection.has(n)))].slice(0, 6)
          : [];
      } catch (_) { available = false; return null; }
    },
    readPreferences() {
      try {
        const saved = read(DEX_KEY, {});
        return {ascending:saved?.order === 'asc', showUnseen:saved?.showUnseen !== false};
      } catch (_) { available = false; return {ascending:false, showUnseen:true}; }
    },
    saveCollection: collection => write(COLLECTION_KEY, [...collection]),
    saveParty: party => write(PARTY_KEY, party),
    savePreferences: ({ascending, showUnseen}) => write(DEX_KEY, {order:ascending ? 'asc' : 'desc', showUnseen})
  };
}
