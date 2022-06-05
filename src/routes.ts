import AboutSvelte from "./routes/About.svelte";
import HomeSvelte from "./routes/Home.svelte";
import RaceSvelte from "./routes/Race.svelte";
import NotFoundSvelte from "./routes/NotFound.svelte";
import RandomRaceSvelte from "./routes/RandomRace.svelte";

export const routes = {
  "/": HomeSvelte,
  "/race/:seed": RaceSvelte,
  "/race": RandomRaceSvelte,
  "/about": AboutSvelte,
  "*": NotFoundSvelte
};