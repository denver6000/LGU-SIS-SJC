export default function RegistryLoading() {
  return (
    <main className="route-loading-screen" aria-live="polite">
      <div className="route-loading-panel">
        <div className="student-loading-spinner" aria-hidden="true" />
        <div>
          <strong>Opening Registry</strong>
          <span>Preparing the workspace.</span>
        </div>
      </div>
    </main>
  );
}
