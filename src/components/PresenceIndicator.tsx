/**
 * PresenceIndicator — Shows active collaborators with avatars and status.
 *
 * Integration with App.tsx:
 *   - Maintain a `presence: PresenceInfo` state (updated via WebSocket/Yjs awareness).
 *   - Use `mergePresence` and `removePresence` from `../collaboration/syncModel` to manage state.
 *   - Pass presence and currentUserId as props.
 *
 * Props:
 *   presence      — PresenceInfo object containing all active users.
 *   currentUserId — The current user's ID (to exclude self or style differently).
 */

import { useMemo } from 'react';
import type { PresenceInfo, CollaborationState } from '../collaboration/syncModel';

type PresenceIndicatorProps = {
  presence: PresenceInfo;
  currentUserId: string;
};

function UserAvatar({ user, isSelf }: { user: CollaborationState; isSelf: boolean }) {
  const initials = user.userName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const toolLabel = user.awareness.activeTool
    ? ` (${user.awareness.activeTool})`
    : '';
  const pageLabel = user.awareness.viewportPage != null
    ? ` on page ${user.awareness.viewportPage}`
    : '';

  return (
    <div
      className={`presence-avatar ${isSelf ? 'presence-avatar-self' : ''}`}
      style={{
        backgroundColor: user.color,
        borderColor: user.color,
      }}
      title={`${user.userName}${isSelf ? ' (you)' : ''}${toolLabel}${pageLabel}`}
    >
      {initials}
    </div>
  );
}

export default function PresenceIndicator({
  presence,
  currentUserId,
}: PresenceIndicatorProps) {
  const otherUsers = useMemo(
    () => presence.users.filter((u) => u.userId !== currentUserId),
    [presence.users, currentUserId],
  );

  if (presence.users.length === 0) {
    return null;
  }

  // Show self first, then others
  const selfUser = presence.users.find((u) => u.userId === currentUserId);

  return (
    <div className="presence-indicator">
      {selfUser && (
        <UserAvatar user={selfUser} isSelf={true} />
      )}
      {otherUsers.map((user) => (
        <UserAvatar key={user.userId} user={user} isSelf={false} />
      ))}
      {otherUsers.length > 0 && (
        <span className="presence-count">
          {otherUsers.length} other{otherUsers.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
