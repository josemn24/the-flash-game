import postcss from "postcss";

export function readColorTokens(source) {
  const tokens = new Map();
  postcss.parse(source).walkDecls((decl) => {
    if (decl.prop.startsWith("--")) tokens.set(decl.prop, decl.value);
  });
  return tokens;
}

function splitArguments(value) {
  let depth = 0;
  let start = 0;
  const parts = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth -= 1;
    if (value[index] === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  return [...parts, value.slice(start).trim()];
}

/** RGBA in sRGB, including premultiplied-alpha color-mix and recursive aliases. */
export function resolveColor(value, tokens = new Map(), stack = []) {
  value = value.trim().replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  if (tokens.has(value)) value = `var(${value})`;
  if (value.startsWith("var(")) {
    const [name] = splitArguments(value.slice(4, -1));
    if (!tokens.has(name)) throw new Error(`Unknown token ${name}`);
    if (stack.includes(name)) throw new Error(`Token cycle ${[...stack, name].join(" → ")}`);
    return resolveColor(tokens.get(name), tokens, [...stack, name]);
  }
  if (value.startsWith("color-mix(in srgb,")) {
    const [, left, right] = splitArguments(value.slice(10, -1));
    const parse = (part) => {
      const match = part.match(/^(.*)\s+([\d.]+)%$/);
      return {
        color: resolveColor(match ? match[1] : part, tokens, stack),
        weight: match ? Number(match[2]) / 100 : undefined,
      };
    };
    const a = parse(left);
    const b = parse(right);
    const aw = a.weight ?? (b.weight === undefined ? 0.5 : 1 - b.weight);
    const bw = b.weight ?? 1 - aw;
    const total = aw + bw;
    const alpha = (a.color[3] * aw + b.color[3] * bw) / total;
    const rgb = [0, 1, 2].map((index) =>
      alpha
        ? (a.color[index] * a.color[3] * aw + b.color[index] * b.color[3] * bw) / total / alpha
        : 0,
    );
    return [...rgb, alpha * Math.min(total, 1)];
  }
  if (/^#[\da-f]{6}$/i.test(value))
    return [
      ...value
        .slice(1)
        .match(/../g)
        .map((part) => parseInt(part, 16) / 255),
      1,
    ];
  if (value === "white") return [1, 1, 1, 1];
  if (value === "black") return [0, 0, 0, 1];
  if (value === "transparent") return [0, 0, 0, 0];
  const rgb = value.match(/^rgba?\((.*)\)$/);
  const srgb = value.match(/^color\(srgb (.*)\)$/);
  if (rgb || srgb) {
    const parts = (rgb?.[1] ?? srgb[1]).replace(/[,/]/g, " ").split(/\s+/).filter(Boolean);
    const channel = (part, divisor) => parseFloat(part) / (part.endsWith("%") ? 100 : divisor);
    return [
      ...parts.slice(0, 3).map((part) => channel(part, rgb ? 255 : 1)),
      parts[3] ? channel(parts[3], 1) : 1,
    ];
  }
  throw new Error(`Unsupported color ${value}`);
}

export function composite(foreground, background) {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  return [
    ...[0, 1, 2].map(
      (index) =>
        (foreground[index] * foreground[3] +
          background[index] * background[3] * (1 - foreground[3])) /
        alpha,
    ),
    alpha,
  ];
}

export function contrast(foreground, background, canvas = [1, 1, 1, 1]) {
  const bg = composite(background, canvas);
  const fg = composite(foreground, bg);
  const luminance = (rgba) =>
    rgba
      .slice(0, 3)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
