import AboutSvelte from "./routes/About.svelte";
import HomeSvelte from "./routes/Home.svelte";
import RaceSvelte from "./routes/Race.svelte";
import NotFoundSvelte from "./routes/NotFound.svelte";

export const routes = {
  "/": HomeSvelte,
  "/race/:seed": RaceSvelte,
  "/about": AboutSvelte,
  "*": NotFoundSvelte
};