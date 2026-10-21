import type { Pokemon, SceneData } from "@/lib/model";

function pokemon(
  id: number,
  name: string,
  apiName: string,
  types: Pokemon["types"],
  level: number,
  hp: number,
  maxHp: number,
  gender: Pokemon["gender"] = "male",
): Pokemon {
  return {
    speciesId: id,
    pokemonId: id,
    name,
    apiName,
    types,
    level,
    hp,
    maxHp,
    gender,
    nickname: "",
    shiny: false,
    fainted: false,
    item: "",
  };
}

// Public sample data only: the homepage never reads or writes a user's scenes.
export const homeScene: SceneData = {
  name: "Sinnoh",
  game: "sinnoh",
  team: [
    pokemon(389, "Torterra", "torterra", ["grass", "ground"], 46, 154, 154),
    pokemon(
      398,
      "Étouraptor",
      "staraptor",
      ["normal", "flying"],
      44,
      108,
      138,
      "female",
    ),
    pokemon(405, "Luxray", "luxray", ["electric"], 45, 127, 142),
    pokemon(419, "Mustéflott", "floatzel", ["water"], 43, 68, 144, "female"),
    pokemon(448, "Lucario", "lucario", ["fighting", "steel"], 45, 122, 122),
    pokemon(445, "Carchacrok", "garchomp", ["dragon", "ground"], 48, 162, 168),
  ],
  badges: [0, 1, 2, 3, 4, 5],
  nuzlocke: true,
  deaths: 2,
  style: {
    theme: "carbon",
    accent: "#ef3340",
    orientation: "horizontal",
    teamLayout: "6x1",
    sprite: "artwork",
    showNames: true,
    showLevels: true,
    showTypes: true,
    showItems: false,
    showBadges: true,
    badgeColumns: 8,
    badgeBackground: true,
    showGender: true,
    showHealth: true,
    showHealthValues: true,
    scale: 1,
  },
};
