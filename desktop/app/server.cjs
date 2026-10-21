// Node subprocess supervisor: a crashed launcher must not leave port 47653 occupied.
const path=require('node:path');
const parent=Number(process.env.POKESTREAM_PARENT_PID);
if(!Number.isSafeInteger(parent)||parent<1)throw Error('Missing launcher identity.');
setInterval(()=>{try{process.kill(parent,0);}catch{process.exit(0);}},2000).unref();
require(path.resolve(process.argv[2]));
