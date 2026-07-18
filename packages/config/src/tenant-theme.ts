export type TenantThemeResult =
  | {
      accepted: true;
      actionColor: string;
      actionTextColor: '#000000' | '#ffffff';
      contrast: number;
    }
  | { accepted: false; reason: string };

const hexPattern = /^#[0-9a-f]{6}$/i;

function channelToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((value) =>
    channelToLinear(Number.parseInt(value, 16)),
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateTenantActionColor(actionColor: string): TenantThemeResult {
  if (!hexPattern.test(actionColor)) {
    return { accepted: false, reason: 'Use a six-digit hexadecimal color such as #176b4d.' };
  }

  const normalized = actionColor.toLowerCase();
  const candidates = [
    { color: '#ffffff' as const, contrast: contrastRatio(normalized, '#ffffff') },
    { color: '#000000' as const, contrast: contrastRatio(normalized, '#000000') },
  ].sort((a, b) => b.contrast - a.contrast);
  const best = candidates[0];

  if (best.contrast < 4.5) {
    return { accepted: false, reason: 'Choose a color with at least 4.5:1 text contrast.' };
  }

  return {
    accepted: true,
    actionColor: normalized,
    actionTextColor: best.color,
    contrast: Number(best.contrast.toFixed(2)),
  };
}
