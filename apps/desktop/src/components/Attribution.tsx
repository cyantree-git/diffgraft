export function Attribution() {
  return (
    <>
      <style>{`
        .diffgraft-attribution {
          position: fixed;
          bottom: 12px;
          right: 16px;
          opacity: 0.4;
          font-size: 11px;
          transition: opacity 0.2s;
          z-index: 9999;
        }
        .diffgraft-attribution:hover {
          opacity: 0.8;
        }
        .diffgraft-attribution a {
          color: inherit;
          text-decoration: none;
        }
        .diffgraft-attribution a:hover {
          text-decoration: underline;
        }
      `}</style>
      <div className="diffgraft-attribution">
        <a href="https://th4t.dev/sid" target="_blank" rel="noreferrer">
          built by th4t.dev/sid
        </a>
      </div>
    </>
  );
}
