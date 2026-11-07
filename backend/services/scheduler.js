const cron = require('node-cron');
const webpush = require('web-push');
const User = require('../models/User'); 

// ============================================================================
// ⚙️ SETUP WEB PUSH (VAPID KEYS)
// Για να λειτουργήσει, πρέπει να βάλεις αυτά τα keys στο αρχείο .env σου
// Μπορείς να τα παράξεις τρέχοντας στο τερματικό: npx web-push generate-vapid-keys
// ============================================================================
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:info@iluma.gr', // Το email επικοινωνίας σου
    publicVapidKey,
    privateVapidKey
  );
} else {
  console.warn('⚠️ Προσοχή: Λείπουν τα VAPID Keys από το .env. Τα Push Notifications δεν θα σταλούν.');
}

const startScheduler = () => {
  console.log('⏳ Scheduler Initialized: Listening for upcoming radio shows...');

  // Τρέχει ΚΑΘΕ λεπτό ακριβώς (* * * * *)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Βρίσκουμε ποια θα είναι η ώρα σε ακριβώς 5 λεπτά από τώρα
      const future = new Date(now.getTime() + 5 * 60000);
      
      // Υπολογισμός Ημέρας 
      // Η JS θεωρεί 0 την Κυριακή, 1 τη Δευτέρα.
      // Στο frontend έχουμε 0: Δευτέρα ... 6: Κυριακή, άρα κάνουμε την προσαρμογή:
      const jsDay = future.getDay(); 
      const targetDay = jsDay === 0 ? 6 : jsDay - 1; 
      
      // Υπολογισμός Ώρας σε μορφή "HH:mm" (π.χ. "14:00")
      const h = future.getHours().toString().padStart(2, '0');
      const m = future.getMinutes().toString().padStart(2, '0');
      const targetTime = `${h}:${m}`;

      // Βρίσκουμε όλους τους χρήστες που έχουν υπενθύμιση γι' αυτήν ακριβώς τη μέρα & ώρα
      const usersToNotify = await User.find({
        reminders: {
          $elemMatch: {
            day: targetDay,
            startTime: targetTime
          }
        }
      }).populate('reminders.stationId'); 

      if (usersToNotify.length > 0) {
        console.log(`🔔 Βρέθηκαν ${usersToNotify.length} χρήστες για ειδοποίηση στις ${targetTime}`);
      }

      // Λούπα για να στείλουμε την ειδοποίηση σε κάθε χρήστη
      for (const user of usersToNotify) {
        const reminder = user.reminders.find(r => r.day === targetDay && r.startTime === targetTime);
        if (!reminder || !reminder.stationId) continue;

        const payload = JSON.stringify({
          title: 'Ξεκινάει σε 5 λεπτά! 📻',
          body: `Η εκπομπή "${reminder.showTitle}" ξεκινάει στον σταθμό ${reminder.stationId.name}. Συντονίσου τώρα!`,
          icon: reminder.stationId.logo || '/iradios-app-logo.png',
          url: `https://iradios.gr/station/${reminder.stationId.slug || reminder.stationId._id}`,
          // Χρήσιμο για να μην βγαίνουν πολλαπλές ίδιες ειδοποιήσεις στην οθόνη
          tag: `reminder-${reminder.stationId._id}` 
        });

        // 🟢 ΑΠΟΣΤΟΛΗ WEB PUSH NOTIFICATION
        if (user.pushSubscription && user.pushSubscription.endpoint) {
          try {
            await webpush.sendNotification(user.pushSubscription, payload);
            console.log(`✅ Push Notification στάλθηκε επιτυχώς στον ${user.email}`);
          } catch (err) {
            console.error(`❌ Σφάλμα αποστολής Push στον ${user.email} (Status: ${err.statusCode})`);
            
            // Αν το token έχει λήξει (410 Gone) ή η συσκευή διέγραψε τα δεδομένα (404), το αφαιρούμε!
            if (err.statusCode === 410 || err.statusCode === 404) {
              user.pushSubscription = null;
              await user.save();
              console.log(`🗑️ Το άκυρο token του ${user.email} διαγράφηκε.`);
            }
          }
        } else {
          console.log(`ℹ️ Ο χρήστης ${user.email} δεν έχει ενεργοποιήσει τα Web Push Notifications.`);
        }
      }

    } catch (error) {
      console.error('❌ Σφάλμα κατά την εκτέλεση του Scheduler:', error);
    }
  });
};

module.exports = startScheduler;
