import React from 'react';
import {Navigate} from 'react-router-dom';
// Legacy broadcaster premium URL. The live catalogue and signed checkout
// are exclusively rendered in the current Broadcaster Commerce page.
export default function GoPremiumBroadcast(){return <Navigate to="/backoffice/pro-features" replace/>;}
