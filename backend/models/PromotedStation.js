'use strict';
const mongoose = require('mongoose');

// One independent, editorially curated station per genre/region page.
const promotedSchema = new mongoose.Schema({
  placement: {type:String,required:true,enum:['genre','region','news']},
  placementValue: {type:String,required:true,trim:true,maxlength:120},
  stationId: {type:mongoose.Schema.Types.ObjectId,ref:'Station',required:true},
  enabled: {type:Boolean,default:true},
  campaignId: {type:String,default:'',index:true}
},{timestamps:true});
promotedSchema.index({placement:1,placementValue:1},{unique:true});
module.exports = mongoose.model('PromotedStation',promotedSchema);
