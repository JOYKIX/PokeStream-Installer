export const dynamic="force-dynamic";
export async function GET(){return Response.json({app:"PokeStream",instance:process.env.POKESTREAM_INSTANCE??null},{headers:{"Cache-Control":"no-store"}});}
