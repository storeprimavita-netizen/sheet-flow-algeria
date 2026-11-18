// Neutral 404 for URLs that match no route. There is no single root layout (app and store each own one),
// so this file renders its own html/body with no styles, fonts or app theme.
export const metadata = { title: "404", robots: { index: false, follow: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", paddingBlock: "4rem" }}>
        <h1>404</h1>
        <p>Page not found</p>
      </body>
    </html>
  );
}
