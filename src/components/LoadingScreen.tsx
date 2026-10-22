export default function LoadingScreen({ fading = false }: { fading?: boolean }) {
  return (
    <div className={`loading ${fading ? "loading--out" : ""}`}>
      <div className="loading__logo">
        <span className="loading__tiny">Tiny</span>
        <span className="loading__farm">Farm Empire</span>
      </div>
      <div className="loading__sprout">🌱</div>
      <div className="loading__text">Пашем грядки…</div>
    </div>
  );
}
