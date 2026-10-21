import type { SceneData } from "./model";
export type Badge = { name: string; image: string };
const numbered = (folder: string, suffix: string, names: string[]): Badge[] =>
  names.map((name, i) => ({
    name,
    image: `/Badges/${folder}/Badge_${i + 1}_${suffix}.png`,
  }));
const galar = (version: "Epee" | "Bouclier"): Badge[] =>
  [
    "Plante",
    "Eau",
    "Feu",
    version === "Epee" ? "Combat" : "Spectre",
    "Fée",
    version === "Epee" ? "Roche" : "Glace",
    "Ténèbres",
    "Dragon",
  ].map((name, i) => ({
    name,
    image: `/Badges/Galar/Badge_${i + 1}_Galar${i === 3 || i === 5 ? `_${version}` : ""}.png`,
  }));
export const GAMES: Record<
  SceneData["game"],
  { label: string; region: string; badges: Badge[] }
> = {
  kanto: {
    label: "Rouge · Bleu · Jaune",
    region: "Kanto",
    badges: numbered("Kanto", "Kanto", [
      "Roche",
      "Cascade",
      "Foudre",
      "Prisme",
      "Âme",
      "Marais",
      "Volcan",
      "Terre",
    ]),
  },
  johto: {
    label: "Or · Argent · Cristal",
    region: "Johto",
    badges: numbered("Johto", "Johto", [
      "Zéphyr",
      "Essaim",
      "Plaine",
      "Brume",
      "Choc",
      "Minéral",
      "Glacier",
      "Lever",
    ]),
  },
  hoenn: {
    label: "Rubis · Saphir · Émeraude",
    region: "Hoenn",
    badges: numbered("Hoenn", "Hoenn", [
      "Roche",
      "Poing",
      "Dynamo",
      "Chaleur",
      "Balancier",
      "Plume",
      "Esprit",
      "Pluie",
    ]),
  },
  sinnoh: {
    label: "Diamant · Perle · Platine",
    region: "Sinnoh",
    badges: numbered("Sinnoh", "Sinnoh", [
      "Charbon",
      "Forêt",
      "Pavé",
      "Palustre",
      "Fantôme",
      "Mine",
      "Glaçon",
      "Phare",
    ]),
  },
  unova: {
    label: "Noir · Blanc",
    region: "Unys",
    badges: numbered("Unys/BW", "Unys_BW", [
      "Triple",
      "Basique",
      "Élytre",
      "Volt",
      "Sismique",
      "Jet",
      "Stalactite",
      "Mythe",
    ]),
  },
  unova2: {
    label: "Noir 2 · Blanc 2",
    region: "Unys",
    badges: numbered("Unys/B2W2", "Unys_B2W2", [
      "Basique",
      "Toxic",
      "Élytre",
      "Volt",
      "Sismique",
      "Jet",
      "Mythe",
      "Vague",
    ]),
  },
  kalos: {
    label: "X · Y",
    region: "Kalos",
    badges: numbered("Kalos", "Kalos", [
      "Coléoptère",
      "Mur",
      "Lutte",
      "Végétal",
      "Tension",
      "Nymphe",
      "Psychisme",
      "Iceberg",
    ]),
  },
  alola: { label: "Soleil · Lune · Ultra", region: "Alola", badges: [] },
  hisui: { label: "Légendes Arceus", region: "Hisui", badges: [] },
  "galar-sword": { label: "Épée", region: "Galar", badges: galar("Epee") },
  "galar-shield": {
    label: "Bouclier",
    region: "Galar",
    badges: galar("Bouclier"),
  },
  paldea: {
    label: "Écarlate · Violet",
    region: "Paldea",
    badges: [
      ...[
        "Insecte",
        "Plante",
        "Electrik",
        "Eau",
        "Normal",
        "Spectre",
        "Psy",
        "Glace",
      ].map((name) => ({
        name: `Arène ${name}`,
        image: `/Badges/Paldea/Arene/Badge_${name}_Paldea.png`,
      })),
      ...["Roche", "Vol", "Acier", "Sol", "Dragon"].map((name) => ({
        name: `Dominant ${name}`,
        image: `/Badges/Paldea/Dominant/Badge_${name}_Paldea.png`,
      })),
      ...["Tenebres", "Feu", "Poison", "Fee", "Combat"].map((name) => ({
        name: `Team Star ${name}`,
        image: `/Badges/Paldea/Team/Badge_${name}_Paldea.png`,
      })),
    ],
  },
};
