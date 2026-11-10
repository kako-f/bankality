export default function GeneralOptionSection({ previewLoading, loading, onReset }) {
  return (
    <>
      <section className="import">
        <h2>Estado actual</h2>
      </section>

      <br></br>
      <section className="import">
        <h2>Reiniciar</h2>
        <button className="reset-button" type="button" disabled={loading || previewLoading} onClick={onReset}>
          Reiniciar datos
        </button>
      </section>
    </>
  );
}
