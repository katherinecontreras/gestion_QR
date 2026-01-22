export const ROLE_IDS = {
  CALIDAD: 2,
  OBRERO: 3,
}

export function canWrite(roleId) {
  return roleId === ROLE_IDS.CALIDAD
}

