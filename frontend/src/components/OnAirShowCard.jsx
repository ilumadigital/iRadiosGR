import React from 'react';
import { Radio } from 'lucide-react';
import {validShowImage} from '../utils/liveBroadcast';
import '../styles/fullscreen-player.css';

// Permanently shows the station schedule, regardless of which RDS image is up.
export default function OnAirShowCard({show,stationName='',className=''}) {
  if(!show?.title&&!show?.host)return null;
  const photo=validShowImage(show.imageUrl)?show.imageUrl:null;
  return (
    <div className={'ir-onair-show '+className}>
      <div className="ir-onair-show__avatar">
        {photo?<img src={photo} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>:<Radio size={20} aria-hidden="true"/>}
      </div>
      <div className="ir-onair-show__body">
        <span className="ir-onair-show__eyebrow"><span className="ir-onair-show__dot"/> ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ</span>
        <span className="ir-onair-show__title" title={show.title||stationName}>{show.title||stationName}</span>
        {show.host&&<span className="ir-onair-show__host" title={show.host}>{show.host}</span>}
      </div>
    </div>
  );
}
