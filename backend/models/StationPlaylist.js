'use strict';
const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  raw: {type:String,required:true,maxlength:300},
  artist: {type:String,required:true,maxlength:150},
  title: {type:String,required:true,maxlength:150},
  source: {type:String,enum:['station','acrcloud'],default:'station'},
  playedAt: {type:Date,required:true}
},{_id:false});

// Latest confirmed native song: shared by all clients without an upstream request.
// confirmedAt is refreshed by the background worker even for the SAME song;
// changedAt stays fixed until artist/title changes, avoiding UI/cache churn.
const nativeSchema = new mongoose.Schema({
  raw: {type:String,required:true,maxlength:300},
  artist: {type:String,required:true,maxlength:150},
  title: {type:String,required:true,maxlength:150},
  changedAt: {type:Date,required:true},
  confirmedAt: {type:Date,required:true}
},{_id:false});

// Station-wide current recognition, persisted in the same document as history.
// It is not a permanent song: readers MUST check expiresAt before showing it.
const recognitionSchema = new mongoose.Schema({
  raw: {type:String,required:true,maxlength:300},
  artist: {type:String,required:true,maxlength:150},
  title: {type:String,required:true,maxlength:150},
  kind: {type:String,enum:['manual','auto'],required:true},
  recognizedAt: {type:Date,required:true},
  expiresAt: {type:Date,required:true}
},{_id:false});

const schema = new mongoose.Schema({
  stationId:{type:mongoose.Schema.Types.ObjectId,ref:'Station',required:true,unique:true,index:true},
  tracks:{type:[trackSchema],default:[]},
  currentAI:{type:recognitionSchema,default:undefined},
  nativeNow:{type:nativeSchema,default:undefined}
},{timestamps:true});
schema.index({'currentAI.expiresAt':1});
schema.index({'nativeNow.confirmedAt':1});
module.exports=mongoose.model('StationPlaylist',schema);
