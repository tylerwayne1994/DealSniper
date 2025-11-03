// Run this in browser console to debug IDs
const stored = localStorage.getItem('equityNestListings');
if (stored) {
  const data = JSON.parse(stored);
  console.log('Next ID:', data.nextId);
  console.log('Properties:', data.properties.map(p => ({ 
    id: p.id, 
    type: typeof p.id, 
    title: p.title 
  })));
}
