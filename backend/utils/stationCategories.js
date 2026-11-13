// Shared station taxonomy. Keep this file in sync with the frontend / backend counterpart.
const PRIMARY_CATEGORY_GROUPS=[
  {
    "label": "Ξένη μουσική",
    "items": [
      "Διεθνή Mainstream",
      "Dance",
      "Ηλεκτρονική",
      "Ροκ",
      "Εναλλακτικά"
    ]
  },
  {
    "label": "Ελληνική Μουσική",
    "items": [
      "Ελληνικά Επιτυχίες",
      "Ελληνικά Λαϊκά",
      "Έντεχνη",
      "Παραδοσιακά"
    ]
  },
  {
    "label": "Ειδήσεις, Αθλητικά & More",
    "items": [
      "Ειδησεογραφικά",
      "Αθλητικά",
      "Θρησκευτικά",
      "Διάφορα"
    ]
  }
];
const SECONDARY_BY_PRIMARY={
  "Διεθνή Mainstream": [
    "Adult Hits",
    "Top40",
    "Pop",
    "Dance Pop",
    "80s",
    "90s",
    "00s",
    "Oldies",
    "R&B",
    "Hip Hop",
    "Rap",
    "Trap",
    "Soul",
    "Funk",
    "Disco",
    "Latin",
    "Reggaeton",
    "Eurodance"
  ],
  "Dance": [
    "House",
    "Deep House",
    "Afro House",
    "Tech House",
    "Progressive House",
    "Dance Pop",
    "EDM",
    "Eurodance",
    "Disco",
    "Trance",
    "Indie Dance"
  ],
  "Ηλεκτρονική": [
    "House",
    "Afro House",
    "Deep House",
    "Tech House",
    "Organic House",
    "Melodic House",
    "Progressive House",
    "Melodic Techno",
    "Techno",
    "Trance",
    "EDM",
    "Electronica",
    "Ambient",
    "Chillout",
    "Downtempo",
    "Indie Dance",
    "Lounge"
  ],
  "Ροκ": [
    "Rock",
    "Classic Rock",
    "Hard Rock",
    "Alternative Rock",
    "Indie Rock",
    "Metal",
    "Punk",
    "Blues",
    "Ελληνικό Ροκ",
    "Oldies",
    "80s",
    "90s",
    "00s"
  ],
  "Εναλλακτικά": [
    "Cosmopolitan",
    "Eclectic",
    "Soul",
    "Funk",
    "Downtempo",
    "Easy Listening",
    "Lounge",
    "Chillout",
    "Jazz",
    "Blues",
    "Indie Pop",
    "Indie Rock",
    "Indie Dance",
    "Ambient",
    "Sophisticated",
    "Reggae",
    "R&B",
    "Latin",
    "Classical"
  ],
  "Ελληνικά Επιτυχίες": [
    "Ελληνική Μουσική",
    "Ελληνική Pop",
    "Λαϊκά",
    "Ελληνικό Ροκ",
    "Adult Hits",
    "Top40",
    "Dance Pop",
    "80s",
    "90s",
    "00s",
    "Oldies"
  ],
  "Ελληνικά Λαϊκά": [
    "Ελληνική Μουσική",
    "Λαϊκά",
    "Ρεμπέτικα",
    "Πανηγυριώτικα",
    "Δημοτικά",
    "Σμυρναίικα",
    "Παραδοσιακά",
    "Νησιώτικα"
  ],
  "Έντεχνη": [
    "Ελληνική Μουσική",
    "Ελληνικό Ροκ",
    "Ελληνική Pop",
    "Ρεμπέτικα",
    "Σμυρναίικα",
    "Ακουστική",
    "Τραγουδοποιοί"
  ],
  "Παραδοσιακά": [
    "Παραδοσιακά",
    "Δημοτικά",
    "Πανηγυριώτικα",
    "Κρητικά",
    "Νησιώτικα",
    "Ποντιακά",
    "Ηπειρώτικα",
    "Θρακιώτικα",
    "Μακεδονίτικα",
    "Κυπριακά",
    "Σμυρναίικα",
    "Ρεμπέτικα",
    "Ελληνική Μουσική"
  ],
  "Ειδησεογραφικά": [
    "Ειδήσεις",
    "Ενημερωτικές Εκπομπές",
    "Talk Radio",
    "Πολιτική",
    "Οικονομία",
    "Τοπικές Ειδήσεις",
    "Πολιτισμός",
    "Podcasts"
  ],
  "Αθλητικά": [
    "Αθλητικές Μεταδόσεις",
    "Talk Radio",
    "Ειδήσεις",
    "Ενημερωτικές Εκπομπές",
    "Podcasts"
  ],
  "Θρησκευτικά": [
    "Θρησκευτικά",
    "Βυζαντινά",
    "Εκκλησιαστικά"
  ],
  "Διάφορα": [
    "Podcasts",
    "Πολιτισμός",
    "Classical",
    "Opera",
    "Jazz",
    "Blues",
    "Reggae",
    "Latin",
    "Reggaeton",
    "Easy Listening",
    "Oldies",
    "Ambient",
    "Soul",
    "Funk",
    "Hip Hop",
    "Rap",
    "Trap",
    "Ενημερωτικές Εκπομπές"
  ]
};
const PRIMARY_CATEGORIES=PRIMARY_CATEGORY_GROUPS.flatMap(group=>group.items);
const SECONDARY_CATEGORIES=[...new Set(Object.values(SECONDARY_BY_PRIMARY).flat())];
const normalizePrimaryCategory=value=>value==='Έντεχνα'?'Έντεχνη':value;
const isPrimaryCategory=value=>PRIMARY_CATEGORIES.includes(value);
const isSecondaryCategory=value=>SECONDARY_CATEGORIES.includes(value);
const secondaryForPrimary=primary=>SECONDARY_BY_PRIMARY[normalizePrimaryCategory(primary)]||[];
const isSecondaryForPrimary=(secondary,primary)=>secondaryForPrimary(primary).includes(secondary);
const normalizeSelectedSecondaries=(primary,values,legacy='')=>{
  const input=Array.isArray(values)&&values.length?values:legacy?[legacy]:[];
  return [...new Set(input.filter(value=>isSecondaryForPrimary(value,primary)))].slice(0,3);
};
const isValidSecondarySelection=(primary,values)=>Array.isArray(values)&&values.length>=1&&values.length<=3&&
  new Set(values).size===values.length&&values.every(value=>isSecondaryForPrimary(value,primary));

