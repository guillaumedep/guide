// Mise en forme JSON lisible : un ingrédient ou un temps par ligne.
export function formatRecipe(obj) {
  const fmt = (v, ind) => {
    const flat = JSON.stringify(v);
    if (v === null || typeof v !== 'object') return flat;
    const isLeafObj = !Array.isArray(v) && Object.values(v).every(x => x === null || typeof x !== 'object');
    if (isLeafObj && flat.length <= 220) {
      return '{ ' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + JSON.stringify(x)).join(', ') + ' }';
    }
    const pad = '  '.repeat(ind + 1), end = '  '.repeat(ind);
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (v.every(x => typeof x !== 'object') && flat.length <= 80) return flat.replace(/","/g, '", "');
      return '[\n' + v.map(x => pad + fmt(x, ind + 1)).join(',\n') + '\n' + end + ']';
    }
    return '{\n' + Object.entries(v).map(([k, x]) => pad + JSON.stringify(k) + ': ' + fmt(x, ind + 1)).join(',\n') + '\n' + end + '}';
  };
  return fmt(obj, 0) + '\n';
}
