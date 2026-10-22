import fs from 'node:fs';
import path from 'node:path';
export function prepareLauncher(root=process.cwd(),target){
 const directory=(target||path.join(root,'.artifacts/runtime/launcher')),assets=path.join(directory,'assets');fs.mkdirSync(assets,{recursive:true});
 for(const file of ['launcher.html','launcher.css','launcher-locales.js','launcher.js','loading.html','runtime-install.ps1','update-install.ps1','uninstall.ps1','maintenance-common.ps1','release-notes.json','server.cjs'])fs.copyFileSync(path.join(root,'desktop/app',file),path.join(directory,file));
 fs.copyFileSync(path.join(root,'public/logo/pokestream-logo-no-stand.svg'),path.join(assets,'logo.svg'));
 fs.cpSync(path.join(root,'public/flags'),path.join(assets,'flags'),{recursive:true});
 fs.copyFileSync(path.join(root,'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),path.join(assets,'inter.woff2'));
 fs.copyFileSync(path.join(root,'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2'),path.join(assets,'space.woff2'));

 for(const name of ['LICENSE','OPEN-SOURCE-NOTICES.md'])fs.copyFileSync(path.join(root,name),path.join(directory,name));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),notes=JSON.parse(fs.readFileSync(path.join(root,'desktop/app/release-notes.json'),'utf8'));
 if(notes.version!==manifest.version||notes.launcherVersion!==manifest.launcherVersion)throw Error('Release notes do not match application and launcher versions.');
 return directory;
}
