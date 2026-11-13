// Canonical geographic ad targeting. Cities are used ONLY to infer the listener's
// prefecture; advertisers cannot select individual cities.
import LOCATION_DATA from './stationLocationData.json' with { type: 'json' };

const PLACE_ALIASES = {
  // --- ΧΩΡΕΣ ---
  "Ελλάδα": ["GR", "Greece", "Hellas"],
  "Κύπρος": ["CY", "Cyprus"],
  "Εξωτερικό": ["Abroad", "International", "Europe", "America", "US", "USA", "Australia", "AU", "UK", "United Kingdom", "Germany", "France"],

  // --- ΝΟΜΟΙ / ΠΕΡΙΦΕΡΕΙΕΣ (ΕΛΛΑΔΑ) ---
  "Αττική": ["Attica", "Attiki"],
  "Θεσσαλονίκη": ["Thessaloniki", "Central Macedonia", "Thessalonike"],
  "Αιτωλοακαρνανία": ["Aetolia-Acarnania", "Aitoloakarnania", "West Greece"],
  "Αργολίδα": ["Argolis", "Argolida", "Peloponnese"],
  "Αρκαδία": ["Arcadia", "Arkadia", "Peloponnese"],
  "Άρτα": ["Arta", "Epirus"],
  "Αχαΐα": ["Achaea", "Achaia", "West Greece"],
  "Βοιωτία": ["Boeotia", "Voiotia", "Central Greece"],
  "Γρεβενά": ["Grevena", "West Macedonia"],
  "Δράμα": ["Drama", "East Macedonia and Thrace"],
  "Δωδεκάνησα": ["Dodecanese", "South Aegean"],
  "Έβρος": ["Evros", "East Macedonia and Thrace"],
  "Εύβοια": ["Euboea", "Evia", "Central Greece"],
  "Ευρυτανία": ["Evrytania", "Central Greece"],
  "Ζάκυνθος": ["Zakynthos", "Zante", "Ionian Islands"],
  "Ηλεία": ["Elis", "Ilia", "West Greece"],
  "Ημαθία": ["Imathia", "Central Macedonia"],
  "Ηράκλειο": ["Heraklion", "Iraklio", "Crete"],
  "Θεσπρωτία": ["Thesprotia", "Epirus"],
  "Ιωάννινα": ["Ioannina", "Epirus"],
  "Καβάλα": ["Kavala", "East Macedonia and Thrace"],
  "Καρδίτσα": ["Karditsa", "Thessaly"],
  "Καστοριά": ["Kastoria", "West Macedonia"],
  "Κέρκυρα": ["Corfu", "Kerkyra", "Ionian Islands"],
  "Κεφαλληνία": ["Kefalonia", "Cephalonia", "Ionian Islands"],
  "Κιλκίς": ["Kilkis", "Central Macedonia"],
  "Κοζάνη": ["Kozani", "West Macedonia"],
  "Κορινθία": ["Corinthia", "Korinthia", "Peloponnese"],
  "Κυκλάδες": ["Cyclades", "South Aegean"],
  "Λακωνία": ["Laconia", "Lakonia", "Peloponnese"],
  "Λάρισα": ["Larissa", "Thessaly"],
  "Λασίθι": ["Lasithi", "Lasithio", "Crete"],
  "Λέσβος": ["Lesbos", "Lesvos", "North Aegean"],
  "Λευκάδα": ["Lefkada", "Ionian Islands"],
  "Μαγνησία": ["Magnesia", "Magnisia", "Thessaly"],
  "Μεσσηνία": ["Messenia", "Messinia", "Peloponnese"],
  "Ξάνθη": ["Xanthi", "East Macedonia and Thrace"],
  "Πέλλα": ["Pella", "Central Macedonia"],
  "Πιερία": ["Pieria", "Central Macedonia"],
  "Πρέβεζα": ["Preveza", "Epirus"],
  "Ρέθυμνο": ["Rethymno", "Crete"],
  "Ροδόπη": ["Rhodope", "Rodopi", "East Macedonia and Thrace"],
  "Σάμος": ["Samos", "North Aegean"],
  "Σέρρες": ["Serres", "Central Macedonia"],
  "Τρίκαλα": ["Trikala", "Thessaly"],
  "Φθιώτιδα": ["Phthiotis", "Fthiotida", "Central Greece"],
  "Φλώρινα": ["Florina", "West Macedonia"],
  "Φωκίδα": ["Phocis", "Fokida", "Central Greece"],
  "Χαλκιδική": ["Chalkidiki", "Halkidiki", "Central Macedonia"],
  "Χανιά": ["Chania", "Crete"],
  "Χίος": ["Chios", "North Aegean"],

  // --- ΠΟΛΕΙΣ & ΠΡΟΑΣΤΙΑ (ΑΤΤΙΚΗ) ---
  "Αθήνα": ["Athens", "Athina"],
  "Πειραιάς": ["Piraeus", "Pireas"],
  "Νέα Σμύρνη": ["Nea Smyrni"],
  "Καλλιθέα": ["Kallithea"],
  "Παλαιό Φάληρο": ["Palaio Faliro", "Palio Faliro"],
  "Άλιμος": ["Alimos", "Kalamaki"],
  "Ελληνικό": ["Elliniko", "Hellinikon"],
  "Αργυρούπολη": ["Argyroupoli"],
  "Γλυφάδα": ["Glyfada"],
  "Βούλα": ["Voula"],
  "Βουλιαγμένη": ["Vouliagmeni"],
  "Ηλιούπολη": ["Ilioupoli"],
  "Άγιος Δημήτριος": ["Agios Dimitrios", "Brahami"],
  "Ζωγράφου": ["Zografou"],
  "Καισαριανή": ["Kaisariani"],
  "Βύρωνας": ["Vyronas"],
  "Γαλάτσι": ["Galatsi"],
  "Νέα Ιωνία": ["Nea Ionia"],
  "Νέο Ηράκλειο": ["Irakleio", "Neo Irakleio", "Heraklion Athens"],
  "Νέα Φιλαδέλφεια": ["Nea Filadelfeia", "Nea Philadelfeia"],
  "Χαλάνδρι": ["Chalandri", "Halandri"],
  "Μαρούσι": ["Marousi", "Amarousion"],
  "Κηφισιά": ["Kifisia", "Kifissia"],
  "Πεύκη": ["Pefki"],
  "Μελίσσια": ["Melissia"],
  "Βριλήσσια": ["Vrilissia"],
  "Αγία Παρασκευή": ["Agia Paraskevi"],
  "Περιστέρι": ["Peristeri"],
  "Αιγάλεω": ["Egaleo", "Aigaleo"],
  "Χαϊδάρι": ["Haidari", "Chaidari"],
  "Ίλιον": ["Ilion", "Nea Liosia"],
  "Πετρούπολη": ["Petroupoli"],
  "Αγία Βαρβάρα": ["Agia Varvara"],
  "Νίκαια": ["Nikaia", "Nicaea"],
  "Κορυδαλλός": ["Korydallos"],
  "Κερατσίνι": ["Keratsini"],
  "Δραπετσώνα": ["Drapetsona"],
  "Πέραμα": ["Perama"],
  "Σαλαμίνα": ["Salamina", "Salamis"],
  "Ελευσίνα": ["Elefsina", "Eleusis"],
  "Αχαρνές": ["Acharnes", "Menidi"],
  "Παλλήνη": ["Pallini"],
  "Γέρακας": ["Gerakas"],
  "Κορωπί": ["Koropi", "Koropio"],
  "Μαρκόπουλο": ["Markopoulo"],
  "Ραφήνα": ["Rafina"],
  "Λαύριο": ["Lavrio", "Laurium"],

  // --- ΠΟΛΕΙΣ & ΠΡΟΑΣΤΙΑ (ΘΕΣΣΑΛΟΝΙΚΗ) ---
  "Θεσσαλονίκη": ["Thessaloniki", "Thessalonike", "Salonica"],
  "Καλαμαριά": ["Kalamaria"],
  "Εύοσμος": ["Evosmos"],
  "Κορδελιό": ["Kordelio", "Eleftherio-Kordelio"],
  "Αμπελόκηποι": ["Ampelokipoi", "Ambelokipi"],
  "Μενεμένη": ["Menemeni"],
  "Σταυρούπολη": ["Stavroupoli"],
  "Πολίχνη": ["Polichni"],
  "Νεάπολη": ["Neapoli"],
  "Συκιές": ["Sykies"],
  "Πυλαία": ["Pylaia"],
  "Χορτιάτης": ["Chortiatis"],
  "Πανόραμα": ["Panorama"],
  "Θέρμη": ["Thermi"],
  "Ωραιόκαστρο": ["Oraiokastro", "Oreokastro"],
  "Μηχανιώνα": ["Michaniona", "Nea Michaniona"],
  "Περαία": ["Peraia", "Perea"],
  "Σίνδος": ["Sindos"],
  "Χαλάστρα": ["Chalastra"],

  // --- ΠΟΛΕΙΣ & ΠΡΟΑΣΤΙΑ (ΥΠΟΛΟΙΠΗ ΕΛΛΑΔΑ) ---
  "Μεσολόγγι": ["Missolonghi", "Mesolongi"],
  "Αγρίνιο": ["Agrinio"],
  "Ναύπακτος": ["Nafpaktos"],
  "Ναύπλιο": ["Nafplio", "Nafplion"],
  "Άργος": ["Argos"],
  "Τρίπολη": ["Tripoli"],
  "Μεγαλόπολη": ["Megalopoli"],
  "Πάτρα": ["Patras", "Patra"],
  "Αίγιο": ["Aigio", "Egio"],
  "Καλάβρυτα": ["Kalavryta", "Kalavrita"],
  "Λιβαδειά": ["Livadeia", "Levadia"],
  "Θήβα": ["Thebes", "Thiva"],
  "Αράχωβα": ["Arachova"],
  "Γρεβενά": ["Grevena"],
  "Δράμα": ["Drama"],
  "Ρόδος": ["Rhodes", "Rodos"],
  "Κως": ["Kos"],
  "Κάλυμνος": ["Kalymnos"],
  "Κάρπαθος": ["Karpathos"],
  "Αλεξανδρούπολη": ["Alexandroupoli"],
  "Ορεστιάδα": ["Orestiada"],
  "Διδυμότειχο": ["Didymoteicho"],
  "Χαλκίδα": ["Chalcis", "Halkida"],
  "Κάρυστος": ["Karystos"],
  "Καρπενήσι": ["Karpenisi"],
  "Ζάκυνθος": ["Zakynthos", "Zante"],
  "Πύργος": ["Pyrgos"],
  "Αμαλιάδα": ["Amaliada"],
  "Βέροια": ["Veroia", "Veria"],
  "Νάουσα": ["Naousa", "Naoussa"],
  "Αλεξάνδρεια": ["Alexandreia", "Alexandria"],
  "Μοίρες": ["Moires", "Mires"],
  "Χερσόνησος": ["Hersonissos", "Chersonisos"],
  "Ηγουμενίτσα": ["Igoumenitsa"],
  "Μέτσοβο": ["Metsovo"],
  "Καβάλα": ["Kavala"],
  "Καρδίτσα": ["Karditsa"],
  "Καστοριά": ["Kastoria"],
  "Κέρκυρα": ["Corfu", "Kerkyra"],
  "Αργοστόλι": ["Argostoli"],
  "Ληξούρι": ["Lixouri"],
  "Κιλκίς": ["Kilkis"],
  "Κοζάνη": ["Kozani"],
  "Πτολεμαΐδα": ["Ptolemaida"],
  "Κόρινθος": ["Corinth", "Korinthos"],
  "Λουτράκι": ["Loutraki"],
  "Κιάτο": ["Kiato"],
  "Σύρος": ["Syros", "Ermoupoli"],
  "Νάξος": ["Naxos"],
  "Μύκονος": ["Mykonos"],
  "Σαντορίνη": ["Santorini", "Thira"],
  "Πάρος": ["Paros"],
  "Τήνος": ["Tinos"],
  "Μήλος": ["Milos"],
  "Σπάρτη": ["Sparta", "Sparti"],
  "Γύθειο": ["Gytheio", "Gythio"],
  "Ελασσόνα": ["Elassona"],
  "Φάρσαλα": ["Farsala"],
  "Άγιος Νικόλαος": ["Agios Nikolaos"],
  "Ιεράπετρα": ["Ierapetra"],
  "Σητεία": ["Sitia"],
  "Μυτιλήνη": ["Mytilene", "Mytilini"],
  "Λευκάδα": ["Lefkada"],
  "Αλμυρός": ["Almyros"],
  "Καλαμάτα": ["Kalamata"],
  "Μεσσήνη": ["Messini"],
  "Ξάνθη": ["Xanthi"],
  "Έδεσσα": ["Edessa"],
  "Γιαννιτσά": ["Giannitsa"],
  "Κατερίνη": ["Katerini"],
  "Πάργα": ["Parga"],
  "Ρέθυμνο": ["Rethymno"],
  "Κομοτηνή": ["Komotini"],
  "Σάμος": ["Samos"],
  "Σέρρες": ["Serres"],
  "Καλαμπάκα": ["Kalabaka", "Kalampaka"],
  "Λαμία": ["Lamia"],
  "Αμύνταιο": ["Amyntaio"],
  "Άμφισσα": ["Amfissa"],
  "Δελφοί": ["Delphi", "Delfoi"],
  "Πολύγυρος": ["Polygyros"],
  "Νέα Μουδανιά": ["Nea Moudania"],
  "Χαλκιδική": ["Chalkidiki", "Halkidiki"],
  "Κίσσαμος": ["Kissamos"],

  // --- ΚΥΠΡΟΣ ---
  "Λευκωσία": ["Nicosia", "Lefkosia"],
  "Στρόβολος": ["Strovolos"],
  "Λακατάμεια": ["Lakatamia"],
  "Λεμεσός": ["Limassol", "Lemesos"],
  "Λάρνακα": ["Larnaca", "Larnaka"],
  "Πάφος": ["Paphos", "Pafos"],
  "Αμμόχωστος": ["Famagusta", "Ammochostos"],
  "Παραλίμνι": ["Paralimni"],
  "Αγία Νάπα": ["Ayia Napa", "Agia Napa"],
  "Κερύνεια": ["Kyrenia", "Keryneia"],

  // --- ΕΞΩΤΕΡΙΚΟ ---
  "Ευρώπη": ["Europe"],
  "Αμερική": ["America", "United States", "USA", "US"],
  "Αυστραλία": ["Australia", "AU"],
  "Λονδίνο": ["London"],
  "Παρίσι": ["Paris"],
  "Βερολίνο": ["Berlin"],
  "Νέα Υόρκη": ["New York", "NY"],
  "Σικάγο": ["Chicago"],
  "Σίδνεϊ": ["Sydney"],
  "Μελβούρνη": ["Melbourne"]
};

