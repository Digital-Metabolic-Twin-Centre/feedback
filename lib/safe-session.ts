/**
 * Sets the current user for the given Postgres client connection.
 * This should be called at the start of a transaction to ensure that
 * any triggers or audit fields that rely on the current user are set correctly.
 *
 * @param client - the Postgres client connection
 * @param userEmail - the email of the current user, or undefined to use "imdhub-system"
 */

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setCurrentUserOnConnection(client: any, userEmail?: string) {
  const user = (userEmail && userEmail.length) ? userEmail : "imdhub-system";

  // Use parameterized query to avoid injection, set is_local = true so it only lasts for the transaction
  // If you call this outside a transaction it behaves like SET (but using set_config with true does the right thing inside a tx).
  await client.query(
    "SELECT set_config($1, $2, true)",
    ["app.current_user_id", user]
  );
}
