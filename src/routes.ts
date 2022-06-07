import AboutSvelte from "./routes/About.svelte";
import HomeSvelte from "./routes/Home.svelte";
import RaceSvelte from "./routes/Race.svelte";
import NotFoundSvelte from "./routes/NotFound.svelte";
import RandomRaceSvelte from "./routes/RandomRace.svelte";
import TestSvelte from "./routes/Test.svelte";

export const routes = {
  "/": HomeSvelte,
  "/race/:seed": RaceSvelte,
  "/race": RandomRaceSvelte,
  "/about": AboutSvelte,
  "/test/:seed": TestSvelte,
  "*": NotFoundSvelte
};