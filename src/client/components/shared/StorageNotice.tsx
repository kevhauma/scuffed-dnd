/**
 * Storage Notice
 *
 * One clear message when browser storage is unavailable or the saved data cannot be read,
 * shown instead of letting the first read or write throw.
 *
 * **Validates: Requirements 17.5, 21.4, 21.5**
 */

import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';

export interface StorageNoticeProps {
  /** The message to show the user */
  message: string;
  className?: string;
}

export function StorageNotice({ message, className = '' }: StorageNoticeProps) {
  return (
    <div className={`max-w-3xl mx-auto p-6 ${className}`.trim()}>
      <Card variant="bordered" className="p-6 text-center">
        <Text variant="h4" as="h2" className="mb-2">
          Storage Unavailable
        </Text>
        <Text variant="body-secondary">{message}</Text>
      </Card>
    </div>
  );
}
