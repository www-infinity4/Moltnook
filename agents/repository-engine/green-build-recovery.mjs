/** Safely distinguish a genuine Green model blocker from an invalid edit. */
export function requireGreenEdits(proposal){
 if(!proposal||!Array.isArray(proposal.edits))
  throw Error('Green proposal has no edits array; expected exact bounded source edits');
 if(proposal.edits.length===0){
  const reason=typeof proposal.reason==='string'?proposal.reason.trim().slice(0,450):'';
  throw Error('Green returned no bounded edits: '+(reason||'No actionable source context was identified'));
 }
 return proposal.edits;
}

/** An empty response can justify ONE bounded source window replan, never a write. */
export function greenReplanDecision(feedback,task){
 const build=feedback?.stage==='build';
 const reason=String(feedback?.reason||'');
 const empty=reason.startsWith('Green returned no bounded edits:');
 const outside=reason.includes('Model attempted an edit outside the pinned source windows');
 if(!build||(!empty&&!outside))return {eligible:false,task:String(task||'').slice(0,1800)};
 const focus=empty?reason.slice('Green returned no bounded edits:'.length).trim().slice(0,360):'';
 return {eligible:true,task:(focus+' '+String(task||'')).trim().slice(0,2100),sourceOnly:true,
  permissionsExpanded:false};
}
