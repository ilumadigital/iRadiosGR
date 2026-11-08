# iRadiosGR — Οδηγός XML προγράμματος σταθμών (v6.1)

Η διαχείριση γίνεται από **Backoffice → Πρόγραμμα εκπομπών**. Το XML feed είναι προαιρετικό και λειτουργεί ανά σταθμό.

## 1. Προτεινόμενο XML

Το XML πρέπει να είναι δημόσια προσβάσιμο με HTTP/HTTPS, να έχει ένα root element και επαναλαμβανόμενες εγγραφές εκπομπών:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schedule>
  <show>
    <producer>DJ Maria</producer>
    <title>Night Sessions</title>
    <day>1</day>
    <start>22:00</start>
    <end>02:00</end>
    <imageurl>https://example.com/images/dj-maria.jpg</imageurl>
    <description>Deep house &amp; electronic.</description>
  </show>
  <show>
    <producer>Alex D.</producer>
    <title>Morning Vibes</title>
    <day>2</day>
    <start>08:00</start>
    <end>11:00</end>
    <imageurl>https://example.com/images/alex.jpg</imageurl>
  </show>
</schedule>
```

Πεδία:
- **day:** 1=Δευτέρα, 2=Τρίτη, …, 7=Κυριακή. Στο mapping υπάρχουν και δύο συμβάσεις 0–6.
- **start, end:** 24ωρες ώρες HH:mm. 24:00 επιτρέπεται μόνο ως τέλος ημέρας.
- **title:** προαιρετικό εφόσον υπάρχει producer — τότε ο παραγωγός γίνεται τίτλος.
- **producer:** προαιρετικό εφόσον υπάρχει title.
- **imageurl, description:** προαιρετικά. Δημόσιο HTTP/HTTPS URL εικόνας.
- **row tag:** show, item, programme, slot κ.ο.κ., αυτόματη αναγνώριση ή ρητή επιλογή.
- Υποστηρίζονται πεδία και ως XML attributes, καθώς και απλό CDATA.
- Όριο: **160 εγγραφές ανά εβδομάδα**, μαζί με αυτόματους διαχωρισμούς μεσονυχτίου· μέγιστο XML **1 MB**.

## 2. Οδηγίες για Admin / Broadcaster

1. Πήγαινε Backoffice → Πρόγραμμα εκπομπών και διάλεξε σταθμό.
2. Άνοιξε Ρύθμιση XML και γράψε το feed URL. Το row tag είναι προαιρετικό.
3. Διάλεξε αρίθμηση ημερών και πάτησε Έλεγχος XML.
4. Δες τα πεδία που βρέθηκαν και όρισε mapping, π.χ. host → producer, show_name → title, from → start.
5. Αν αλλάξεις mapping, πάτησε ξανά Έλεγχος XML.
6. Έλεγξε εικόνες, ώρες, εκπομπές και νυχτερινές εγγραφές.
7. Πάτησε Ενεργοποίηση XML & εισαγωγή και επιβεβαίωσε την αντικατάσταση του τρέχοντος προγράμματος.

Πριν την τελική επιβεβαίωση **δεν τροποποιείται καμία καταχώριση**. Τα imports είναι all-or-nothing: τυχόν λάθη, κενές πηγές, επικαλύψεις ή μη έγκυρες ημέρες δεν σβήνουν το τελευταίο σωστό πρόγραμμα.

## 3. Καθημερινός συγχρονισμός

- Ο server ελέγχει κάθε ενεργό feed **στις 03:00, Europe/Athens**, με αυτόματη θερινή/χειμερινή ώρα.
- Όλοι οι σταθμοί με ενεργό XML feed ενημερώνονται ανεξάρτητα.
- Αν δεν άλλαξε το εβδομαδιαίο πρόγραμμα, δεν γράφεται ξανά.
- Σε αποτυχία δικτύου ή XML, παραμένει η τελευταία σωστή έκδοση και καταγράφεται σφάλμα.
- Το backoffice δείχνει τελευταίο έλεγχο, τελευταία επιτυχία και αριθμό εκπομπών.
- Ο χρήστης μπορεί να ζητήσει Συγχρονισμός τώρα ή Απενεργοποίηση.
- Η χειροκίνητη αποθήκευση από Admin/Broadcaster απενεργοποιεί το XML με προειδοποίηση. Ο Producer δεν μπορεί να αλλάξει τη ρύθμιση εξωτερικού XML.

## 4. Ασφάλεια και εγκατάσταση

- JWT + role + station-ownership enforcement στα νέα Backoffice APIs.
- Μόνο δημόσια HTTP/HTTPS feed URLs, με επαλήθευση DNS, IP pinning, redirect verification, timeouts, όριο μεγέθους και lease lock.
- Η ιδιωτική ρύθμιση scheduleFeed δεν περιλαμβάνεται στα public Station documents.
- Πρόσθετα πεδία στη MongoDB χωρίς υποχρεωτική migration. Χωρίς νέο secret ή dependency.
- Staging smoke test: XML preview, mapping, confirm, image URL, midnight split, manual override, forced network error, 03:00 cron.
- Offline checks: node ops/check-phase44-station-xml.cjs.
- Rollback: απενεργοποίηση XML feed, διατήρηση της τελευταίας έγκυρης playlist εκπομπών και επαναφορά προηγούμενου κώδικα frontend/backend.

## 5. Σημείωση προγράμματος

Η ενημέρωση αφορά το εβδομαδιαίο **πρόγραμμα εκπομπών** του σταθμού. Δεν επεμβαίνει στο audio stream, στο Now Playing metadata ή στο ιστορικό τραγουδιών / playlist.
