const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', 
});

const User = require('../models/User');
const Station = require('../models/Station');
const Transaction = require('../models/Transaction');

const { adPaymentSuccessEmail, adminTransactionAlertEmail, broadcasterPremiumSuccessEmail, listenerPremiumSuccessEmail } = require('../utils/mailTemp');
const { sendEmail } = require('../utils/myMailer'); 

// --- 1. ΔΗΜΙΟΥΡΓΙΑ ΣΥΝΔΡΟΜΗΣ Ή BOOST (ΜΟΝΟ ΠΡΟΕΤΟΙΜΑΣΙΑ - ΚΑΜΙΑ ΕΝΕΡΓΟΠΟΙΗΣΗ ΕΔΩ) ---
exports.createStripeSubscription = async (req, res) => {
  try {
    const { userId, priceId, planId, stationId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Χρήστης δεν βρέθηκε' });

    const metadata = { 
      userId: user._id.toString(), 
      planId: planId,
      stationId: stationId || '',
      planName: planId.replace(/_/g, ' ').toUpperCase(),
      planType: planId.startsWith('boost_') ? 'boost' : 'subscription'
    };

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.fname} ${user.lname}`.trim() || user.username,
        metadata: metadata 
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    } else {
      await stripe.customers.update(customerId, { metadata: metadata });
    }

    if (planId.startsWith('boost_')) {
      const price = await stripe.prices.retrieve(priceId);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price.unit_amount,
        currency: 'eur',
        customer: customerId,
        metadata: metadata,
        automatic_payment_methods: { enabled: true },
      });
      return res.json({ clientSecret: paymentIntent.client_secret });
    } 
    else {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete', // Περιμένει την έγκριση της κάρτας
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: metadata
      });

      let invoice = subscription.latest_invoice;
      if (typeof invoice === 'string') {
        invoice = await stripe.invoices.retrieve(invoice, { expand: ['payment_intent'] });
      }

      let clientSecret = invoice?.payment_intent?.client_secret || subscription.pending_setup_intent?.client_secret;

      if (!clientSecret) return res.status(400).json({ error: "Δεν βρέθηκε κλειδί πληρωμής." });

      // 🟢 ΤΕΛΟΣ. Επιστρέφουμε το secret. ΔΕΝ ενεργοποιούμε τίποτα ακόμα!
      return res.json({ subscriptionId: subscription.id, clientSecret: clientSecret });
    }
  } catch (error) {
    console.error("❌ Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- 2. ΔΗΜΙΟΥΡΓΙΑ ΠΛΗΡΩΜΗΣ ΓΙΑ AD NETWORK ---
exports.createAdCheckout = async (req, res) => {
  try {
    const { userId, priceId, adType } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user._id.toString(), planType: 'agency_ad' }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const price = await stripe.prices.retrieve(priceId);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: 'eur',
      customer: customerId,
      metadata: { 
        userId: user._id.toString(), adType: adType, planType: 'agency_ad',
        planId: `ad_${adType}`, planName: `Agency Ad: ${adType.toUpperCase()}` 
      },
      automatic_payment_methods: { enabled: true }
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 3. WEBHOOK (Η ΚΑΡΔΙΑ ΤΟΥ ΣΥΣΤΗΜΑΤΟΣ - ΜΟΝΟ ΕΔΩ ΕΝΕΡΓΟΠΟΙΟΥΝΤΑΙ ΤΑ ΠΑΚΕΤΑ) ---
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let metadata = {};
  let subscriptionId = null;
  let customerId = null;
  let currentPeriodEnd = null;

  // 🟢 ΜΟΝΟ ΟΤΑΝ Η ΠΛΗΡΩΜΗ ΕΙΝΑΙ ΕΠΙΤΥΧΗΣ (Τα λεφτά τραβήχτηκαν)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    subscriptionId = invoice.subscription;
    customerId = invoice.customer;
    metadata = invoice.subscription_details?.metadata || invoice.metadata || {};
    if (invoice.lines && invoice.lines.data.length > 0) {
      currentPeriodEnd = new Date(invoice.lines.data[0].period.end * 1000);
    }
  } 
  else if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    customerId = intent.customer;
    metadata = intent.metadata || {};
  }
  else if (event.type === 'customer.subscription.deleted') {
    // Η συνδρομή έληξε ή ακυρώθηκε οριστικά στο Stripe
    await deactivateFeatures(event.data.object); 
    return res.json({ received: true });
  }

  // Ανάκτηση metadata αν λείπουν
  if ((!metadata || !metadata.userId) && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      metadata = customer.metadata;
    } catch (err) {}
  }

  // 🟢 ΑΝ ΕΙΝΑΙ ΕΠΙΤΥΧΗΣ ΠΛΗΡΩΜΗ -> ΕΝΕΡΓΟΠΟΙΟΥΜΕ
  if ((event.type === 'invoice.payment_succeeded' || event.type === 'payment_intent.succeeded') && metadata && metadata.userId) {
    await recordTransaction(metadata, event.data.object);
    await activateFeatures(metadata, subscriptionId, event.data.object, currentPeriodEnd);
  }

  res.json({ received: true });
};

// --- 🟢 HELPERS ---
async function activateFeatures(metadata, subscriptionId, stripeObject, currentPeriodEnd) {
  const { userId, planId, stationId, planType, planName } = metadata;
  
  try {
    // 1. AGENCY ADS
    if (planType === 'agency_ad' || (planId && planId.startsWith('ad_'))) {
      const user = await User.findById(userId);
      if (user) {
        const rawAmount = stripeObject ? (stripeObject.amount_total || stripeObject.amount || 0) : 0;
        const amount = rawAmount > 0 ? (rawAmount / 100).toFixed(2) : "";
        if (typeof sendEmail === 'function') {
          const emailData = adPaymentSuccessEmail(user.fname || user.username, planName || planId, amount);
          await sendEmail({ to: user.email, subject: emailData.subject, html: emailData.html });
        }
      }
      return; 
    }

    // 2. BOOSTS
    if (planId && planId.startsWith('boost_')) {
      const parts = planId.split('_');
      const boostType = parts[1]; 
      const period = parts[2]; 
      let durationDays = (period === 'day') ? 1 : (period === 'month') ? 30 : (period === '3months') ? 90 : 365;

      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + durationDays);

      let updateStation = { boostStatus: true, boostExpiresAt: expireDate, position: 1 };
      if (boostType === 'global') updateStation.isFeatured = true;

      await Station.findByIdAndUpdate(stationId, { $set: updateStation });
    } 
    // 3. ΣΥΝΔΡΟΜΕΣ
    else {
      let updateData = { $set: { subscriptionStatus: 'active' } };
      
      // ΠΡΟΣΘΗΚΗ / ΑΝΑΝΕΩΣΗ ΣΤΟ ARRAY ΤΩΝ ΣΥΝΔΡΟΜΩΝ
      if (subscriptionId) {
        await User.findByIdAndUpdate(userId, {
          $pull: { activeSubscriptions: { planId: planId } }
        });
        
        updateData.$push = {
          activeSubscriptions: {
            planId: planId,
            stripeSubscriptionId: subscriptionId,
            status: 'active',
            currentPeriodEnd: currentPeriodEnd
          }
        };
      }
      
      if (planId === 'listener_premium') updateData.$set.isPremium = true;
      else if (planId === 'full_premium') {
        
        // 🟢 ΑΚΥΡΩΣΗ ADDONS ΑΝ ΑΓΟΡΑΣΕ PRO PLAN
        const user = await User.findById(userId);
        const addonIds = ['ad_control_solo', 'dsp_solo', 'analytics_solo'];
        const activeAddons = user.activeSubscriptions?.filter(s => addonIds.includes(s.planId) && s.status === 'active');
        
        if (activeAddons && activeAddons.length > 0) {
          for (let sub of activeAddons) {
            if (sub.stripeSubscriptionId) {
              try {
                await stripe.subscriptions.cancel(sub.stripeSubscriptionId); 
              } catch (e) { console.error("Stripe Cancel Error:", e.message); }
            }
          }
          await User.updateOne(
            { _id: userId },
            { $set: { "activeSubscriptions.$[elem].status": "canceled" } },
            { arrayFilters: [{ "elem.planId": { $in: addonIds } }] }
          );
        }

        updateData.$set["broadcasterProfile.tier"] = 'premium';
        updateData.$set["broadcasterProfile.features.adControl"] = true;
        updateData.$set["broadcasterProfile.features.dspEngine"] = true;
        updateData.$set["broadcasterProfile.features.analytics"] = true;
      } 
      else if (planId === 'ad_control_solo') updateData.$set["broadcasterProfile.features.adControl"] = true;
      else if (planId === 'dsp_solo') updateData.$set["broadcasterProfile.features.dspEngine"] = true;
      else if (planId === 'analytics_solo') updateData.$set["broadcasterProfile.features.analytics"] = true;

      await User.findByIdAndUpdate(userId, updateData);
      console.log(`✅ Πληρωμή Επιτυχής - Ενεργοποιήθηκε το πακέτο: ${planId}`);

      // 🟢 ΣΤΕΙΛΕ ΤΟ ΣΩΣΤΟ EMAIL ΕΠΙΒΕΒΑΙΩΣΗΣ (Listener ή Broadcaster)
      if (typeof sendEmail === 'function') {
        try {
          const userForMail = await User.findById(userId);
          
          if (userForMail && userForMail.email) {
            const rawAmount = stripeObject ? (stripeObject.amount_total || stripeObject.amount || 0) : 0;
            const amount = rawAmount > 0 ? (rawAmount / 100).toFixed(2) : "";
            const userName = userForMail.fname || userForMail.username || 'Χρήστη';

            let emailData;

            // Διαχωρισμός βάσει του ID του πακέτου!
            if (planId === 'listener_premium') {
              emailData = listenerPremiumSuccessEmail(userName, amount);
            } else {
              emailData = broadcasterPremiumSuccessEmail(userName, planName || planId, amount);
            }

            // Αποστολή (fire and forget)
            sendEmail({ 
              to: userForMail.email, 
              subject: emailData.subject, 
              html: emailData.html 
            }).catch(e => console.error("Stripe Success Email Send Error:", e));
          }
        } catch (e) { 
          console.error("Mail Error in Subscription:", e.message); 
        }
      }
    }
  } catch (err) { console.error("❌ Activation Error:", err.message); }
}

async function deactivateFeatures(subscription) {
  try {
    const subId = subscription.id;
    const customerId = subscription.customer;
    const metadata = subscription.metadata || {};
    const planId = metadata.planId;

    let updateData = { $set: {} };
    updateData.$pull = { activeSubscriptions: { stripeSubscriptionId: subId } };

    if (planId === 'ad_control_solo') updateData.$set["broadcasterProfile.features.adControl"] = false;
    else if (planId === 'dsp_solo') updateData.$set["broadcasterProfile.features.dspEngine"] = false;
    else if (planId === 'analytics_solo') updateData.$set["broadcasterProfile.features.analytics"] = false;
    else if (planId === 'listener_premium') updateData.$set.isPremium = false;
    else if (planId === 'full_premium' || !planId) {
      updateData.$set.isPremium = false;
      updateData.$set["broadcasterProfile.tier"] = 'free';
      updateData.$set["broadcasterProfile.features"] = { adControl: false, dspEngine: false, analytics: false };
    }

    await User.findOneAndUpdate({ stripeCustomerId: customerId }, updateData);
  } catch (err) {}
}

async function recordTransaction(metadata, stripeObject) {
  try {
    const { userId, planName, planType } = metadata;
    const rawAmount = stripeObject.amount_total || stripeObject.amount || 0;
    const amount = rawAmount / 100;
    
    if (isNaN(amount) || amount <= 0) return;

    // 1. Αποθηκεύουμε τη συναλλαγή στη βάση (Όπως το είχες)
    const newTx = new Transaction({
      user: userId, 
      stripeSessionId: stripeObject.id, 
      stripePaymentIntentId: stripeObject.payment_intent || stripeObject.id, 
      amount: amount, 
      planName: planName || "iRadios Service", 
      planType: planType || "subscription", 
      status: 'completed'
    });
    await newTx.save();

    // 2. 🟢 ΝΕΟ: Ειδοποίηση Admin για τη νέα πληρωμή
    // Βρίσκουμε τα στοιχεία του χρήστη που πλήρωσε
    const user = await User.findById(userId);
    
    if (user && typeof sendEmail === 'function') {
      const companyName = user.fname || user.username || 'Συνεργάτης';
      const userRole = user.role || 'user';
      
      // Δημιουργούμε το email (το admin email πρέπει να είναι το δικό σου, π.χ. "admin@iluma.gr" ή "payments@iradios.gr")
      const adminEmailAddress = process.env.ADMIN_EMAIL || "info@iradios.gr"; // Βάλε το πραγματικό email σου εδώ

      const alertMail = adminTransactionAlertEmail(companyName, amount.toFixed(2), planName || planType, user.email, userRole);
      
      // Το στέλνουμε! (Χωρίς await για να μην μπλοκάρει το webhook αν αργήσει ο SMTP server)
      sendEmail({
        to: adminEmailAddress,
        subject: alertMail.subject,
        html: alertMail.html
      }).catch(err => console.error("❌ Admin Alert Mail Error:", err.message));
    }

  } catch (err) {
    console.error("❌ Σφάλμα αποθήκευσης Transaction:", err.message);
  }
}

// --- 4. CANCEL SPECIFIC SUBSCRIPTION (USER TRIGGERED) ---
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { subscriptionId } = req.body; 

    if (!subscriptionId) return res.status(400).json({ error: "Λείπει το ID της συνδρομής (Stripe)." });

    let currentPeriodEnd = null;

    try {
      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true }
      );
      currentPeriodEnd = new Date(updatedSubscription.current_period_end * 1000);
    } catch (stripeErr) {
      if (stripeErr.code === 'resource_missing' || stripeErr.message.includes('No such subscription') || stripeErr.message.includes('canceled')) {
        console.log("ℹ️ Η συνδρομή δεν βρέθηκε στο Stripe. Καθαρίζουμε τη βάση...");
      } else {
        throw stripeErr;
      }
    }

    await User.findOneAndUpdate(
      { _id: userId, "activeSubscriptions.stripeSubscriptionId": subscriptionId },
      { 
        $set: { 
          "activeSubscriptions.$.status": "canceled",
          "activeSubscriptions.$.currentPeriodEnd": currentPeriodEnd || new Date()
        } 
      }
    );

    res.json({ 
      message: "Η συνδρομή ακυρώθηκε επιτυχώς και θα λήξει στο τέλος της περιόδου.",
      currentPeriodEnd: currentPeriodEnd 
    });

  } catch (error) {
    res.status(500).json({ error: error.message || "Αποτυχία επικοινωνίας με το Stripe." });
  }
};
