/** Theme id to use: the setting itself, or in "auto" mode the light or dark one. */
export function pickTheme(
  setting: string,
  osDark: boolean,
  lightTheme: string,
  darkTheme: string,
): string {
  if (setting !== 'auto') return setting;
  return osDark ? darkTheme : lightTheme;
}
