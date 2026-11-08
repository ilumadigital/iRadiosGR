'use strict';
// Group labels are for navigation, never select options.
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
      "Έντεχνα",
      "Παραδοσιακά"
    ]
  },
  {
    "label": "Ραδιόφωνα με Ομιλία",
    "items": [
      "Ειδησεογραφικά",
      "Αθλητικά",
      "Θρησκευτικά"
    ]
  }
];
const SECONDARY_CATEGORIES=[
  "Cosmopolitan",
  "House",
  "Afro House",
  "Deep House",
  "Tech House",
  "Organic House",
  "Melodic House",
  "Progressive House",
  "Indie Dance",
  "Electronica",
  "Sophisticated",
  "Techno",
  "Trance",
  "EDM",
  "Ambient",
  "Chillout",
  "Downtempo",
  "Lounge",
  "Jazz",
  "Soul",
  "Funk",
  "Disco",
  "Pop",
  "Dance Pop",
  "R&B",
  "Hip Hop",
  "Rap",
  "Indie Pop",
  "Indie Rock",
  "Alternative Rock",
  "Classic Rock",
  "Hard Rock",
  "Blues",
  "Reggae",
  "Latin",
  "Classical",
  "80s",
  "90s",
  "00s",
  "Ελληνική Pop",
  "Ελληνικό Ροκ",
  "Έντεχνο",
  "Ρεμπέτικα",
  "Δημοτικά",
  "Κρητικά",
  "Νησιώτικα",
  "Ποντιακά",
  "Ηπειρώτικα",
  "Θρακιώτικα",
  "Μακεδονίτικα",
  "Κυπριακά",
  "Σμυρναίικα",
  "Βυζαντινά",
  "Εκκλησιαστικά",
  "Πολιτική",
  "Οικονομία",
  "Τοπικές Ειδήσεις",
  "Αθλητικές Μεταδόσεις",
  "Podcasts"
];
const PRIMARY_CATEGORIES=PRIMARY_CATEGORY_GROUPS.flatMap(group=>group.items);
const isPrimaryCategory=value=>PRIMARY_CATEGORIES.includes(value);
const isSecondaryCategory=value=>SECONDARY_CATEGORIES.includes(value);
function validateStationCategories(data,{required=false}={}){
  if(!data||typeof data!=='object')return 'Μη έγκυρη κατηγοριοποίηση.';
  if((required||Object.hasOwn(data,'genre'))&&!isPrimaryCategory(data.genre))return 'Επίλεξε μία από τις 12 βασικές κατηγορίες.';
  if((required||Object.hasOwn(data,'secondaryGenre'))&&!isSecondaryCategory(data.secondaryGenre))return 'Επίλεξε μία έγκυρη δευτερεύουσα κατηγορία.';
  return null;
}
module.exports={PRIMARY_CATEGORY_GROUPS,PRIMARY_CATEGORIES,SECONDARY_CATEGORIES,isPrimaryCategory,isSecondaryCategory,validateStationCategories};
