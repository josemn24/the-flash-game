import type { ProductMeasurementGateway } from "@/application/ports/product-measurement";
import type { ProductEventInput, ProductRatingInput } from "@/types/contracts/product-measurement";
import { parseEvent, uuid } from "@/lib/measurement/validation";

export class ProductMeasurementUseCases {
  constructor(private readonly gateway: ProductMeasurementGateway) {}

  capture(input: ProductEventInput) {
    return this.gateway.capture(parseEvent(input));
  }
  rating(publicationId: string) {
    if (!uuid(publicationId)) throw new Error("invalid_publication");
    return this.gateway.rating(publicationId);
  }
  rate(input: ProductRatingInput) {
    if (
      Object.keys(input).some(
        (key) => !["id", "publicationId", "seasonId", "value"].includes(key),
      ) ||
      !uuid(input.id) ||
      !uuid(input.publicationId) ||
      !uuid(input.seasonId) ||
      !Number.isInteger(input.value) ||
      input.value < 1 ||
      input.value > 5
    )
      throw new Error("invalid_rating");
    return this.gateway.rate(input);
  }
}