function normalizeStationCategoryPayload(source){
  const data={...source};
  if(Object.hasOwn(data,'genre'))data.genre=normalizePrimaryCategory(data.genre);
  if(typeof data.secondaryGenres==='string'){
    try{data.secondaryGenres=JSON.parse(data.secondaryGenres);}catch{data.secondaryGenres=null;}
  }
  if(typeof data.hasCommercialAds==='string'){
    if(data.hasCommercialAds==='true')data.hasCommercialAds=true;
    else if(data.hasCommercialAds==='false')data.hasCommercialAds=false;
  }
  if(Array.isArray(data.secondaryGenres))data.secondaryGenre=data.secondaryGenres[0]||'';
  else if(!Object.hasOwn(data,'secondaryGenres')&&typeof data.secondaryGenre==='string'&&
    isSecondaryForPrimary(data.secondaryGenre,data.genre))data.secondaryGenres=[data.secondaryGenre];
  return data;
}
function validateStationCategories(data,{required=false,current=null}={}){
  if(!data||typeof data!=='object'||Array.isArray(data))return 'Μη έγκυρη κατηγοριοποίηση.';
  const primary=normalizePrimaryCategory(Object.hasOwn(data,'genre')?data.genre:current?.genre);
  if((required||Object.hasOwn(data,'genre'))&&!isPrimaryCategory(primary))
    return 'Επίλεξε μία από τις 13 βασικές κατηγορίες.';
  const selected=Object.hasOwn(data,'secondaryGenres')?data.secondaryGenres:
    Object.hasOwn(data,'secondaryGenre')?[data.secondaryGenre]:null;
  if((required||selected!==null)&&!isValidSecondarySelection(primary,selected))
    return 'Επίλεξε από 1 έως 3 δευτερεύουσες κατηγορίες που αντιστοιχούν στη βασική.';
  if((required||Object.hasOwn(data,'hasCommercialAds'))&&typeof data.hasCommercialAds!=='boolean')
    return 'Απάντησε υποχρεωτικά αν ο σταθμός μεταδίδει κερδοσκοπικές διαφημίσεις.';
  return null;
}
module.exports={PRIMARY_CATEGORY_GROUPS,PRIMARY_CATEGORIES,SECONDARY_BY_PRIMARY,SECONDARY_CATEGORIES,
  normalizePrimaryCategory,isPrimaryCategory,isSecondaryCategory,secondaryForPrimary,isSecondaryForPrimary,
  normalizeSelectedSecondaries,isValidSecondarySelection,normalizeStationCategoryPayload,validateStationCategories};
