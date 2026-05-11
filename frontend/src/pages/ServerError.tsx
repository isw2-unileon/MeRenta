/**
 * Server error page for unexpected failures.
 * @returns The server error placeholder content.
 */
function ServerError() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-semibold">Servidor Error</h1>
    </div>
  );
}

export { ServerError };
