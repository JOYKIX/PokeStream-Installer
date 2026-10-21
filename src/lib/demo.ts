import { emptyScene, type SceneData, type Pokemon } from "./model";
export const DEMO_STORAGE = "pokestream-demo-v1";
const team: Pokemon[] = [
  {
    speciesId: 6,
    pokemonId: 6,
    name: "Dracaufeu",
    apiName: "charizard",
    nickname: "Flamme",
    level: 42,
    shiny: false,
    fainted: false,
    item: "",
    types: ["fire", "flying"],
  },
  {
    speciesId: 94,
    pokemonId: 94,
    name: "Ectoplasma",
    apiName: "gengar",
    nickname: "",
    level: 38,
    shiny: false,
    fainted: false,
    item: "",
    types: ["ghost", "poison"],
  },
  {
    speciesId: 130,
    pokemonId: 130,
    name: "Léviator",
    apiName: "gyarados",
    nickname: "",
    level: 40,
    shiny: true,
    fainted: false,
    item: "",
    types: ["water", "flying"],
  },
  {
    speciesId: 197,
    pokemonId: 197,
    name: "Noctali",
    apiName: "umbreon",
    nickname: "",
    level: 36,
    shiny: false,
    fainted: false,
    item: "",
    types: ["dark"],
  },
  {
    speciesId: 448,
    pokemonId: 448,
    name: "Lucario",
    apiName: "lucario",
    nickname: "",
    level: 39,
    shiny: false,
    fainted: false,
    item: "",
    types: ["fighting", "steel"],
  },
];
export function demoScene(): SceneData {
  return {
    ...emptyScene("Objectif Ligue", "kanto"),
    team: [...team, null],
    badges: [0, 1, 2, 3],
    nuzlocke: true,
    deaths: 2,
  };
}

// Preview data never passes through scene updates, Connect snapshots or OBS URLs.
const previewTeam: Pokemon[] = [
  ...team.map(
    (pokemon, index): Pokemon => ({
      ...pokemon,
      nickname: "",
      gender: index % 2 ? "female" : "male",
      hp: [120, 48, 15, 0, 100][index],
      maxHp: 120,
      fainted: index === 3,
      item: ["charcoal", "oran-berry", "leftovers", "", "focus-sash"][index],
    }),
  ),
  {
    speciesId: 25,
    pokemonId: 25,
    name: "Pikachu",
    apiName: "pikachu",
    nickname: "",
    level: 35,
    shiny: false,
    fainted: false,
    gender: "female",
    hp: 82,
    maxHp: 100,
    item: "light-ball",
    types: ["electric"],
  },
];
export function withDemoTeam(scene: SceneData): SceneData {
  return { ...scene, team: previewTeam };
}
