/**
 * Thrown when a login or session check is blocked due to account status.
 * The `reason` field identifies whether the block is permanent (banned)
 * or temporary (suspended), and `suspendedUntil` carries the ISO-8601
 * end date for suspensions.
 */
class BlockedAccountError extends Error {
  constructor(
    public readonly reason: "banned" | "suspended",
    public readonly suspendedUntil?: string
  ) {
    super(reason === "banned" ? "account_banned" : "account_suspended");
    this.name = "BlockedAccountError";
  }
}

export { BlockedAccountError };
