export function lavaFillPath(eventId: string, connectionId: string) {
  return `/events/${eventId}/forms/${connectionId}`;
}

export function lavaEditPath(eventId: string, connectionId: string) {
  return `/events/${eventId}/forms/${connectionId}/edit`;
}

export function lavaFileProxyPath(fileId: string) {
  return `/api/forms/lava/files/${fileId}`;
}
