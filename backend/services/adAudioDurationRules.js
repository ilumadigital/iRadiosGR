'use strict';
const MAX_AUDIO_SPOT_DURATION_SECONDS=46;
const MIN_PLAYABLE_AUDIO_SECONDS=0.5;
const MIN_BILLABLE_AUDIO_SECONDS=10;
const TOO_SHORT_MESSAGE='Το Audio Spot πρέπει να έχει διάρκεια τουλάχιστον 10 δευτερολέπτων ώστε να μπορεί να χρεωθεί έγκυρη ακρόαση.';
const MAX_LEGACY_BROADCASTER_AUDIO_SECONDS=600;
const TOO_LONG_MESSAGE='Το Audio Spot υπερβαίνει τη μέγιστη επιτρεπόμενη διάρκεια των 46 δευτερολέπτων. Παρακαλούμε ανεβάστε νέο αρχείο μικρότερης διάρκειας.';

const isAudioSpotTooShort=seconds=>Number.isFinite(seconds)&&seconds<MIN_BILLABLE_AUDIO_SECONDS;
const isAudioSpotTooLong=seconds=>Number.isFinite(seconds)&&
  seconds>MAX_AUDIO_SPOT_DURATION_SECONDS;
const isPlayableAudioDuration=seconds=>Number.isFinite(seconds)&&
  seconds>=MIN_PLAYABLE_AUDIO_SECONDS&&
  seconds<=MAX_LEGACY_BROADCASTER_AUDIO_SECONDS;
module.exports={MAX_AUDIO_SPOT_DURATION_SECONDS,TOO_LONG_MESSAGE,
  MIN_BILLABLE_AUDIO_SECONDS,TOO_SHORT_MESSAGE,isAudioSpotTooShort,
  isAudioSpotTooLong,isPlayableAudioDuration};
