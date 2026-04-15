const fs = require('fs');
let content = fs.readFileSync('src/app/globals.css', 'utf-8');

// Replace @theme warning
content = content.replace(/@theme \{[\s\S]*?\}/, '/* removed @theme to fix warning, using @layer base instead */');

// rgba(99, 102, 241, opacity) -> color-mix(in srgb, var(--accent) opacity%, transparent)
content = content.replace(/rgba\(\s*99\s*,\s*102\s*,\s*241\s*,\s*([\d.]+)\)/g, (match, opacityStr) => {
  const op = parseFloat(opacityStr);
  return `color-mix(in srgb, var(--accent) ${op * 100}%, transparent)`;
});

// rgba(129, 140, 248, opacity) -> color-mix(in srgb, var(--accent-secondary) opacity%, transparent)
content = content.replace(/rgba\(\s*129\s*,\s*140\s*,\s*248\s*,\s*([\d.]+)\)/g, (match, opacityStr) => {
  const op = parseFloat(opacityStr);
  return `color-mix(in srgb, var(--accent-secondary) ${op * 100}%, transparent)`;
});

// Hex replacements
content = content.replace(/#6366f1/ig, 'var(--accent)');
content = content.replace(/#818cf8/ig, 'var(--accent-secondary)');
content = content.replace(/#5558e8/ig, 'color-mix(in srgb, var(--accent) 85%, black)');

fs.writeFileSync('src/app/globals.css', content);
console.log('globals.css updated');
