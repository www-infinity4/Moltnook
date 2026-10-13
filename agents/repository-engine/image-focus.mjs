export function changedRegion(before,after,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||before.length!==width*height*4||after.length!==before.length)throw Error('invalid_pixel_pair');
 let left=width,top=height,right=0,bottom=0,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]))<55)continue;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);count++;}
 if(count<Math.max(8,width*height*.0005))return null;
 const pad=12;left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(width,right+pad);bottom=Math.min(height,bottom+pad);
 return {x:left/width,y:top/height,width:(right-left)/width,height:(bottom-top)/height,method:'pixel-difference',changedPixels:count,imageWidth:width,imageHeight:height};
}
export async function focusPair(browser,images){
 const page=await browser.newPage();
 try{return await page.evaluate(async({images,compute})=>{
  const load=src=>new Promise((ok,fail)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=fail;i.src=src});
  const a=await load(images.before),b=await load(images.after),w=Math.max(a.width,b.width),h=Math.max(a.height,b.height);
  const pixels=image=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0);return ctx.getImageData(0,0,w,h).data};
  return (0,eval)('('+compute+')')(pixels(a),pixels(b),w,h);
 },{images,compute:changedRegion.toString()});}finally{await page.close()}
}
