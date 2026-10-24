// Pure selection/link rules. Never change the recipient's saved collection.
export function drawRound(episodes, previous, collection, random = Math.random) {
  const last = new Set(previous.map(ep => ep.number));
  let pool = episodes.filter(ep => !last.has(ep.number));
  if (pool.length < 3) pool = [...episodes];
  const unseen = pool.filter(ep => !collection.has(ep.number));
  const result = [];
  if (unseen.length && random() < .5) {
    const ep = unseen[Math.floor(random() * unseen.length)];
    result.push(ep); pool = pool.filter(item => item.number !== ep.number);
  }
  while (result.length < 3) result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  // The discovery slot must not always be the first cartridge.
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function readSharedParty(search, byNumber) {
  const params = new URLSearchParams(search);
  if (!params.has('party')) return {ids:null, invalid:false};
  const parts = params.get('party').split(',');
  if (parts.length > 6 || !parts.every(n => /^[1-9]\d*$/.test(n))) return {ids:null, invalid:true};
  const ids = parts.map(Number);
  if (new Set(ids).size !== ids.length || !ids.every(n => byNumber.has(n))) return {ids:null, invalid:true};
  return {ids, invalid:false};
}
