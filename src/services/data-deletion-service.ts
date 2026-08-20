// Local data deletion. Removes a user's OWN local data from SQLite. Does not
// touch cloud/account deletion (a later phase) and leaves global model
// metadata intact (it is not user-owned).

import {
  ConversationRepository,
  CreditRepository,
  DocumentRepository,
  UserRepository,
} from "@/src/database";

export const DataDeletionService = {
  async deleteLocalUserData(userId: string): Promise<void> {
    await ConversationRepository.deleteAllForUser(userId); // conversations + messages
    await DocumentRepository.deleteAllForUser(userId); // documents + chunks
    await CreditRepository.deleteAllForUser(userId); // wallet + transactions
    await UserRepository.deleteById(userId); // profile
  },
};
