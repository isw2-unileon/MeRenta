/**
 * Access denied page for restricted routes.
 * @returns The forbidden placeholder content.
 */
function Forbidden() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-semibold">Acceso Denegado</h1>
    </div>
  );
}

export { Forbidden };
