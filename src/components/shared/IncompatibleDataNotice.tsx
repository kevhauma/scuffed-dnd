/**
 * Incompatible Data Notice
 *
 * What the User sees when their browser holds a ruleset this build cannot open (TICKET-IO-03).
 * The clean break's whole UX: say what was found, offer the bytes back, and make throwing them
 * away an explicit two-step decision rather than a button anyone can hit while reading.
 *
 * It renders *instead of* the app, so nothing downstream can create a fresh ruleset and save it
 * over data the User has not agreed to lose.
 *
 * **Validates: v2.0 decision "Clean break on persisted data"**
 */

import { useState } from 'react';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';

export interface IncompatibleDataNoticeProps {
  /** What was found, in the User's terms */
  message: string;
  /** Download the stored data exactly as it is, untouched */
  onBackup: () => void;
  /** Clear the stored data and start from nothing — only called after the confirm step */
  onStartFresh: () => void;
  className?: string;
}

export function IncompatibleDataNotice({
  message,
  onBackup,
  onStartFresh,
  className = '',
}: IncompatibleDataNoticeProps) {
  // The confirm step is local, not persisted: reloading the page puts the User back at the
  // question rather than at a half-taken decision
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className={`max-w-3xl mx-auto p-6 ${className}`.trim()}>
      <Card variant="bordered">
        <Text variant="h4" as="h2" className="mb-2">
          Saved Data Cannot Be Opened
        </Text>
        <Text variant="body-secondary" className="mb-4">
          {message}
        </Text>

        {isConfirming ? (
          <div className="flex flex-col gap-3">
            <Text variant="body">
              Starting fresh deletes the saved ruleset and every character in this browser. This
              cannot be undone. Download the backup first if you have not already.
            </Text>
            <div className="flex flex-wrap gap-3">
              <Button variant="danger" onClick={onStartFresh}>
                Yes, delete it and start fresh
              </Button>
              <Button variant="secondary" onClick={() => setIsConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={onBackup}>
              Download backup
            </Button>
            <Button variant="secondary" onClick={() => setIsConfirming(true)}>
              Start fresh
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
