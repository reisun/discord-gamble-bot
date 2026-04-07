type RouteParam = string | number | null | undefined;

const DASHBOARD_ROOT = '/dashboard';

function encodeSegment(value: string | number): string {
  return encodeURIComponent(String(value));
}

export function toHashPath(path: string): string {
  return `#${path}`;
}

export function toDashboard(guildId?: RouteParam): string {
  if (guildId == null) return DASHBOARD_ROOT;
  return `${DASHBOARD_ROOT}/${encodeSegment(guildId)}`;
}

export function toNewEvent(guildId?: RouteParam): string {
  return `${toDashboard(guildId)}/new-event`;
}

export function toEvent(guildId?: RouteParam, eventId?: RouteParam): string {
  if (guildId == null) return toDashboard();
  if (eventId == null) return toDashboard(guildId);
  return `${DASHBOARD_ROOT}/${encodeSegment(guildId)}/${encodeSegment(eventId)}`;
}

export function toEventEdit(guildId?: RouteParam, eventId?: RouteParam): string {
  return `${toEvent(guildId, eventId)}/edit`;
}

export function toNewGame(guildId?: RouteParam, eventId?: RouteParam): string {
  return `${toEvent(guildId, eventId)}/new-game`;
}

export function toGame(
  guildId?: RouteParam,
  eventId?: RouteParam,
  gameId?: RouteParam,
): string {
  if (gameId == null) return toEvent(guildId, eventId);
  return `${toEvent(guildId, eventId)}/${encodeSegment(gameId)}`;
}

export function toGameEdit(
  guildId?: RouteParam,
  eventId?: RouteParam,
  gameId?: RouteParam,
): string {
  return `${toGame(guildId, eventId, gameId)}/edit`;
}

export function toEventResults(guildId?: RouteParam, eventId?: RouteParam): string {
  return `${toEvent(guildId, eventId)}/results`;
}
