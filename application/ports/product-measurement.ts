import type {
  ProductEventInput,
  ProductRating,
  ProductRatingInput,
} from "@/types/contracts/product-measurement";

export interface ProductMeasurementGateway {
  /** Best-effort observation: resolving does not guarantee storage (scope and quota may drop it). */
  capture(input: ProductEventInput): Promise<void>;
  rating(publicationId: string): Promise<ProductRating>;
  rate(input: ProductRatingInput): Promise<ProductRating>;
}
