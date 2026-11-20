import { st } from "./t";

/** Templates keep their {placeholders} (functions cannot cross to a client component). Every visible string of the order form, resolved on the server so the form component stays props-only. */
export function orderFormStrings() {
  return {
    title: st("order.title"),
    lead: st("order.lead"),
    sizeLabel: st("order.sizeLabel"),
    chooseSize: st("order.chooseSize"),
    outOfStock: st("outOfStock"),
    offersTitle: st("order.offersTitle"),
    single: st("order.single"),
    sameSize: st("order.sameSize"),
    currency: st("currency"),
    bumpAdd: st("order.bumpAdd", { name: "{name}" }),
    offerSave: st("order.offerSave", { n: "{n}" }),
    piece: st("order.piece", { n: "{n}" }),
    startingFrom: st("order.startingFrom", { price: "{price}" }),
    fields: {
      name: st("order.fields.name"),
      phone: st("order.fields.phone"),
      wilaya: st("order.fields.wilaya"),
      commune: st("order.fields.commune"),
      delivery: st("order.fields.delivery"),
      note: st("order.fields.note"),
      email: st("order.fields.email"),
      chooseWilaya: st("order.fields.chooseWilaya"),
      choose: st("order.fields.choose"),
      optional: st("order.fields.optional"),
      home: st("order.fields.home"),
      stopdesk: st("order.fields.stopdesk"),
    },
    errors: {
      required: st("order.errors.required"),
      phone: st("order.errors.phone"),
      email: st("order.errors.email"),
      size: st("order.errors.size"),
      delivery: st("order.errors.delivery"),
    },
    summary: {
      product: st("order.summary.product"),
      saving: st("order.summary.saving"),
      total: st("order.summary.total"),
      deliveryNote: st("order.summary.deliveryNote"),
    },
    submit: st("order.submit"),
    cod: st("order.cod"),
  };
}
export type OrderFormStrings = ReturnType<typeof orderFormStrings>;
