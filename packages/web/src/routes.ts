type RouteParam = string | number | null | undefined;

const DASHBOARD_ROOT = '/dashboard';

function encodeSegment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function appendSearch(path: string, tokenSearch = ''): string {
  return `${path}${tokenSearch}`;
}

export function toHashPath(path: string): string {
  return `#${path}`;
}

export function toDashboard(guildId?: RouteParam, tokenSearch = ''): string {
  if (guildId == null) return appendSearch(DASHBOARD_ROOT, tokenSearch);
  return appendSearch(`${DASHBOARD_ROOT}/${encodeSegment(guildId)}`, tokenSearch);
}

export function toNewEvent(guildId?: RouteParam, tokenSearch = ''): string {
  return appendSearch(`${toDashboard(guildId)}/new-event`, tokenSearch);
}

export function toEvent(guildId?: RouteParam, eventId?: RouteParam, tokenSearch = ''): string {
  if (guildId == null) return toDashboard(undefined, tokenSearch);
  if (eventId == null) return toDashboard(guildId, tokenSearch);
  return appendSearch(
    `${DASHBOARD_ROOT}/${encodeSegment(guildId)}/${encodeSegment(eventId)}`,
    tokenSearch
  );
}

export function toEventEdit(guildId?: RouteParam, eventId?: RouteParam, tokenSearch = ''): string {
  return appendSearch(`${toEvent(guildId, eventId)}/edit`, tokenSearch);
}

export function toNewGame(guildId?: RouteParam, eventId?: RouteParam, tokenSearch = ''): string {
  return appendSearch(`${toEvent(guildId, eventId)}/new-game`, tokenSearch);
}

export function toGame(
  guildId?: RouteParam,
  eventId?: RouteParam,
  gameId?: RouteParam,
  tokenSearch = ''
): string {
  if (gameId == null) return toEvent(guildId, eventId, tokenSearch);
  return appendSearch(`${toEvent(guildId, eventId)}/${encodeSegment(gameId)}`, tokenSearch);
}

export function toGameEdit(
  guildId?: RouteParam,
  eventId?: RouteParam,
  gameId?: RouteParam,
  tokenSearch = ''
): string {
  return appendSearch(`${toGame(guildId, eventId, gameId)}/edit`, tokenSearch);
}

export function toEventResults(
  guildId?: RouteParam,
  eventId?: RouteParam,
  tokenSearch = ''
): string {
  return appendSearch(`${toEvent(guildId, eventId)}/results`, tokenSearch);
}
