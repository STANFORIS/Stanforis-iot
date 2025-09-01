  //  filter functions

  export function filterByQuery(items, query, fields){
  const q = query.toLowerCase();
  return items.filter(item => fields.some(f => (item[f]+'').toLowerCase().includes(q)));
}
export function filterByField(items, field, value){
  if(!value) return items;
  return items.filter(item => item[field] === value);
}
