import type { SceneData } from "./model";
import type { StarterId } from "@/themes/catalog";
export function premiumGrade(_grade?:string|null){return true;}
export function availableTheme(data:SceneData,_active?:boolean,_starter?:StarterId|null){return data;}
