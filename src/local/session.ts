import "server-only";
import { isLocal } from "./runtime";
import { readStore } from "./store";
export async function getUser(){
 if(!isLocal())return null;
 const state=readStore(),user=state.users.find(u=>u.id===state.settings.activeUser);
 return user?{id:user.id,name:user.name,avatar:user.avatar,color:user.color,email:"",closing:false}:null;
}
export const getSessionIdentity=getUser;