const REGION_ALIASES={
  'Αττική':['Attica','Attiki'], 'Πελοπόννησος':['Peloponnese','Peloponnesus','Peloponnisos'],
  'Στερεά Ελλάδα':['Central Greece','Sterea Ellada'], 'Δυτική Ελλάδα':['Western Greece','West Greece','Western Hellas'],
  'Ανατολική Μακεδονία & Θράκη':['Eastern Macedonia and Thrace','East Macedonia and Thrace'],
  'Κεντρική Μακεδονία':['Central Macedonia'], 'Δυτική Μακεδονία':['Western Macedonia','West Macedonia'],
  'Θεσσαλία':['Thessaly'], 'Ήπειρος':['Epirus'], 'Κρήτη':['Crete'],
  'Βόρειο Αιγαίο':['North Aegean','Northern Aegean'], 'Νότιο Αιγαίο':['South Aegean','Southern Aegean'],
  'Ιόνια Νησιά':['Ionian Islands']
};
const normal=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const matches=(value,values)=>values.some(v=>normal(value)===normal(v));
const countries={
 'Ελλάδα':['GR','Greece','Hellas','GRC','Ελλάδα'],
 'Κύπρος':['CY','Cyprus','CYP','Κύπρος']
};
const allPlaces=Object.entries(LOCATION_DATA).flatMap(([country,regions])=>
 Object.entries(regions).flatMap(([region,prefectures])=>
 Object.entries(prefectures).flatMap(([prefecture,cities])=>
 cities.map(city=>({country,region,prefecture,city})))));
