'use strict';
const mongoose = require('mongoose');
const trackSchema = new mongoose.Schema({
  raw: {type:String,required:true,maxlength:300},
  artist: {type:String,required:true,maxlength:150},
  title: {type:String,required:true,maxlength:150},
  source: {type:String,enum:['station','acrcloud'],default:'station'},
  playedAt: {type:Date,required:true}
},{_id:false});
const schema = new mongoose.Schema({
  stationId:{type:mongoose.Schema.Types.ObjectId,ref:'Station',required:true,unique:true,index:true},
  tracks:{type:[trackSchema],default:[]}
},{timestamps:true});
module.exports=mongoose.model('StationPlaylist',schema);
