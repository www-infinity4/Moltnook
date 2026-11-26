// Only optional root discovery may skip a symlink. Required source and agent
// instructions continue through the strict reader without this exception.
export async function readOptionalRootReadme(read,report){
 try{
  const text=await read('README.md');
  report.rootReadme={path:'README.md',state:text===null?'missing':'read'};
  return text;
 }catch(error){
  if(error?.code!=='writer_symlink_source')throw error;
  report.rootReadme={path:'README.md',state:'skipped_symlink'};
  return null;
 }
}
