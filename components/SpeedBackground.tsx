export function SpeedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="speed-grid" />
      <div className="speed-line speed-line-one" />
      <div className="speed-line speed-line-two" />
      <div className="speed-line speed-line-three" />
      <div className="noise-layer" />
    </div>
  );
}
