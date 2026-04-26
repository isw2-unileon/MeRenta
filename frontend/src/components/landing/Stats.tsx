const stats = [
  { value: "12.400+", label: "Productos disponibles" },
  { value: "8.200", label: "Usuarios activos" },
  { value: "4.8 ★", label: "Valoración media" },
  { value: "98%", label: "Alquileres sin incidencias" },
];

function Stats() {
  return (
    <section className="h-stats bg-page border-border-main px-layout-margin flex items-center border-t border-b">
      <div className="max-w-alert-width mx-auto grid w-full grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-col items-center gap-1 text-center ${
              i < stats.length - 1 ? "border-border-main border-r" : ""
            }`}
          >
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export { Stats };
