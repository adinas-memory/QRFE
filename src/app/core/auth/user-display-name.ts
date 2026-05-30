/** Staff header label: full surname + first-name initial (e.g. "Popescu I."). */
export function formatStaffDisplayName(input: {
  displayName?: string | null;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
}): string {
  const display = input.displayName?.trim() ?? '';
  if (display) {
    if (/\s[A-Za-z]\.$/.test(display)) return display;
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const familyName = parts[parts.length - 1];
      const firstInitial = parts[0].charAt(0).toUpperCase();
      return `${familyName} ${firstInitial}.`;
    }
    return display;
  }

  const name = input.name?.trim() ?? '';
  const surname = input.surname?.trim() ?? '';
  if (surname && name) {
    return `${surname} ${name.charAt(0).toUpperCase()}.`;
  }
  if (surname) return surname;
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const familyName = parts[parts.length - 1];
      const firstInitial = parts[0].charAt(0).toUpperCase();
      return `${familyName} ${firstInitial}.`;
    }
    return name;
  }

  const email = input.email?.trim() ?? '';
  if (email) {
    const local = email.split('@')[0]?.trim();
    return local || email;
  }

  return '';
}
