import fs from 'node:fs';
import path from 'node:path';
export function prepareLauncher(root=process.cwd()){
 const directory=path.join(root,'.artifacts/runtime/launcher'),assets=path.join(directory,'assets');fs.mkdirSync(assets,{recursive:true});
 for(const file of ['launcher.html','launcher.css','launcher.js','runtime-install.ps1','update-install.ps1','server.cjs'])fs.copyFileSync(path.join(root,'desktop/app',file),path.join(directory,file));
 fs.copyFileSync(path.join(root,'public/logo/pokestream-logo-no-stand.svg'),path.join(assets,'logo.svg'));
 fs.copyFileSync(path.join(root,'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),path.join(assets,'inter.woff2'));
 fs.copyFileSync(path.join(root,'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2'),path.join(assets,'space.woff2'));
 return directory;
}
