import { st } from "@/components/store/t";

export default function StoreLoading() {
  return (
    <main className="store-wrap store-main" aria-busy="true" aria-label={st("loading")}>
      <div className="store-top">
        <div className="store-skeleton" style={{ aspectRatio: "4 / 5" }} />
        <div className="store-buy">
          <div className="store-skeleton" style={{ blockSize: 44 }} />
          <div className="store-skeleton" style={{ blockSize: 36, inlineSize: "40%" }} />
        </div>
      </div>
    </main>
  );
}
