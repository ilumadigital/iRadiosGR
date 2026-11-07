'use strict';
const router = require('express').Router();
const c = require('../controllers/homeSlideController');
const { protect } = require('../utils/authMiddleware');
const { authorizeRoles } = require('../utils/roleMiddleware');
const multer=require('multer');
const crypto=require('crypto');
const fs=require('fs').promises;
const path=require('path');
const uploader=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1}});
const imageType=(file)=>{
  const b=file?.buffer;
  if(!b||b.length<12) return null;
  if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'jpg';
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'webp';
  return null;
};

router.get('/home-slides', c.publicSlides);
// Defense-in-depth in production as well as in isolated staging.
router.use('/admin/home-slides', protect, authorizeRoles('admin'));
// Admin-only, bounded image upload with magic-byte checks (not client MIME alone).
router.post('/admin/home-slides/upload', (req,res)=>{
  uploader.single('imageFile')(req,res,async err=>{
    if(err)return res.status(400).json({error:'Η εικόνα πρέπει να είναι έως 8MB.'});
    const ext=imageType(req.file);
    if(!ext)return res.status(400).json({error:'Δέχονται μόνο πραγματικές εικόνες JPG, PNG, WebP.'});
    try{
      const dir=path.join(process.cwd(),'uploads','visuals','slides');
      await fs.mkdir(dir,{recursive:true});
      const name=crypto.randomUUID()+'.'+ext;
      await fs.writeFile(path.join(dir,name),req.file.buffer,{flag:'wx',mode:0o644});
      res.json({url:'__IRADIOS_SITE_ORIGIN__/media/visuals/slides/'+name});
    }catch{
      res.status(503).json({error:'Αποτυχία αποθήκευσης εικόνας.'});
    }
  });
});
router.get('/admin/home-slides', c.adminSlides);
router.post('/admin/home-slides', c.create);
router.put('/admin/home-slides/:id', c.update);
router.delete('/admin/home-slides/:id', c.remove);
module.exports = router;
