const categories = ["Deporte", "Fotografía", "Herramientas", "Electronica", "Aventura", "Musica"];

function Categories() {
  return (
    <section
      id="categorias"
      className="px-layout-margin pt-18 pb-[56px]"
    >
      <div className="max-w-alert-width mx-auto">
        <span className="eyebrow">EXPLORA POR CATEGORIA</span>
        <h2 className="mt-3 mb-[32px]">Encuentra lo que necesitas</h2>

        <ul className="category-list">
          {categories.map((cat) => (
            <li key={cat}>
              <button className="btn-secondary btn--md">{cat}</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { Categories };
