import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SBR_MAP_SOURCE = path.join(repositoryRoot, "public/visuals/sbr/usa-location-map.svg");
export const SBR_MAP_OUTPUT = path.join(repositoryRoot, "public/visuals/sbr/usa-location-map.png");

export async function rasterizeSbrMap({
  inputPath = SBR_MAP_SOURCE,
  outputPath = SBR_MAP_OUTPUT,
} = {}) {
  const result = await sharp(inputPath)
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toFile(outputPath);
  if (result.width !== 1859 || result.height !== 968) {
    throw new Error(`Unexpected SBR map dimensions: ${result.width}x${result.height}`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await rasterizeSbrMap();
  console.log(
    `Generated ${path.relative(repositoryRoot, SBR_MAP_OUTPUT)} (${result.width}x${result.height}).`,
  );
}