function countryOf(location){
 const name=location?.countryName||location?.country_name;
 const code=location?.country||location?.country_code;
 return Object.keys(countries).find(key=>matches(name,countries[key])||matches(code,countries[key]))||null;
}
export function resolveListenerAdGeo(location){
 const country=countryOf(location);
 if(!country)return {country:null,region:null,prefecture:null};
 const regions=LOCATION_DATA[country]||{};
 const regionInput=location.region||location.regionName||'';
 let region=Object.keys(regions).find(key=>matches(regionInput,[key,...(REGION_ALIASES[key]||[])]))||null;
 // A region label reported by an IP provider must NOT be treated as a county.
 const candidates=allPlaces.filter(x=>x.country===country&&(!region||x.region===region)&&
   matches(location.city,[x.city,...(PLACE_ALIASES[x.city]||[])]));
 const unique=candidates.length===1?candidates[0]:null;
 if(unique)region=unique.region;
 let prefecture=unique?.prefecture||null;
 // Some geo providers give a prefecture as their region; accept only an exact
 // county alias, never the broader regional terms in the legacy dictionary.
 if(!prefecture){
  const county=Object.entries(regions).flatMap(([r,prefs])=>Object.keys(prefs).map(p=>({region:r,prefecture:p})))
    .find(x=>(!region||x.region===region)&&matches(regionInput,
       [x.prefecture,...(PLACE_ALIASES[x.prefecture]||[]).filter(alias=>
          !Object.values(REGION_ALIASES).flat().some(v=>normal(v)===normal(alias)))]));
  if(county){region=county.region;prefecture=county.prefecture;}
 }
 return {country,region,prefecture};
}
export function geoAllowsCanonicalArea(targetLocations,location){
 const areas=Array.isArray(targetLocations)&&targetLocations.length?targetLocations:['All'];
 if(areas.includes('All'))return true;
 const geo=resolveListenerAdGeo(location);
 return areas.some(area=>area===geo.country||area===geo.region||area===geo.prefecture);
}
