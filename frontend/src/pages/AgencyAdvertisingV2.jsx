import React from 'react';
import AdvertisingCampaignWizard from './AdvertisingCampaignWizard';

// Campaign setup, creatives, budget, quote, Nexi and Admin submission are
// ONE ordered Agency workflow. Legacy v2 multi-form screen is retired.
export default function AgencyAdvertisingV2(){
 return <AdvertisingCampaignWizard role="agency"/>;
}
