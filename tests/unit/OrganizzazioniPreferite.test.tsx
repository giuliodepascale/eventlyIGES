/* eslint-disable @typescript-eslint/no-explicit-any */
import { followOrganization, unfollowOrganization } from "@/actions/favorites-organization";
import { db } from "@/lib/db";

// MOCK del database
jest.mock("@/lib/db", () => ({
  db: { $transaction: jest.fn() },
}));

describe("Follow/Unfollow Organization", () => {
  const mockTransaction = db.$transaction as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  //Successo follow e unfollow
  it("TC_1_RF_15: follow eseguito con successo", async () => {
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { findUnique: jest.fn().mockResolvedValue({ id: "user1" }) },
        organization: { findUnique: jest.fn().mockResolvedValue({ id: "org1" }) },
        favoriteOrganization: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      });
    });

    const result = await followOrganization("org1", "user1");
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("TC_1_1_RF_15: unfollow eseguito con successo", async () => {
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { findUnique: jest.fn().mockResolvedValue({ id: "user1" }) },
        favoriteOrganization: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      });
    });

    const result = await unfollowOrganization("org1", "user1");
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  //Errore follow e unfollow
  it("TC_1_2_RF_15: follow fallito - utente non trovato", async () => {
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { findUnique: jest.fn().mockResolvedValue(null) },
        organization: { findUnique: jest.fn() },
        favoriteOrganization: { findUnique: jest.fn() },
      });
    });

    await expect(followOrganization("org1", "userX")).rejects.toThrow("Errore durante il follow dell'organizzazione.");
  });

  it("TC_1_3_RF_15: follow fallito - organizzazione non trovata", async () => {
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { findUnique: jest.fn().mockResolvedValue({ id: "user1" }) },
        organization: { findUnique: jest.fn().mockResolvedValue(null) },
        favoriteOrganization: { findUnique: jest.fn() },
      });
    });

    await expect(followOrganization("orgX", "user1")).rejects.toThrow("Errore durante il follow dell'organizzazione.");
  });

  it("TC_1_4_RF_15: follow fallito - già seguita", async () => {
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { findUnique: jest.fn().mockResolvedValue({ id: "user1" }) },
        organization: { findUnique: jest.fn().mockResolvedValue({ id: "org1" }) },
        favoriteOrganization: { findUnique: jest.fn().mockResolvedValue({ userId: "user1", organizationId: "org1" }) },
      });
    });

    await expect(followOrganization("org1", "user1")).rejects.toThrow("Errore durante il follow dell'organizzazione.");
  });

  it("TC_1_5_RF_15: unfollow fallito - utente non trovato", async () => {
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        user: { findUnique: jest.fn().mockResolvedValue(null) },
        favoriteOrganization: { deleteMany: jest.fn() },
      });
    });

    await expect(unfollowOrganization("org1", "userX")).rejects.toThrow("Errore durante l'unfollow dell'organizzazione.");
  });
});
