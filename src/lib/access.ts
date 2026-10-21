export type Grade="free"|"pro"|"owner"|"vip"|null;
export type Access={grade:Grade;linked:boolean;active:boolean;state:"active"|"unavailable";vipExpiresAt?:string|null};
export async function getAccess(_owner:string):Promise<Access>{return {grade:null,linked:false,active:true,state:"active"};}
