import type { CustomThemeConfig } from "./schema";
import { customThemeVariables } from "./appearance";
export function CustomThemeSample({ config }: { config: CustomThemeConfig }) {
 return <span className="theme-sample theme-custom" aria-hidden="true" style={customThemeVariables(config)}>
   <span className="theme-preview-card"><i className="theme-preview-screen"><i/></i><i className="theme-preview-name"/><i className="theme-preview-level"/><i className="theme-preview-hp"/></span>
   <span className="theme-preview-case"><i/><i/><i/></span>
 </span>;
}

