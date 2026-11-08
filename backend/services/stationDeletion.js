'use strict';

// Delete exactly one station record after explicit name confirmation.
// Files and shared operational records are deliberately not recursively removed;
// deleting by a legacy/imported slug can erase another station's artwork.
class StationDeletionError extends Error {
  constructor(status,message){
    super(message);
    this.status=status;
  }
}
async function deleteStationRecord({Station,stationId,confirmationName}){
  if(!/^[0-9a-f]{24}$/i.test(String(stationId||'')))
    throw new StationDeletionError(400,'Μη έγκυρο αναγνωριστικό σταθμού.');
  if(typeof confirmationName!=='string'||!confirmationName||confirmationName.length>200)
    throw new StationDeletionError(400,'Πληκτρολόγησε το ακριβές όνομα του σταθμού για επιβεβαίωση.');
  const station=await Station.findById(stationId);
  if(!station)throw new StationDeletionError(404,'Ο σταθμός δεν βρέθηκε.');
  if(station.name!==confirmationName)
    throw new StationDeletionError(409,'Το όνομα επιβεβαίωσης δεν ταιριάζει με τον σταθμό.');
  // Atomic condition protects against deleting a renamed station during review.
  const deleted=await Station.deleteOne({_id:stationId,name:confirmationName});
  if(deleted.deletedCount!==1)
    throw new StationDeletionError(409,'Ο σταθμός άλλαξε πριν από τη διαγραφή. Ανανέωσε τη σελίδα.');
  return {_id:String(station._id),name:station.name};
}
module.exports={deleteStationRecord,StationDeletionError};
