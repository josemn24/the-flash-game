import "server-only";
import { ProductMeasurementUseCases } from "@/application/use-cases/product-measurement";
import { supabaseProductMeasurement } from "@/infrastructure/supabase/product/measurement";
export const productMeasurement = new ProductMeasurementUseCases(supabaseProductMeasurement);
