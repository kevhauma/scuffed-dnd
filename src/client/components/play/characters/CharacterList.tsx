/**
 * Character List
 *
 * Play mode's entry point: every saved character, a way into one, and a way to make another.
 * Layout and composition only — the decisions live in `useCharacterListManager`.
 *
 * **Validates: Requirements 11.1, 17.4, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Text } from '../../ui/Text/Text';
import { CharacterCard } from './CharacterCard';
import { useCharacterListManager } from './useCharacterListManager';

export function CharacterList() {
  const {
    entries,
    hasConfiguration,
    pendingDeleteCharacter,
    handleCreate,
    handleOpen,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useCharacterListManager();

  // A character cannot exist without a ruleset, so creation is not offered here
  if (!hasConfiguration) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Text variant="h1" as="h1" className="mb-6">
          Characters
        </Text>
        <Card className="p-8 text-center">
          <Text variant="h4" as="h2" className="mb-2">
            No Ruleset Yet
          </Text>
          <Text variant="body-secondary">
            Characters are built on a configuration. Set one up in configuration mode first, then
            come back here to create your first character.
          </Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Text variant="h1" as="h1">
          Characters
        </Text>
        <Button variant="primary" onClick={handleCreate}>
          Create Character
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="p-8 text-center">
          <Text variant="h4" as="h2" className="mb-2">
            No Characters Yet
          </Text>
          <Text variant="body-secondary" className="mb-6">
            Create your first character to start playing on this ruleset.
          </Text>
          <Button variant="primary" onClick={handleCreate}>
            Create Character
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <CharacterCard
              key={entry.character.id}
              entry={entry}
              onOpen={handleOpen}
              onDelete={handleRequestDelete}
            />
          ))}
        </div>
      )}

      <Dialog
        open={pendingDeleteCharacter !== null}
        onClose={handleCancelDelete}
        title="Delete Character"
      >
        <Text variant="body" className="mb-6">
          Delete {pendingDeleteCharacter?.name ?? 'this character'}? This cannot be undone.
        </Text>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleCancelDelete}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete Character
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
