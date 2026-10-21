import "server-only";
import { findCustomTheme } from "./custom/server";
import type { StarterId,ThemeId } from "./catalog";
export async function getStarter(_owner:string):Promise<StarterId|null>{return null;}
export async function canUseTheme(owner:string,theme:ThemeId,customId?:string){return theme!=="custom"||!!(await findCustomTheme(owner,customId));}
