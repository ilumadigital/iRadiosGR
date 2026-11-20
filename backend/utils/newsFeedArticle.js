'use strict';
const crypto=require('node:crypto');
// Stable, opaque, URL-derived keys. RSS GUIDs are not safe URL path segments.
const keyFor=url=>crypto.createHash('sha256').update(String(url||'')).digest('hex').slice(0,24);
function publicArticle(article){
  const a=article?.toObject?.()||article||{};
  return {key:keyFor(a.url),title:a.title||'',summary:a.summary||'',
    previewParagraphs:Array.isArray(a.previewParagraphs)?a.previewParagraphs:[],
    imageUrl:a.imageUrl||'',url:a.url||'',publishedAt:a.publishedAt||null,
    source:a.source||'',category:a.category||''};
}
function relatedArticles(articles,current,limit=4){
  const category=String(current?.category||'');
  const key=keyFor(current?.url);
  return (articles||[]).filter(a=>a.url&&keyFor(a.url)!==key&&
    (!category||a.category===category))
    .sort((a,b)=>(new Date(b.publishedAt||0).getTime()||0)-
      (new Date(a.publishedAt||0).getTime()||0))
    .slice(0,limit).map(publicArticle);
}
module.exports={keyFor,publicArticle,relatedArticles};
