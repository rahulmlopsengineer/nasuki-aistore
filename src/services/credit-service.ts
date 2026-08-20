// CreditService — mock wallet. Phase 5 wires AdMob rewards + Play Billing.

import { CREDITS } from "@/src/constants/config";
import { mockTransactions, mockWallet } from "@/src/constants/mock-data";
import { CreditTransaction, CreditWallet } from "@/src/types";
import { delay, nowIso, uid } from "@/src/utils/misc";

let wallet: CreditWallet = { ...mockWallet };
let transactions: CreditTransaction[] = [...mockTransactions];

export const CreditService = {
  async getWallet(): Promise<CreditWallet> {
    await delay(300);
    return wallet;
  },

  async listTransactions(): Promise<CreditTransaction[]> {
    await delay(300);
    return [...transactions].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  },

  async watchAdForReward(): Promise<CreditWallet> {
    await delay(1200); // simulate ad playback
    const amount = CREDITS.rewardPerAd;
    wallet = {
      ...wallet,
      balance: wallet.balance + amount,
      lifetimeEarned: wallet.lifetimeEarned + amount,
    };
    transactions = [
      {
        id: uid("tx"),
        type: "reward_ad",
        amount,
        label: "Watched an ad",
        createdAt: nowIso(),
      },
      ...transactions,
    ];
    return wallet;
  },

  async buyCredits(amount: number): Promise<CreditWallet> {
    await delay(900); // simulate purchase
    wallet = {
      ...wallet,
      balance: wallet.balance + amount,
      lifetimeEarned: wallet.lifetimeEarned + amount,
    };
    transactions = [
      {
        id: uid("tx"),
        type: "purchase",
        amount,
        label: `Purchased ${amount} credits`,
        createdAt: nowIso(),
      },
      ...transactions,
    ];
    return wallet;
  },
};
