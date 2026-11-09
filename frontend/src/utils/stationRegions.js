// Listener navigation regions. Stations may store either a prefecture or a wider region.
const REGIONAL_GROUPS = [
  { label: 'Αττική', areas: ['Αθήνα', 'Πειραιάς', 'Ανατολική Αττική', 'Δυτική Αττική'], cities: ['Αθήνα', 'Πειραιάς', 'Καλλιθέα', 'Γλυφάδα', 'Μαρούσι'] },
  { label: 'Κεντρική Μακεδονία', areas: ['Ημαθία', 'Θεσσαλονίκη', 'Κιλκίς', 'Πέλλα', 'Πιερία', 'Σέρρες', 'Χαλκιδική'], cities: ['Βέροια', 'Κατερίνη', 'Έδεσσα', 'Γιαννιτσά'] },
  { label: 'Ανατολική Μακεδονία & Θράκη', aliases: ['Ανατολική Μακεδονία και Θράκη', 'Αν. Μακεδονία & Θράκη'], areas: ['Δράμα', 'Έβρος', 'Καβάλα', 'Ξάνθη', 'Ροδόπη', 'Θάσος'], cities: ['Αλεξανδρούπολη', 'Κομοτηνή'] },
  { label: 'Δυτική Μακεδονία', areas: ['Γρεβενά', 'Καστοριά', 'Κοζάνη', 'Φλώρινα'], cities: ['Πτολεμαΐδα'] },
  { label: 'Ήπειρος', areas: ['Άρτα', 'Θεσπρωτία', 'Ιωάννινα', 'Πρέβεζα'], cities: ['Ηγουμενίτσα', 'Πάργα'] },
  { label: 'Θεσσαλία', areas: ['Καρδίτσα', 'Λάρισα', 'Μαγνησία', 'Τρίκαλα', 'Σποράδες'], cities: ['Βόλος', 'Καλαμπάκα'] },
  { label: 'Στερεά Ελλάδα', aliases: ['Κεντρική Ελλάδα'], areas: ['Βοιωτία', 'Εύβοια', 'Ευρυτανία', 'Φθιώτιδα', 'Φωκίδα'], cities: ['Χαλκίδα', 'Λαμία', 'Λιβαδειά', 'Θήβα'] },
  { label: 'Δυτική Ελλάδα', areas: ['Αιτωλοακαρνανία', 'Αχαΐα', 'Ηλεία'], cities: ['Πάτρα', 'Αγρίνιο', 'Πύργος', 'Μεσολόγγι'] },
  { label: 'Πελοπόννησος', areas: ['Αργολίδα', 'Αρκαδία', 'Κορινθία', 'Λακωνία', 'Μεσσηνία'], cities: ['Ναύπλιο', 'Τρίπολη', 'Κόρινθος', 'Σπάρτη', 'Καλαμάτα'] },
  { label: 'Ιόνια Νησιά', aliases: ['Ιόνιοι Νήσοι'], areas: ['Ζάκυνθος', 'Κέρκυρα', 'Κεφαλληνία', 'Κεφαλονιά', 'Λευκάδα', 'Ιθάκη'], cities: ['Αργοστόλι'] },
  { label: 'Βόρειο Αιγαίο', areas: ['Λέσβος', 'Λήμνος', 'Σάμος', 'Χίος', 'Ικαρία'], cities: ['Μυτιλήνη'] },
  { label: 'Νότιο Αιγαίο', areas: ['Δωδεκάνησα', 'Κυκλάδες', 'Ρόδος', 'Κως', 'Σύρος', 'Θήρα'], cities: ['Ερμούπολη', 'Νάξος', 'Σαντορίνη'] },
  { label: 'Κρήτη', areas: ['Ηράκλειο', 'Λασίθι', 'Ρέθυμνο', 'Χανιά'], cities: ['Άγιος Νικόλαος', 'Ιεράπετρα'] },
];

export const normalizeStationLocation = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('el-GR').replace(/ς/g, 'σ')
  .replace(/&/g, ' και ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const sameLocation = (a, b) => normalizeStationLocation(a) === normalizeStationLocation(b);

// The two city shortcuts must stay city-based rather than swallowing the whole prefecture.
export const CITY_SHORTCUTS = ['Αθήνα', 'Θεσσαλονίκη'];
export const getAvailableRegionLinks = stations => [
  ...CITY_SHORTCUTS,
  ...REGIONAL_GROUPS.filter(group => stations.some(station => stationMatchesRegion(station, group.label)))
    .map(group => group.label),
];

export function stationMatchesRegion(station, name) {
  if (!station || !name) return false;
  const city = station.city;
  const region = station.region;
  if (sameLocation(name, 'Αθήνα')) {
    return ['Αθήνα', 'Athens', 'Athina'].some(value => sameLocation(city, value))
      || (!city && ['Αθήνα', 'Athens'].some(value => sameLocation(region, value)));
  }
  if (sameLocation(name, 'Θεσσαλονίκη')) {
    return ['Θεσσαλονίκη', 'Thessaloniki', 'Thessalonike'].some(value => sameLocation(city, value))
      || (!city && sameLocation(region, 'Θεσσαλονίκη'));
  }
  const group = REGIONAL_GROUPS.find(entry => sameLocation(name, entry.label));
  if (!group) return sameLocation(region, name) || sameLocation(city, name);
  return [group.label, ...(group.aliases || []), ...group.areas].some(value => sameLocation(region, value))
    || (!region && group.cities.some(value => sameLocation(city, value)));
}
