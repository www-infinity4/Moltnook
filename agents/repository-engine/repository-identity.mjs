// Bind the claimed job to API metadata before checkout; no model identity claims.
export function verifyRepositoryIdentity(repository, meta) {
 if(typeof repository!=='string'||!/^www-infinity4\/[A-Za-z0-9_.-]+$/.test(repository))
  throw Error('repository_identity_scope_mismatch');
 const [owner,name]=repository.split('/');
 if(meta?.full_name!==repository||meta?.owner?.login!==owner||meta?.name!==name||
    !Number.isSafeInteger(meta?.id)||meta.id<=0||
    (repository==='www-infinity4/QuantaPhi'&&meta.id!==1380883643))
  throw Error('repository_identity_metadata_mismatch');
 if(typeof meta.default_branch!=='string'||!meta.default_branch.trim())
  throw Error('repository_identity_default_branch_missing');
 return {repository,repositoryId:meta.id,owner,defaultBranch:meta.default_branch,
  metadataVerified:true,writeExecuted:false,deploymentVerified:false};
}
