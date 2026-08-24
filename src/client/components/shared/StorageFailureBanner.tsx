/**
 * Storage Failure Banner
 *
 * What the User sees when a write to LocalStorage was refused (CR-11). `services/storage.ts` has
 * thrown on a full or unwritable store since Requirement 17.x and nothing caught it, so every edit
 * simply stopped landing with no signal at all — the error classes were dead weight.
 *
 * Alongside the app rather than instead of it, which is the difference between this and
 * `StorageNotice`: storage being *unavailable* means nothing can work, while a write being refused
 * leaves everything readable and only stops changes. So the routes stay mounted and the User can
 * still export what they have — which is exactly what the banner tells them to do.
 *
 * **Validates: Requirements 17.1, 17.2, 21.4, 21.5**
 */

import { useUIStore } from '../../stores/uiStore';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';

export function StorageFailureBanner() {
  const failure = useUIStore((state) => state.storageFailure);
  const dismiss = useUIStore((state) => state.dismissStorageFailure);

  if (!failure) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6">
      <Card variant="bordered" className="border-crimson">
        {/* `role="alert"` rather than a plain region: the change the User just made did not
            happen, and a screen reader should say so without being asked */}
        <div role="alert" className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Text variant="h4" as="h2" className="mb-1">
              {failure.isQuota ? 'Browser Storage Is Full' : 'Changes Are Not Being Saved'}
            </Text>
            <Text variant="body-secondary">{failure.message}</Text>
          </div>
          <Button variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}
