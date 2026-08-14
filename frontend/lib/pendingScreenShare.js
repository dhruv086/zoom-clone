// Browser screen-capture permissions must be requested from a user gesture.
// Keep the selected stream in memory while Next.js moves from the dashboard to
// the LiveKit room, then publish it once the room connection is ready.
let pendingScreenShareStream = null;

export function setPendingScreenShareStream(stream) {
  pendingScreenShareStream = stream;
}

export function consumePendingScreenShareStream() {
  const stream = pendingScreenShareStream;
  pendingScreenShareStream = null;
  return stream;
}

export function discardPendingScreenShareStream() {
  pendingScreenShareStream?.getTracks().forEach((track) => track.stop());
  pendingScreenShareStream = null;
}
