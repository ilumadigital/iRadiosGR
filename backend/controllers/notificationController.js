const Subscription = require('../models/Subscription');
const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails('mailto:info@iluma.gr', vapidPublicKey, vapidPrivateKey);

exports.getVapidKey = (req, res) => { 
  res.send(vapidPublicKey); 
};

exports.subscribe = async (req, res) => {
  try {
    const { subscription, userId } = req.body; 
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint }, 
      { ...subscription, userId: userId || null }, 
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Επιτυχής εγγραφή.' });
  } catch (error) { res.status(500).json({ error: 'Σφάλμα κατά την εγγραφή.' }); }
};

exports.getStats = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const subs = await Subscription.find({}).populate('userId', 'role isPremium broadcasterProfile');
    let all = subs.length;
    let premium = 0; let broadcasters = 0;

    subs.forEach(sub => {
      if (sub.userId) {
        if (sub.userId.isPremium || sub.userId.broadcasterProfile?.tier === 'premium') premium++;
        if (sub.userId.role === 'broadcaster') broadcasters++;
      }
    });
    res.json({ all, premium, broadcasters }); 
  } catch (error) { res.status(500).json({ error: 'Σφάλμα λήψης στατιστικών' }); }
};

exports.sendNotification = async (req, res) => {
  try {
    const { title, body } = req.body;
    const payload = JSON.stringify({ title, body, url: '/' });
    const subscriptions = await Subscription.find({});
    if (subscriptions.length === 0) return res.status(404).json({ error: 'Δεν βρέθηκαν συσκευές.' });

    const promises = subscriptions.map(sub => 
      webpush.sendNotification(sub, payload).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) return Subscription.findByIdAndDelete(sub._id);
      })
    );
    await Promise.all(promises);
    res.status(200).json({ message: 'Στάλθηκαν επιτυχώς!' });
  } catch (error) { res.status(500).json({ error: 'Σφάλμα αποστολής.' }); }
};
