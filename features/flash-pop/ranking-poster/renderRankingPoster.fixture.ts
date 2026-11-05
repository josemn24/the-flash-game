import { writeFile } from "node:fs/promises";
import path from "node:path";
import { generateRankingPoster, type RankingPosterInput } from "./renderRankingPoster";

const [, , directory, inputs] = process.argv;
const posters: RankingPosterInput[] = JSON.parse(inputs);
await Promise.all(
  posters.map(async (input, index) => {
    const png = await generateRankingPoster(input);
    await writeFile(path.join(directory, `${index}.png`), png);
  }),
);
